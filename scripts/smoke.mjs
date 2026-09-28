// Post-deploy check: the site loads, the API answers, and Claude on Bedrock writes a brief.
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Node's fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY is set at startup (Node >= 22.21).
if (process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY) {
  const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1' },
  });
  process.exit(child.status ?? 1);
}

const outputs = JSON.parse(await readFile('cdk-outputs.json', 'utf8'));
const url = outputs.AnchorStack.AppUrl;

async function fetchWithRetry(target, init, attempts = 6) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(target, init);
      if (res.ok || i === attempts) return res;
    } catch (err) {
      if (i === attempts) throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

const page = await fetchWithRetry(url);
console.log(`GET /                 ${page.status}`);

const health = await (await fetchWithRetry(`${url}/api/health`)).json();
console.log(`GET /api/health       ${JSON.stringify(health)}`);

const created = await fetchWithRetry(`${url}/api/workspaces`, { method: 'POST' });
const ws = await created.json();
console.log(`POST /api/workspaces  ${created.status} (${ws.kids?.map((k) => k.name).join(', ')})`);

const briefRes = await fetch(`${url}/api/workspaces/${ws.id}/ai/brief`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ kidId: 'kid-maya' }),
});
const { result } = await briefRes.json();
console.log(`POST .../ai/brief     ${briefRes.status} source=${result.source}${result.model ? ` model=${result.model}` : ''}`);
if (result.source === 'claude') {
  console.log(`\n  “${result.data.headline}”`);
} else {
  console.log(`\n  Claude fallback reason: ${result.note}`);
}

console.log(`\nAnchor is live at ${url}`);
if (!page.ok || !health.ok || created.status !== 201) process.exit(1);
