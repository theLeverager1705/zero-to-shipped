import { describe, expect, it } from 'vitest';
import { seedWorkspace } from '../api/seed';
import { classRows, kidSignals, kidStats } from '../shared/stats';

const TODAY = '2026-09-28';
const ws = seedWorkspace('00000000-0000-4000-8000-000000000000', TODAY, `${TODAY}T12:00:00.000Z`);
const maya = ws.kids.find((k) => k.name === 'Maya')!;
const theo = ws.kids.find((k) => k.name === 'Theo')!;

describe('kidStats', () => {
  it('summarises Maya’s week from the seed data', () => {
    const stats = kidStats(ws, maya.id, TODAY);
    expect(stats.days).toHaveLength(14);
    expect(stats.checkedInToday).toBe(false);
    expect(stats.streak).toBe(13);
    expect(stats.moodAvg).toBeCloseTo(20 / 6);
    expect(stats.prevMoodAvg).toBeCloseTo(4);
    expect(stats.lowMoodDays).toHaveLength(2);
    expect(stats.overBudgetDays).toBe(3);
    expect(stats.energyLink).toEqual({ overDays: 5, lowAfterOver: 4, otherDays: 7, lowAfterOther: 1 });
    expect(stats.proposedQuests.map((q) => q.title)).toEqual(['Bake cookies for the class bake sale']);
  });

  it('counts a check-in made today in the streak', () => {
    const stats = kidStats(ws, theo.id, TODAY);
    expect(stats.checkedInToday).toBe(true);
    expect(stats.streak).toBe(14);
    expect(stats.pendingRequests).toHaveLength(1);
  });
});

describe('kidSignals', () => {
  it('flags the screen-time and energy pattern for Maya', () => {
    const signals = kidSignals(ws, maya, kidStats(ws, maya.id, TODAY));
    const byId = Object.fromEntries(signals.map((s) => [s.id, s]));
    expect(byId['mood-trend'].tone).toBe('watch');
    expect(byId['low-days'].tone).toBe('watch');
    expect(byId['energy-link'].detail).toContain('4 of 5');
    expect(byId['screen-budget'].tone).toBe('watch');
    expect(byId['teacher-note'].detail).toContain('quieter than usual');
  });

  it('celebrates Theo staying inside his screen budget', () => {
    const signals = kidSignals(ws, theo, kidStats(ws, theo.id, TODAY));
    const byId = Object.fromEntries(signals.map((s) => [s.id, s]));
    expect(byId['screen-budget'].tone).toBe('positive');
    expect(byId['streak'].title).toBe('14-day check-in streak');
    expect(byId['energy-link']).toBeUndefined();
  });
});

describe('classRows', () => {
  it('hides wellbeing data for families who have not opted in', () => {
    const rows = classRows(ws, TODAY);
    expect(rows).toHaveLength(8);
    const sam = rows.find((r) => r.student.name === 'Sam')!;
    expect(sam.shares).toBe(false);
    expect(sam.moods.every((m) => m === null)).toBe(true);
    expect(sam.tasksDone).toBe(1);
    const mateo = rows.find((r) => r.student.name === 'Mateo')!;
    expect(mateo.lowDays).toBe(3);
  });

  it('follows the family’s sharing choice for linked kids', () => {
    const optedOut = { ...ws, kids: ws.kids.map((k) => (k.id === maya.id ? { ...k, shareWithTeacher: false } : k)) };
    const row = classRows(optedOut, TODAY).find((r) => r.student.id === maya.id)!;
    expect(row.shares).toBe(false);
    expect(row.moodAvg).toBeNull();
  });
});
