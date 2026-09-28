import { mkdir, rm, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const outdir = 'dist/api';

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
await build({
  entryPoints: ['api/lambda.ts'],
  outfile: `${outdir}/index.js`,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  minify: true,
  sourcemap: true,
  legalComments: 'none',
  logLevel: 'info',
});
// The repo is ESM ("type": "module"); mark the bundle as CommonJS so Node and Lambda load it the same way.
await writeFile(`${outdir}/package.json`, JSON.stringify({ type: 'commonjs' }));
