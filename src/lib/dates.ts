/** Start of calendar day in local time */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Hotel timezone for front-desk calendar days (Philippines by default). */
export const HOTEL_TIMEZONE = process.env.HOTEL_TIMEZONE ?? "Asia/Manila";

/** Calendar date YYYY-MM-DD in the hotel timezone. */
export function hotelCalendarDate(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: HOTEL_TIMEZONE });
}

/** Parse YYYY-MM-DD as midnight in the hotel timezone. */
export function parseHotelCalendarDate(value: string): Date {
  if (HOTEL_TIMEZONE === "Asia/Manila") {
    return new Date(`${value}T00:00:00+08:00`);
  }
  const cal = value;
  return new Date(`${cal}T00:00:00`);
}

/** Start of today in the hotel timezone. */
export function startOfHotelDay(date: Date = new Date()): Date {
  return parseHotelCalendarDate(hotelCalendarDate(date));
}

/** Add calendar days in the hotel timezone. */
export function addHotelDays(date: Date, days: number): Date {
  const [y, m, d] = hotelCalendarDate(date).split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return parseHotelCalendarDate(shifted.toISOString().slice(0, 10));
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

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: HOTEL_TIMEZONE,
  });
}

export function formatDayOfMonth(date: Date): string {
  return date.toLocaleDateString("en-PH", {
    day: "numeric",
    timeZone: HOTEL_TIMEZONE,
  });
}

export function nextHotelCalendarDate(dateKey: string): string {
  return hotelCalendarDate(addHotelDays(parseHotelCalendarDate(dateKey), 1));
}
