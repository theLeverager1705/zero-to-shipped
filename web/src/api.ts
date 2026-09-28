import type { Action, CoachMessage } from '../../shared/actions';
import { localToday } from '../../shared/dates';
import type { AiResult, ClassPulse, QuestIdea, WeeklyBrief, Workspace } from '../../shared/types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-client-date': localToday() },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Could not reach Anchor. Check your connection and try again.');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  createWorkspace: () => request<Workspace>('/workspaces', undefined, 'POST'),
  getWorkspace: (id: string) => request<Workspace>(`/workspaces/${id}`),
  resetWorkspace: (id: string) => request<Workspace>(`/workspaces/${id}/reset`, undefined, 'POST'),
  act: (id: string, action: Action) => request<Workspace>(`/workspaces/${id}/actions`, action),
  brief: (id: string, kidId: string) =>
    request<{ result: AiResult<WeeklyBrief>; workspace: Workspace }>(`/workspaces/${id}/ai/brief`, { kidId }),
  coach: (id: string, kidId: string, messages: CoachMessage[]) =>
    request<{ result: AiResult<string> }>(`/workspaces/${id}/ai/coach`, { kidId, messages }),
  questIdeas: (id: string, kidId: string, goal: string) =>
    request<{ result: AiResult<QuestIdea[]> }>(`/workspaces/${id}/ai/quest-ideas`, { kidId, goal }),
  classPulse: (id: string) =>
    request<{ result: AiResult<ClassPulse>; workspace: Workspace }>(`/workspaces/${id}/ai/class-pulse`, {}),
};

const STORAGE_KEY = 'anchor.workspaceId';

function storedWorkspaceId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function rememberWorkspaceId(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private mode or blocked storage: the demo still works, it just won't be remembered.
  }
}

export async function loadOrCreateWorkspace(): Promise<Workspace> {
  const id = storedWorkspaceId();
  if (id) {
    try {
      return await api.getWorkspace(id);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) throw err;
    }
  }
  const ws = await api.createWorkspace();
  rememberWorkspaceId(ws.id);
  return ws;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong';
}
