/** Start of calendar day in local time */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function setTime(date: Date, hours: number, minutes = 0): Date {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/** Inclusive list of dates from start through end */
export function eachDayOfInterval(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let current = startOfDay(start);
  const last = startOfDay(end);
  while (current <= last) {
    days.push(new Date(current));
    current = addDays(current, 1);
  }
  return days;
}

export function daysBetween(start: Date, end: Date): number {
  const a = startOfDay(start).getTime();
  const b = startOfDay(end).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

export function formatWeekdayShort(date: Date): string {
  return date.toLocaleDateString("en-PH", { weekday: "short" });
}
