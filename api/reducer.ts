import { randomUUID } from 'node:crypto';
import type { Action } from '../shared/actions';
import { MOOD_EMOJI, MOOD_LABELS } from '../shared/types';
import type { Kid, Quest, Role, ScreenDay, Workspace } from '../shared/types';
import { HttpError } from './http-error';

const MAX_ACTIVITY = 60;
const MAX_SCREEN_MINUTES = 1440;

const newId = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}`;

export function applyAction(ws: Workspace, action: Action, today: string, now: string): Workspace {
  const next = structuredClone(ws);

  const log = (actor: Role, text: string, kidId?: string) => {
    next.activity.unshift({ id: newId('a'), at: now, actor, kidId, text });
    next.activity.length = Math.min(next.activity.length, MAX_ACTIVITY);
  };
  const kid = (kidId: string): Kid => {
    const found = next.kids.find((k) => k.id === kidId);
    if (!found) throw new HttpError(404, 'Unknown kid');
    return found;
  };
  const familyQuest = (questId: string): Quest => {
    const found = next.quests.find((q) => q.id === questId && next.kids.some((k) => k.id === q.kidId));
    if (!found) throw new HttpError(404, 'Unknown quest');
    return found;
  };
  const screenToday = (kidId: string): ScreenDay => {
    let entry = next.screen.find((s) => s.kidId === kidId && s.date === today);
    if (!entry) {
      entry = { kidId, date: today, minutes: 0, bonusMinutes: 0 };
      next.screen.push(entry);
    }
    return entry;
  };

  switch (action.type) {
    case 'check-in': {
      const k = kid(action.kidId);
      next.checkins = next.checkins.filter((c) => !(c.kidId === k.id && c.date === today));
      next.checkins.push({
        id: newId('c'),
        kidId: k.id,
        date: today,
        mood: action.mood,
        energy: action.energy,
        tags: action.tags,
        note: action.note || undefined,
      });
      log('kid', `${k.name} checked in feeling ${MOOD_EMOJI[action.mood - 1]} ${MOOD_LABELS[action.mood - 1]}`, k.id);
      break;
    }
    case 'complete-quest': {
      const q = familyQuest(action.questId);
      if (q.status !== 'open') throw new HttpError(409, 'That quest is not open');
      const k = kid(q.kidId);
      q.status = 'done';
      q.completedOn = today;
      screenToday(k.id).bonusMinutes += k.bonusMinutesPerQuest;
      log('kid', `${k.name} completed “${q.title}” (+${q.points} pts, +${k.bonusMinutesPerQuest} min)`, k.id);
      break;
    }
    case 'add-quest': {
      const k = kid(action.kidId);
      next.quests.push({ ...action.quest, id: newId('q'), kidId: k.id, source: action.source, status: 'open', createdOn: today });
      log('parent', `${next.parentName} added “${action.quest.title}” for ${k.name}`, k.id);
      break;
    }
    case 'propose-quest': {
      const k = kid(action.kidId);
      next.quests.push({
        id: newId('q'),
        kidId: k.id,
        title: action.title,
        category: action.category,
        points: 15,
        source: 'kid',
        status: 'proposed',
        createdOn: today,
      });
      log('kid', `${k.name} suggested a quest: “${action.title}”`, k.id);
      break;
    }
    case 'review-quest': {
      const q = familyQuest(action.questId);
      if (q.status !== 'proposed') throw new HttpError(409, 'That quest is not waiting for review');
      const k = kid(q.kidId);
      if (action.approve) {
        q.status = 'open';
      } else {
        next.quests = next.quests.filter((other) => other.id !== q.id);
      }
      log('parent', `${next.parentName} ${action.approve ? 'approved' : 'passed on'} “${q.title}”`, k.id);
      break;
    }
    case 'request-time': {
      const k = kid(action.kidId);
      next.requests.push({ id: newId('r'), kidId: k.id, minutes: action.minutes, reason: action.reason, status: 'pending', createdOn: today });
      log('kid', `${k.name} asked for ${action.minutes} extra minutes of screen time`, k.id);
      break;
    }
    case 'decide-request': {
      const request = next.requests.find((r) => r.id === action.requestId);
      if (!request) throw new HttpError(404, 'Unknown request');
      if (request.status !== 'pending') throw new HttpError(409, 'That request was already answered');
      const k = kid(request.kidId);
      request.status = action.approve ? 'approved' : 'declined';
      if (action.approve) screenToday(k.id).bonusMinutes += request.minutes;
      log(
        'parent',
        action.approve
          ? `${next.parentName} approved ${request.minutes} extra minutes for ${k.name}`
          : `${next.parentName} said “not today” to ${k.name}’s request`,
        k.id,
      );
      break;
    }
    case 'log-screen': {
      const k = kid(action.kidId);
      const entry = screenToday(k.id);
      entry.minutes = Math.min(MAX_SCREEN_MINUTES, entry.minutes + action.minutes);
      log('kid', `${k.name} logged ${action.minutes} min of screen time`, k.id);
      break;
    }
    case 'set-budget': {
      const k = kid(action.kidId);
      k.dailyScreenMinutes = action.dailyScreenMinutes;
      log('parent', `${next.parentName} set ${k.name}’s daily screen budget to ${action.dailyScreenMinutes} min`, k.id);
      break;
    }
    case 'set-sharing': {
      const k = kid(action.kidId);
      k.shareWithTeacher = action.shareWithTeacher;
      log(
        'parent',
        `${next.parentName} ${action.shareWithTeacher ? 'started' : 'stopped'} sharing ${k.name}’s check-ins with ${next.classroom.teacherName}`,
        k.id,
      );
      break;
    }
    case 'post-note': {
      const { students, teacherName, name: className } = next.classroom;
      const target = action.studentId === null ? null : students.find((s) => s.id === action.studentId);
      if (target === undefined) throw new HttpError(404, 'Unknown student');
      next.notes.push({ id: newId('n'), studentId: target?.id ?? null, body: action.body, createdOn: today, questTitle: action.quest?.title });
      if (action.quest) {
        for (const student of target ? [target] : students) {
          next.quests.push({ ...action.quest, id: newId('q'), kidId: student.id, source: 'teacher', status: 'open', createdOn: today });
        }
      }
      log('teacher', `${teacherName} sent a note ${target ? `about ${target.name}` : `to ${className}`}`, target?.id);
      break;
    }
  }

  next.updatedAt = now;
  return next;
}
