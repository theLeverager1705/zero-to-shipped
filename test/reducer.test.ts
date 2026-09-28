import { describe, expect, it } from 'vitest';
import { HttpError } from '../api/http-error';
import { applyAction } from '../api/reducer';
import { seedWorkspace } from '../api/seed';

const TODAY = '2026-09-28';
const NOW = `${TODAY}T18:00:00.000Z`;
const fresh = () => seedWorkspace('00000000-0000-4000-8000-000000000000', TODAY, `${TODAY}T12:00:00.000Z`);
const screenToday = (ws: ReturnType<typeof fresh>, kidId: string) => ws.screen.find((s) => s.kidId === kidId && s.date === TODAY)!;

describe('applyAction', () => {
  it('replaces an existing same-day check-in instead of duplicating it', () => {
    const once = applyAction(fresh(), { type: 'check-in', kidId: 'kid-theo', mood: 2, energy: 'low', tags: ['worried'] }, TODAY, NOW);
    const todays = once.checkins.filter((c) => c.kidId === 'kid-theo' && c.date === TODAY);
    expect(todays).toHaveLength(1);
    expect(todays[0].mood).toBe(2);
    expect(once.activity[0].text).toContain('Theo checked in');
  });

  it('awards bonus screen minutes when a quest is completed', () => {
    const ws = fresh();
    const quest = ws.quests.find((q) => q.kidId === 'kid-maya' && q.status === 'open')!;
    const before = screenToday(ws, 'kid-maya').bonusMinutes;
    const next = applyAction(ws, { type: 'complete-quest', questId: quest.id }, TODAY, NOW);
    expect(next.quests.find((q) => q.id === quest.id)?.status).toBe('done');
    expect(screenToday(next, 'kid-maya').bonusMinutes).toBe(before + 10);
    expect(() => applyAction(next, { type: 'complete-quest', questId: quest.id }, TODAY, NOW)).toThrow(HttpError);
  });

  it('adds approved extra minutes to today’s allowance', () => {
    const ws = fresh();
    const request = ws.requests[0];
    const next = applyAction(ws, { type: 'decide-request', requestId: request.id, approve: true }, TODAY, NOW);
    expect(next.requests[0].status).toBe('approved');
    expect(screenToday(next, 'kid-theo').bonusMinutes).toBe(screenToday(ws, 'kid-theo').bonusMinutes + request.minutes);
  });

  it('turns a class-wide teacher note with a quest into a quest for every student', () => {
    const ws = fresh();
    const next = applyAction(
      ws,
      { type: 'post-note', studentId: null, body: 'Bring a leaf for Monday!', quest: { title: 'Find a cool leaf', category: 'school', points: 10 } },
      TODAY,
      NOW,
    );
    expect(next.quests.filter((q) => q.title === 'Find a cool leaf')).toHaveLength(ws.classroom.students.length);
    expect(next.notes.at(-1)?.questTitle).toBe('Find a cool leaf');
  });

  it('rejects unknown kids and leaves the original workspace untouched', () => {
    const ws = fresh();
    expect(() => applyAction(ws, { type: 'set-budget', kidId: 'nobody', dailyScreenMinutes: 30 }, TODAY, NOW)).toThrow(HttpError);
    const next = applyAction(ws, { type: 'set-budget', kidId: 'kid-maya', dailyScreenMinutes: 75 }, TODAY, NOW);
    expect(next.kids[0].dailyScreenMinutes).toBe(75);
    expect(ws.kids[0].dailyScreenMinutes).toBe(90);
  });
});
