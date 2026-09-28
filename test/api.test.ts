import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../api/app';
import { MemoryStore } from '../api/store';
import type { AiResult, QuestIdea, WeeklyBrief, Workspace } from '../shared/types';

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  delete process.env.AI_PROVIDER;
  app = createApp(new MemoryStore());
});

const post = (path: string, body?: unknown) =>
  app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const json = async <T>(res: Response) => (await res.json()) as T;

async function createWorkspace(): Promise<Workspace> {
  const res = await post('/api/workspaces');
  expect(res.status).toBe(201);
  return json<Workspace>(res);
}

describe('Anchor API', () => {
  it('reports health and configuration', async () => {
    const res = await app.request('/api/health');
    expect(await res.json()).toMatchObject({ ok: true, store: 'memory', ai: 'rules-only' });
  });

  it('creates a seeded demo family and applies actions', async () => {
    const ws = await createWorkspace();
    expect(ws.kids.map((k) => k.name)).toEqual(['Maya', 'Theo']);

    const res = await post(`/api/workspaces/${ws.id}/actions`, { type: 'check-in', kidId: 'kid-maya', mood: 4, energy: 'ok', tags: ['proud'] });
    const next = await json<Workspace>(res);
    expect(res.status).toBe(200);
    expect(next.version).toBe(ws.version + 1);
    expect(next.activity[0].text).toContain('Maya checked in');
  });

  it('validates actions at the boundary', async () => {
    const ws = await createWorkspace();
    const bad = await post(`/api/workspaces/${ws.id}/actions`, { type: 'check-in', kidId: 'kid-maya', mood: 9, energy: 'ok', tags: [] });
    expect(bad.status).toBe(400);
    const unknown = await post(`/api/workspaces/${ws.id}/actions`, { type: 'set-budget', kidId: 'ghost', dailyScreenMinutes: 30 });
    expect(unknown.status).toBe(404);
    const missing = await app.request('/api/workspaces/00000000-0000-4000-8000-000000000000');
    expect(missing.status).toBe(404);
  });

  it('falls back to the rules engine when Claude is not configured', async () => {
    const ws = await createWorkspace();
    const res = await post(`/api/workspaces/${ws.id}/ai/brief`, { kidId: 'kid-maya' });
    const { result, workspace } = await json<{ result: AiResult<WeeklyBrief>; workspace: Workspace }>(res);
    expect(result.source).toBe('rules');
    expect(result.data.pattern).toContain('over-budget');
    expect(result.data.nextWeek.map((q) => q.title)).toContain('Phone in the kitchen by 9pm');
    expect(workspace.briefs['kid-maya'].data.headline).toBe(result.data.headline);
    expect(workspace.aiUsage.count).toBe(0);
  });

  it('suggests quest ideas that match the parent’s goal', async () => {
    const ws = await createWorkspace();
    const res = await post(`/api/workspaces/${ws.id}/ai/quest-ideas`, { kidId: 'kid-maya', goal: 'She is struggling with fractions' });
    const { result } = await json<{ result: AiResult<QuestIdea[]> }>(res);
    expect(result.data[0].title).toBe('Double a recipe using fractions');
  });

  it('requires coach conversations to end with the parent’s message', async () => {
    const ws = await createWorkspace();
    const res = await post(`/api/workspaces/${ws.id}/ai/coach`, {
      kidId: 'kid-maya',
      messages: [
        { role: 'user', content: 'How do I talk to Maya about lunch?' },
        { role: 'assistant', content: 'Try a relaxed moment.' },
      ],
    });
    expect(res.status).toBe(400);
  });

  it('resets a workspace to fresh demo data', async () => {
    const ws = await createWorkspace();
    await post(`/api/workspaces/${ws.id}/actions`, { type: 'set-budget', kidId: 'kid-maya', dailyScreenMinutes: 30 });
    const res = await post(`/api/workspaces/${ws.id}/reset`);
    const reset = await json<Workspace>(res);
    expect(reset.id).toBe(ws.id);
    expect(reset.kids[0].dailyScreenMinutes).toBe(90);
  });
});
