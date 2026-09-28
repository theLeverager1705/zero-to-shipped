import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { ZodError } from 'zod';
import type { z } from 'zod';
import { ActionSchema, CoachRequestSchema, KidRequestSchema, QuestIdeasRequestSchema } from '../shared/actions';
import { DATE_PATTERN, daysBetween, utcToday } from '../shared/dates';
import type { Workspace } from '../shared/types';
import { aiEnabled, modelChain } from './claude';
import { HttpError } from './http-error';
import { classPulse, coachReply, questIdeas, weeklyBrief } from './insights';
import { applyAction } from './reducer';
import { seedWorkspace } from './seed';
import type { Store } from './store';

const ID_PATTERN = /^[0-9a-f-]{36}$/;
const WORKSPACE_DAILY_AI_LIMIT = 40;
const GLOBAL_DAILY_AI_LIMIT = Number(process.env.AI_DAILY_LIMIT || 2000);

export function createApp(store: Store) {
  const app = new Hono().basePath('/api');

  app.use(bodyLimit({ maxSize: 32 * 1024, onError: (c) => c.json({ error: 'Request too large' }, 413) }));
  app.use(async (c, next) => {
    await next();
    c.header('Cache-Control', 'no-store');
  });

  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
    if (err instanceof ZodError) {
      return c.json({ error: 'Invalid request', issues: err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`) }, 400);
    }
    console.error('Unhandled error', err);
    return c.json({ error: 'Something went wrong' }, 500);
  });
  app.notFound((c) => c.json({ error: 'Not found' }, 404));

  // Clients send their local date so "today" matches what the family sees on screen.
  const today = (c: Context) => {
    const server = utcToday();
    const client = c.req.header('x-client-date');
    return client && DATE_PATTERN.test(client) && Math.abs(daysBetween(server, client)) <= 1 ? client : server;
  };

  const body = async <T>(c: Context, schema: z.ZodType<T>): Promise<T> => {
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      throw new HttpError(400, 'Request body must be JSON');
    }
    return schema.parse(raw);
  };

  const workspaceId = (c: Context) => {
    const id = c.req.param('id');
    if (!id || !ID_PATTERN.test(id)) throw new HttpError(404, 'Workspace not found');
    return id;
  };

  const load = async (c: Context) => {
    const ws = await store.get(workspaceId(c));
    if (!ws) throw new HttpError(404, 'Workspace not found');
    return ws;
  };

  const requireKid = (ws: Workspace, kidId: string) => {
    if (!ws.kids.some((k) => k.id === kidId)) throw new HttpError(404, 'Unknown kid');
  };

  // Returns why Claude can't be used for this request, or null when a call is allowed.
  const aiBlocker = async (ws: Workspace, day: string): Promise<string | null> => {
    if (!aiEnabled()) return 'Claude is not configured in this environment';
    const used = ws.aiUsage.date === day ? ws.aiUsage.count : 0;
    if (used >= WORKSPACE_DAILY_AI_LIMIT) return 'This demo family has used its AI calls for today';
    if ((await store.countAiCall(day)) > GLOBAL_DAILY_AI_LIMIT) return 'The demo has used its AI calls for today';
    return null;
  };

  const countUsage = (ws: Workspace, day: string, blocked: string | null): Workspace =>
    blocked ? ws : { ...ws, aiUsage: { date: day, count: (ws.aiUsage.date === day ? ws.aiUsage.count : 0) + 1 } };

  app.get('/health', (c) =>
    c.json({
      ok: true,
      store: store.kind,
      ai: aiEnabled() ? 'claude-on-bedrock' : 'rules-only',
      models: aiEnabled() ? modelChain() : [],
      region: process.env.AWS_REGION ?? 'local',
    }),
  );

  app.post('/workspaces', async (c) => {
    const ws = seedWorkspace(randomUUID(), today(c), new Date().toISOString());
    await store.put(ws);
    return c.json(ws, 201);
  });

  app.get('/workspaces/:id', async (c) => c.json(await load(c)));

  app.post('/workspaces/:id/reset', async (c) => {
    const current = await load(c);
    const ws = { ...seedWorkspace(current.id, today(c), new Date().toISOString()), aiUsage: current.aiUsage };
    await store.put(ws);
    return c.json(ws);
  });

  app.post('/workspaces/:id/actions', async (c) => {
    const action = await body(c, ActionSchema);
    const day = today(c);
    const now = new Date().toISOString();
    return c.json(await store.update(workspaceId(c), (ws) => applyAction(ws, action, day, now)));
  });

  app.post('/workspaces/:id/ai/brief', async (c) => {
    const { kidId } = await body(c, KidRequestSchema);
    const day = today(c);
    const ws = await load(c);
    requireKid(ws, kidId);
    const blocked = await aiBlocker(ws, day);
    const result = await weeklyBrief(ws, kidId, day, blocked);
    const workspace = await store.update(ws.id, (w) => ({ ...countUsage(w, day, blocked), briefs: { ...w.briefs, [kidId]: result } }));
    return c.json({ result, workspace });
  });

  app.post('/workspaces/:id/ai/coach', async (c) => {
    const { kidId, messages } = await body(c, CoachRequestSchema);
    const day = today(c);
    const ws = await load(c);
    requireKid(ws, kidId);
    const blocked = await aiBlocker(ws, day);
    const result = await coachReply(ws, kidId, messages, day, blocked);
    if (!blocked) await store.update(ws.id, (w) => countUsage(w, day, blocked));
    return c.json({ result });
  });

  app.post('/workspaces/:id/ai/quest-ideas', async (c) => {
    const { kidId, goal } = await body(c, QuestIdeasRequestSchema);
    const day = today(c);
    const ws = await load(c);
    requireKid(ws, kidId);
    const blocked = await aiBlocker(ws, day);
    const result = await questIdeas(ws, kidId, goal, day, blocked);
    if (!blocked) await store.update(ws.id, (w) => countUsage(w, day, blocked));
    return c.json({ result });
  });

  app.post('/workspaces/:id/ai/class-pulse', async (c) => {
    const day = today(c);
    const ws = await load(c);
    const blocked = await aiBlocker(ws, day);
    const result = await classPulse(ws, day, blocked);
    const workspace = await store.update(ws.id, (w) => ({ ...countUsage(w, day, blocked), pulse: result }));
    return c.json({ result, workspace });
  });

  return app;
}
