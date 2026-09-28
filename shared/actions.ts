import { z } from 'zod';
import { CHECKIN_TAGS, ENERGY_LEVELS, QUEST_CATEGORIES } from './types';

const id = z.string().min(1).max(64);
const title = z.string().trim().min(2).max(80);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const category = z.enum(QUEST_CATEGORIES);

export const QuestDraftSchema = z.object({
  title,
  category,
  points: z.number().int().min(5).max(50),
  dueDate: date.optional(),
});

export const ActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('check-in'),
    kidId: id,
    mood: z.number().int().min(1).max(5),
    energy: z.enum(ENERGY_LEVELS),
    tags: z.array(z.enum(CHECKIN_TAGS)).max(5),
    note: z.string().trim().max(280).optional(),
  }),
  z.object({ type: z.literal('complete-quest'), questId: id }),
  z.object({ type: z.literal('add-quest'), kidId: id, quest: QuestDraftSchema, source: z.enum(['parent', 'ai']) }),
  z.object({ type: z.literal('propose-quest'), kidId: id, title, category }),
  z.object({ type: z.literal('review-quest'), questId: id, approve: z.boolean() }),
  z.object({
    type: z.literal('request-time'),
    kidId: id,
    minutes: z.number().int().min(5).max(120),
    reason: z.string().trim().min(2).max(200),
  }),
  z.object({ type: z.literal('decide-request'), requestId: id, approve: z.boolean() }),
  z.object({ type: z.literal('log-screen'), kidId: id, minutes: z.number().int().min(1).max(600) }),
  z.object({ type: z.literal('set-budget'), kidId: id, dailyScreenMinutes: z.number().int().min(0).max(600) }),
  z.object({ type: z.literal('set-sharing'), kidId: id, shareWithTeacher: z.boolean() }),
  z.object({
    type: z.literal('post-note'),
    studentId: id.nullable(),
    body: z.string().trim().min(2).max(600),
    quest: QuestDraftSchema.optional(),
  }),
]);

export type Action = z.infer<typeof ActionSchema>;
export type QuestDraft = z.infer<typeof QuestDraftSchema>;

export const KidRequestSchema = z.object({ kidId: id });

export const CoachRequestSchema = z.object({
  kidId: id,
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(1500) }))
    .min(1)
    .max(16)
    .refine(
      (msgs) => msgs.every((m, i) => m.role === (i % 2 === 0 ? 'user' : 'assistant')) && msgs.length % 2 === 1,
      'Messages must alternate user/assistant and end with a user message',
    ),
});

export const QuestIdeasRequestSchema = z.object({ kidId: id, goal: z.string().trim().min(3).max(300) });

export type CoachMessage = z.infer<typeof CoachRequestSchema>['messages'][number];
