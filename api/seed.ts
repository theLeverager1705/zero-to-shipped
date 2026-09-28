import { addDays, weekdayLong } from '../shared/dates';
import type {
  ActivityItem,
  CheckIn,
  CheckinTag,
  Energy,
  Kid,
  Quest,
  QuestCategory,
  ScreenDay,
  Student,
  TeacherNote,
  Workspace,
} from '../shared/types';

type Day = [mood: number, energy: Energy, tags: CheckinTag[], note?: string];
type DoneQuest = { title: string; category: QuestCategory; points: number; source: Quest['source']; days: number[] };
type OpenQuest = Omit<Quest, 'id' | 'status' | 'completedOn'>;
type Peer = { student: Student; moods: (number | null)[]; tags: CheckinTag[][]; lowTags: CheckinTag[]; outlineDoneOn?: number };

const MAYA = 'kid-maya';
const THEO = 'kid-theo';
const OUTLINE = 'Finish science fair outline';

// Day index 0 is 13 days ago, 13 is today.
const MAYA_DAYS: Day[] = [
  [4, 'ok', ['school', 'friends']],
  [4, 'high', ['sports', 'proud']],
  [4, 'low', ['sleep']],
  [5, 'high', ['friends', 'excited']],
  [4, 'ok', ['school']],
  [3, 'low', ['screens', 'sleep']],
  [4, 'ok', ['family']],
  [4, 'ok', ['school', 'proud']],
  [5, 'high', ['friends', 'excited']],
  [4, 'ok', ['sports']],
  [2, 'low', ['school', 'friends', 'worried'], 'group project is stressing me out'],
  [2, 'low', ['friends', 'worried'], 'lunch was weird with Zoe and Priya'],
  [3, 'low', ['sleep', 'school'], 'stayed up too late watching videos'],
];

const THEO_DAYS: Day[] = [
  [4, 'high', ['family']],
  [5, 'high', ['excited']],
  [4, 'ok', ['school']],
  [4, 'ok', ['friends', 'sports']],
  [5, 'high', ['proud']],
  [3, 'ok', ['bored']],
  [4, 'ok', ['family']],
  [5, 'high', ['excited', 'friends']],
  [4, 'ok', ['school']],
  [5, 'high', ['proud']],
  [4, 'ok', ['sports']],
  [4, 'ok', ['bored', 'school']],
  [5, 'high', ['proud'], 'I know my 5 times tables!!'],
  [5, 'high', ['excited'], 'I built a dino museum in Minecraft'],
];

const MAYA_SCREEN = [70, 85, 60, 80, 125, 135, 75, 70, 95, 130, 140, 120, 80, 35];
const THEO_SCREEN = [55, 70, 50, 65, 60, 75, 55, 70, 60, 75, 65, 60, 70, 20];

const MAYA_DONE: DoneQuest[] = [
  { title: 'Read 20 minutes', category: 'learning', points: 15, source: 'parent', days: [1, 3, 5, 8, 11, 12] },
  { title: 'Fractions practice set', category: 'learning', points: 20, source: 'parent', days: [7, 8, 9] },
  { title: 'Bake banana bread together', category: 'life', points: 25, source: 'kid', days: [6] },
  { title: 'Volleyball practice', category: 'wellbeing', points: 15, source: 'parent', days: [1, 4, 9] },
  { title: 'Tidy desk + backpack reset', category: 'life', points: 10, source: 'parent', days: [0, 7] },
  { title: 'Phone in the kitchen by 9pm', category: 'wellbeing', points: 20, source: 'ai', days: [2, 3] },
];

const THEO_DONE: DoneQuest[] = [
  { title: 'Read 15 minutes', category: 'learning', points: 15, source: 'parent', days: [0, 1, 2, 4, 5, 8, 12] },
  { title: '5× tables practice', category: 'learning', points: 20, source: 'parent', days: [7, 9, 10, 12] },
  { title: 'Feed Biscuit 🐶', category: 'life', points: 5, source: 'parent', days: [1, 3, 5, 7, 9, 11] },
];

const PEERS: Peer[] = [
  { student: { id: 'stu-leo', name: 'Leo', avatar: '🐢', sharesWellbeing: true }, moods: [4, 4, 5, 4, 4, 4, 5, 4, 4, 5, 4, 4, 5, 4], tags: [['sports'], ['friends']], lowTags: ['school'], outlineDoneOn: 10 },
  { student: { id: 'stu-aisha', name: 'Aisha', avatar: '🦋', sharesWellbeing: true }, moods: [4, 5, 4, 4, 5, 4, 4, 4, 4, 4, 3, 3, 4, 4], tags: [['school'], ['friends', 'excited']], lowTags: ['school', 'worried'], outlineDoneOn: 11 },
  { student: { id: 'stu-sam', name: 'Sam', avatar: '🐙', sharesWellbeing: false }, moods: [4, 4, 4, 3, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4], tags: [['family']], lowTags: ['bored'], outlineDoneOn: 11 },
  { student: { id: 'stu-priya', name: 'Priya', avatar: '🌻', sharesWellbeing: true }, moods: [3, 4, 4, 3, 4, 4, 4, 4, 3, 4, 4, 3, 4, null], tags: [['friends'], ['family']], lowTags: ['friends'] },
  { student: { id: 'stu-noah', name: 'Noah', avatar: '🚀', sharesWellbeing: true }, moods: [5, 4, 5, 5, 4, 5, 5, 5, 4, 5, 4, 2, 4, 5], tags: [['excited'], ['sports']], lowTags: ['worried', 'school'], outlineDoneOn: 12 },
  { student: { id: 'stu-zoe', name: 'Zoe', avatar: '🎧', sharesWellbeing: false }, moods: [4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, null], tags: [['friends']], lowTags: ['friends'] },
  { student: { id: 'stu-mateo', name: 'Mateo', avatar: '⚽', sharesWellbeing: true }, moods: [4, 3, 4, 4, 3, 4, 4, 3, 3, 2, 3, 2, 2, null], tags: [['sleep'], ['family']], lowTags: ['sleep', 'worried'] },
];

export function seedWorkspace(id: string, today: string, now: string): Workspace {
  const day = (i: number) => addDays(today, i - 13);
  const at = (i: number, time: string) => `${day(i)}T${time}:00.000Z`;
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}-${++seq}`;
  const dueDate = addDays(today, 2);

  const kids: Kid[] = [
    { id: MAYA, name: 'Maya', age: 11, grade: '6th grade', avatar: '🦊', interests: ['baking', 'drawing', 'volleyball'], dailyScreenMinutes: 90, bonusMinutesPerQuest: 10, shareWithTeacher: true },
    { id: THEO, name: 'Theo', age: 8, grade: '3rd grade', avatar: '🦖', interests: ['Minecraft', 'dinosaurs', 'LEGO'], dailyScreenMinutes: 60, bonusMinutesPerQuest: 10, shareWithTeacher: true },
  ];
  const students: Student[] = [{ id: MAYA, name: 'Maya', avatar: '🦊', sharesWellbeing: true }, ...PEERS.map((p) => p.student)];

  const checkins: CheckIn[] = [];
  const addCheckins = (kidId: string, days: Day[]) =>
    days.forEach(([mood, energy, tags, note], i) => checkins.push({ id: nextId('c'), kidId, date: day(i), mood, energy, tags, note }));
  addCheckins(MAYA, MAYA_DAYS);
  addCheckins(THEO, THEO_DAYS);
  for (const peer of PEERS) {
    peer.moods.forEach((mood, i) => {
      if (mood === null) return;
      const energy: Energy = mood >= 5 ? 'high' : mood <= 2 ? 'low' : 'ok';
      const tags = mood <= 2 ? peer.lowTags : peer.tags[i % peer.tags.length];
      checkins.push({ id: nextId('c'), kidId: peer.student.id, date: day(i), mood, energy, tags });
    });
  }

  const quests: Quest[] = [];
  const addDone = (kidId: string, done: DoneQuest[]) => {
    for (const { days, ...quest } of done) {
      for (const i of days) {
        quests.push({ ...quest, id: nextId('q'), kidId, status: 'done', createdOn: day(Math.max(0, i - 1)), completedOn: day(i) });
      }
    }
  };
  addDone(MAYA, MAYA_DONE);
  addDone(THEO, THEO_DONE);

  const open: OpenQuest[] = [
    { kidId: MAYA, title: 'Fractions practice set', category: 'learning', points: 20, source: 'parent', createdOn: day(12) },
    { kidId: MAYA, title: 'Read 20 minutes', category: 'learning', points: 15, source: 'parent', createdOn: day(13) },
    { kidId: MAYA, title: 'Phone in the kitchen by 9pm', category: 'wellbeing', points: 20, source: 'parent', createdOn: day(11) },
    { kidId: THEO, title: 'Read 15 minutes', category: 'learning', points: 15, source: 'parent', createdOn: day(13) },
    { kidId: THEO, title: 'Feed Biscuit 🐶', category: 'life', points: 5, source: 'parent', createdOn: day(13) },
    { kidId: THEO, title: 'Build a LEGO bridge that holds a book', category: 'learning', points: 25, source: 'ai', createdOn: day(10) },
  ];
  for (const quest of open) quests.push({ ...quest, id: nextId('q'), status: 'open' });
  quests.push({ id: nextId('q'), kidId: MAYA, title: 'Bake cookies for the class bake sale', category: 'life', points: 15, source: 'kid', status: 'proposed', createdOn: day(12) });

  const outlineDone = new Map(PEERS.map((p) => [p.student.id, p.outlineDoneOn]));
  for (const student of students) {
    const doneOn = outlineDone.get(student.id);
    quests.push({
      id: nextId('q'),
      kidId: student.id,
      title: OUTLINE,
      category: 'school',
      points: 30,
      source: 'teacher',
      status: doneOn === undefined ? 'open' : 'done',
      dueDate,
      createdOn: day(6),
      completedOn: doneOn === undefined ? undefined : day(doneOn),
    });
  }

  const screen: ScreenDay[] = [];
  const addScreen = (kid: Kid, minutes: number[]) =>
    minutes.forEach((m, i) => {
      const doneCount = quests.filter((q) => q.kidId === kid.id && q.completedOn === day(i)).length;
      screen.push({ kidId: kid.id, date: day(i), minutes: m, bonusMinutes: doneCount * kid.bonusMinutesPerQuest });
    });
  addScreen(kids[0], MAYA_SCREEN);
  addScreen(kids[1], THEO_SCREEN);

  const notes: TeacherNote[] = [
    { id: nextId('n'), studentId: null, body: 'Welcome to our fractions & ratios unit! Practice sets are optional, but ten minutes a day really adds up.', createdOn: day(0) },
    {
      id: nextId('n'),
      studentId: null,
      body: `Science fair season! Please finish your project outline by ${weekdayLong(dueDate)} using the planning sheet from class. Families: ask your kid what question they are investigating.`,
      createdOn: day(6),
      questTitle: OUTLINE,
    },
    {
      id: nextId('n'),
      studentId: MAYA,
      body: 'Maya was quieter than usual during group work this week. Her ideas are strong when she shares them! A little encouragement at home before the outline deadline could really help.',
      createdOn: day(10),
    },
  ];

  const activity: ActivityItem[] = [
    { id: nextId('a'), at: at(13, '14:05'), actor: 'kid', kidId: THEO, text: 'Theo asked for 20 extra minutes of screen time' },
    { id: nextId('a'), at: at(13, '13:40'), actor: 'kid', kidId: THEO, text: 'Theo checked in feeling 😄 Great' },
    { id: nextId('a'), at: at(12, '23:10'), actor: 'kid', kidId: MAYA, text: 'Maya suggested a quest: “Bake cookies for the class bake sale”' },
    { id: nextId('a'), at: at(12, '21:30'), actor: 'kid', kidId: THEO, text: 'Theo completed “5× tables practice” (+20 pts, +10 min)' },
    { id: nextId('a'), at: at(10, '20:05'), actor: 'teacher', kidId: MAYA, text: 'Ms. Okafor sent a note about Maya' },
    { id: nextId('a'), at: at(6, '15:00'), actor: 'teacher', text: 'Ms. Okafor posted to Class 6B and added “Finish science fair outline”' },
  ];

  return {
    id,
    version: 1,
    createdAt: now,
    updatedAt: now,
    familyName: 'The Rivera family',
    parentName: 'Jordan',
    kids,
    classroom: { name: 'Class 6B', teacherName: 'Ms. Okafor', students },
    checkins,
    quests,
    screen,
    requests: [{ id: nextId('r'), kidId: THEO, minutes: 20, reason: 'Can I have 20 more minutes of Minecraft? I want to finish my dino museum!', status: 'pending', createdOn: today }],
    notes,
    activity,
    briefs: {},
    aiUsage: { date: today, count: 0 },
  };
}
