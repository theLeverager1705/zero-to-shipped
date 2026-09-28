const DAY_MS = 86_400_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parse(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function format(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return format(parse(date) + days * DAY_MS);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to) - parse(from)) / DAY_MS);
}

export function lastNDays(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
}

export function weekday(date: string): string {
  return WEEKDAYS[new Date(parse(date)).getUTCDay()];
}

export function weekdayLong(date: string): string {
  return WEEKDAYS_LONG[new Date(parse(date)).getUTCDay()];
}

export function shortDate(date: string): string {
  const d = new Date(parse(date));
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function relativeDay(date: string, today: string): string {
  const diff = daysBetween(date, today);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return weekday(date);
  if (diff === -1) return 'Tomorrow';
  return shortDate(date);
}

export function dueLabel(dueDate: string, today: string): string {
  const diff = daysBetween(today, dueDate);
  if (diff < 0) return `overdue since ${shortDate(dueDate)}`;
  if (diff === 0) return 'due today';
  if (diff === 1) return 'due tomorrow';
  if (diff < 7) return `due ${weekdayLong(dueDate)}`;
  return `due ${shortDate(dueDate)}`;
}

export function localToday(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function utcToday(now = new Date()): string {
  return format(now.getTime());
}
