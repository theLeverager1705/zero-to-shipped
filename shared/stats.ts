import { addDays, daysBetween, lastNDays, weekday } from './dates';
import { QUEST_CATEGORIES } from './types';
import type {
  CheckinTag,
  Energy,
  Kid,
  Quest,
  QuestCategory,
  Student,
  TeacherNote,
  TimeRequest,
  Workspace,
} from './types';

export interface DayPoint {
  date: string;
  mood: number | null;
  energy: Energy | null;
  tags: CheckinTag[];
  note?: string;
  screen: number | null;
  allowance: number;
  questsDone: string[];
}

export interface EnergyLink {
  overDays: number;
  lowAfterOver: number;
  otherDays: number;
  lowAfterOther: number;
}

export interface KidStats {
  days: DayPoint[];
  moodAvg: number | null;
  prevMoodAvg: number | null;
  lowMoodDays: string[];
  checkinsThisWeek: number;
  streak: number;
  checkedInToday: boolean;
  topTags: { tag: CheckinTag; count: number }[];
  questsDone: number;
  prevQuestsDone: number;
  doneByCategory: Record<QuestCategory, number>;
  openQuests: Quest[];
  overdueQuests: Quest[];
  proposedQuests: Quest[];
  screenAvg: number | null;
  screenDaysCounted: number;
  overBudgetDays: number;
  todayUsed: number;
  todayAllowance: number;
  energyLink: EnergyLink;
  points: number;
  recentNotes: TeacherNote[];
  pendingRequests: TimeRequest[];
}

export interface Signal {
  id: string;
  tone: 'positive' | 'watch' | 'neutral';
  title: string;
  detail: string;
}

const average = (values: number[]) =>
  values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;

export function isInClass(ws: Workspace, id: string): boolean {
  return ws.classroom.students.some((s) => s.id === id);
}

export function studentShares(ws: Workspace, student: Student): boolean {
  const kid = ws.kids.find((k) => k.id === student.id);
  return kid ? kid.shareWithTeacher : student.sharesWellbeing;
}

export function notesFor(ws: Workspace, kidId: string): TeacherNote[] {
  const inClass = isInClass(ws, kidId);
  return ws.notes
    .filter((n) => n.studentId === kidId || (n.studentId === null && inClass))
    .sort((a, b) => b.createdOn.localeCompare(a.createdOn));
}

export function kidStats(ws: Workspace, kidId: string, today: string): KidStats {
  const kid = ws.kids.find((k) => k.id === kidId);
  const budget = kid?.dailyScreenMinutes ?? 0;
  const dates = lastNDays(today, 14);
  const checkins = new Map(ws.checkins.filter((c) => c.kidId === kidId).map((c) => [c.date, c]));
  const screen = new Map(ws.screen.filter((s) => s.kidId === kidId).map((s) => [s.date, s]));
  const quests = ws.quests.filter((q) => q.kidId === kidId);
  const done = quests.filter((q) => q.status === 'done');

  const days: DayPoint[] = dates.map((date) => {
    const c = checkins.get(date);
    const s = screen.get(date);
    return {
      date,
      mood: c?.mood ?? null,
      energy: c?.energy ?? null,
      tags: c?.tags ?? [],
      note: c?.note,
      screen: s ? s.minutes : null,
      allowance: budget + (s?.bonusMinutes ?? 0),
      questsDone: done.filter((q) => q.completedOn === date).map((q) => q.title),
    };
  });
  const lastWeek = days.slice(0, 7);
  const thisWeek = days.slice(7);
  const moods = (ds: DayPoint[]) => ds.flatMap((d) => (d.mood === null ? [] : [d.mood]));

  let streak = 0;
  for (let cursor = checkins.has(today) ? today : addDays(today, -1); checkins.has(cursor); cursor = addDays(cursor, -1)) {
    streak++;
  }

  const tagCounts = new Map<CheckinTag, number>();
  for (const day of thisWeek) {
    for (const tag of day.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }

  const inWeek = (ds: DayPoint[]) => {
    const set = new Set(ds.map((d) => d.date));
    return done.filter((q) => q.completedOn && set.has(q.completedOn));
  };
  const doneThisWeek = inWeek(thisWeek);
  const openQuests = quests.filter((q) => q.status === 'open');

  const fullDays = thisWeek.filter((d) => d.date !== today && d.screen !== null);
  const energyLink: EnergyLink = { overDays: 0, lowAfterOver: 0, otherDays: 0, lowAfterOther: 0 };
  for (let i = 1; i < days.length; i++) {
    const prev = days[i - 1];
    const day = days[i];
    if (prev.screen === null || day.energy === null) continue;
    const low = day.energy === 'low' ? 1 : 0;
    if (prev.screen > prev.allowance) {
      energyLink.overDays++;
      energyLink.lowAfterOver += low;
    } else {
      energyLink.otherDays++;
      energyLink.lowAfterOther += low;
    }
  }

  const todayPoint = days[days.length - 1];
  return {
    days,
    moodAvg: average(moods(thisWeek)),
    prevMoodAvg: average(moods(lastWeek)),
    lowMoodDays: thisWeek.filter((d) => d.mood !== null && d.mood <= 2).map((d) => d.date),
    checkinsThisWeek: moods(thisWeek).length,
    streak,
    checkedInToday: checkins.has(today),
    topTags: [...tagCounts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count),
    questsDone: doneThisWeek.length,
    prevQuestsDone: inWeek(lastWeek).length,
    doneByCategory: Object.fromEntries(
      QUEST_CATEGORIES.map((c) => [c, doneThisWeek.filter((q) => q.category === c).length]),
    ) as Record<QuestCategory, number>,
    openQuests,
    overdueQuests: openQuests.filter((q) => q.dueDate !== undefined && q.dueDate < today),
    proposedQuests: quests.filter((q) => q.status === 'proposed'),
    screenAvg: average(fullDays.map((d) => d.screen ?? 0)),
    screenDaysCounted: fullDays.length,
    overBudgetDays: fullDays.filter((d) => (d.screen ?? 0) > d.allowance).length,
    todayUsed: todayPoint.screen ?? 0,
    todayAllowance: todayPoint.allowance,
    energyLink,
    points: done.reduce((sum, q) => sum + q.points, 0) + checkins.size * 5,
    recentNotes: notesFor(ws, kidId).filter((n) => daysBetween(n.createdOn, today) <= 7),
    pendingRequests: ws.requests.filter((r) => r.kidId === kidId && r.status === 'pending'),
  };
}

const oneDecimal = (n: number) => n.toFixed(1);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function kidSignals(ws: Workspace, kid: Kid, stats: KidStats): Signal[] {
  const signals: Signal[] = [];
  const { moodAvg, prevMoodAvg } = stats;

  if (moodAvg !== null) {
    const delta = prevMoodAvg === null ? 0 : moodAvg - prevMoodAvg;
    const vsLastWeek = prevMoodAvg === null ? '' : `, vs ${oneDecimal(prevMoodAvg)} last week`;
    if (delta <= -0.5) {
      signals.push({ id: 'mood-trend', tone: 'watch', title: 'Mood dipped this week', detail: `Averaged ${oneDecimal(moodAvg)}/5${vsLastWeek}.` });
    } else if (delta >= 0.5) {
      signals.push({ id: 'mood-trend', tone: 'positive', title: 'Mood is up this week', detail: `Averaged ${oneDecimal(moodAvg)}/5${vsLastWeek}.` });
    } else {
      signals.push({ id: 'mood-trend', tone: 'neutral', title: 'Mood holding steady', detail: `Averaged ${oneDecimal(moodAvg)}/5${vsLastWeek}.` });
    }
  }

  if (stats.lowMoodDays.length >= 2) {
    const lowTags = new Set(
      stats.days.filter((d) => stats.lowMoodDays.includes(d.date)).flatMap((d) => d.tags),
    );
    const tagText = lowTags.size ? ` Tagged: ${[...lowTags].join(', ')}.` : '';
    signals.push({
      id: 'low-days',
      tone: 'watch',
      title: `${stats.lowMoodDays.length} tough days`,
      detail: `${stats.lowMoodDays.map(weekday).join(' and ')} were rated 2/5 or lower.${tagText}`,
    });
  }

  const link = stats.energyLink;
  const overRate = link.overDays ? link.lowAfterOver / link.overDays : 0;
  const otherRate = link.otherDays ? link.lowAfterOther / link.otherDays : 0;
  if (link.overDays >= 2 && overRate >= 0.5 && overRate - otherRate >= 0.3) {
    signals.push({
      id: 'energy-link',
      tone: 'watch',
      title: 'Heavy screen days → low energy',
      detail: `Energy was low the day after ${link.lowAfterOver} of ${plural(link.overDays, 'over-budget day')}, vs ${link.lowAfterOther} of ${link.otherDays} other days.`,
    });
  }

  if (stats.screenAvg !== null && stats.overBudgetDays >= 3) {
    signals.push({
      id: 'screen-budget',
      tone: 'watch',
      title: `Over screen budget ${stats.overBudgetDays} of the last ${stats.screenDaysCounted} days`,
      detail: `Averaging ${Math.round(stats.screenAvg)} min/day against a ${kid.dailyScreenMinutes}-minute budget (plus earned bonus time).`,
    });
  } else if (stats.screenAvg !== null && stats.screenDaysCounted >= 5 && stats.overBudgetDays === 0) {
    signals.push({
      id: 'screen-budget',
      tone: 'positive',
      title: 'Stayed within the screen budget',
      detail: `Averaging ${Math.round(stats.screenAvg)} min/day, inside the ${kid.dailyScreenMinutes}-minute budget every day.`,
    });
  }

  const topCategory = QUEST_CATEGORIES.slice().sort((a, b) => stats.doneByCategory[b] - stats.doneByCategory[a])[0];
  const questDetail = `${plural(stats.questsDone, 'quest')} done this week (${stats.prevQuestsDone} last week)${stats.questsDone ? `, mostly ${topCategory}` : ''}.`;
  if (stats.questsDone >= stats.prevQuestsDone + 2) {
    signals.push({ id: 'quests', tone: 'positive', title: 'Quest momentum', detail: questDetail });
  } else if (stats.questsDone + 2 <= stats.prevQuestsDone) {
    signals.push({ id: 'quests', tone: 'watch', title: 'Fewer quests this week', detail: questDetail });
  } else if (stats.questsDone > 0) {
    signals.push({ id: 'quests', tone: 'neutral', title: 'Steady on quests', detail: questDetail });
  }

  if (stats.overdueQuests.length) {
    signals.push({
      id: 'overdue',
      tone: 'watch',
      title: `${plural(stats.overdueQuests.length, 'quest')} overdue`,
      detail: stats.overdueQuests.map((q) => q.title).join(', '),
    });
  }

  if (stats.streak >= 5) {
    signals.push({ id: 'streak', tone: 'positive', title: `${stats.streak}-day check-in streak`, detail: `${kid.name} has checked in every day for ${stats.streak} days.` });
  }

  const topTag = stats.topTags[0];
  if (topTag && topTag.count >= 3) {
    signals.push({ id: 'tags', tone: 'neutral', title: `“${topTag.tag}” came up ${topTag.count} times`, detail: `Most frequent check-in tag this week.` });
  }

  const note = stats.recentNotes[0];
  if (note) {
    signals.push({
      id: 'teacher-note',
      tone: 'neutral',
      title: `Note from ${ws.classroom.teacherName}`,
      detail: note.body.length > 140 ? `${note.body.slice(0, 137)}…` : note.body,
    });
  }

  if (stats.pendingRequests.length || stats.proposedQuests.length) {
    const parts = [
      stats.pendingRequests.length ? plural(stats.pendingRequests.length, 'screen-time request') : '',
      stats.proposedQuests.length ? plural(stats.proposedQuests.length, 'quest idea') : '',
    ].filter(Boolean);
    signals.push({ id: 'requests', tone: 'neutral', title: `${kid.name} is waiting on you`, detail: `${parts.join(' and ')} to review.` });
  }

  return signals;
}

export interface StudentRow {
  student: Student;
  shares: boolean;
  moods: (number | null)[];
  moodAvg: number | null;
  lowDays: number;
  checkins: number;
  tags: CheckinTag[];
  tasksDone: number;
  tasksTotal: number;
}

export function classRows(ws: Workspace, today: string): StudentRow[] {
  const week = lastNDays(today, 7);
  return ws.classroom.students.map((student) => {
    const shares = studentShares(ws, student);
    const byDate = new Map(ws.checkins.filter((c) => c.kidId === student.id).map((c) => [c.date, c]));
    const moods = week.map((d) => (shares ? (byDate.get(d)?.mood ?? null) : null));
    const present = moods.filter((m): m is number => m !== null);
    const tagCounts = new Map<CheckinTag, number>();
    if (shares) {
      for (const d of week) for (const t of byDate.get(d)?.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
    const tasks = ws.quests.filter((q) => q.kidId === student.id && q.source === 'teacher');
    return {
      student,
      shares,
      moods,
      moodAvg: average(present),
      lowDays: present.filter((m) => m <= 2).length,
      checkins: present.length,
      tags: [...tagCounts].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t),
      tasksDone: tasks.filter((q) => q.status === 'done').length,
      tasksTotal: tasks.length,
    };
  });
}
