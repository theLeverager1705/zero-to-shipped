export const MOOD_LABELS = ['Rough', 'Meh', 'Okay', 'Good', 'Great'] as const;
export const MOOD_EMOJI = ['😣', '😕', '😐', '🙂', '😄'] as const;
export const ENERGY_LEVELS = ['low', 'ok', 'high'] as const;
export const CHECKIN_TAGS = [
  'school',
  'friends',
  'family',
  'sleep',
  'sports',
  'screens',
  'worried',
  'excited',
  'proud',
  'bored',
] as const;
export const QUEST_CATEGORIES = ['learning', 'life', 'wellbeing', 'school'] as const;

export type Energy = (typeof ENERGY_LEVELS)[number];
export type CheckinTag = (typeof CHECKIN_TAGS)[number];
export type QuestCategory = (typeof QUEST_CATEGORIES)[number];
export type Role = 'parent' | 'kid' | 'teacher';

export interface Kid {
  id: string;
  name: string;
  age: number;
  grade: string;
  avatar: string;
  interests: string[];
  dailyScreenMinutes: number;
  bonusMinutesPerQuest: number;
  shareWithTeacher: boolean;
}

export interface CheckIn {
  id: string;
  kidId: string;
  date: string;
  mood: number;
  energy: Energy;
  tags: CheckinTag[];
  note?: string;
}

export interface Quest {
  id: string;
  kidId: string;
  title: string;
  category: QuestCategory;
  points: number;
  source: 'parent' | 'kid' | 'teacher' | 'ai';
  status: 'proposed' | 'open' | 'done';
  dueDate?: string;
  createdOn: string;
  completedOn?: string;
}

export interface ScreenDay {
  kidId: string;
  date: string;
  minutes: number;
  bonusMinutes: number;
}

export interface TimeRequest {
  id: string;
  kidId: string;
  minutes: number;
  reason: string;
  status: 'pending' | 'approved' | 'declined';
  createdOn: string;
}

export interface TeacherNote {
  id: string;
  studentId: string | null;
  body: string;
  createdOn: string;
  questTitle?: string;
}

export interface Student {
  id: string;
  name: string;
  avatar: string;
  sharesWellbeing: boolean;
}

export interface Classroom {
  name: string;
  teacherName: string;
  students: Student[];
}

export interface ActivityItem {
  id: string;
  at: string;
  actor: Role;
  kidId?: string;
  text: string;
}

export interface AiResult<T> {
  data: T;
  source: 'claude' | 'rules';
  model?: string;
  generatedOn: string;
  note?: string;
}

export interface WeeklyBrief {
  headline: string;
  wins: string[];
  watch: string[];
  pattern: string | null;
  conversationStarters: string[];
  nextWeek: { title: string; category: QuestCategory; why: string }[];
  signalsUsed: string[];
}

export interface QuestIdea {
  title: string;
  category: QuestCategory;
  points: number;
  why: string;
}

export interface ClassPulse {
  summary: string;
  highlights: string[];
  checkIns: { student: string; reason: string }[];
  ideas: string[];
}

export interface Workspace {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  familyName: string;
  parentName: string;
  kids: Kid[];
  classroom: Classroom;
  checkins: CheckIn[];
  quests: Quest[];
  screen: ScreenDay[];
  requests: TimeRequest[];
  notes: TeacherNote[];
  activity: ActivityItem[];
  briefs: Record<string, AiResult<WeeklyBrief>>;
  pulse?: AiResult<ClassPulse>;
  aiUsage: { date: string; count: number };
}
