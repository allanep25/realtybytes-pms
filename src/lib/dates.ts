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

/** Day of week (0=Sun) for a hotel calendar date key. */
export function hotelDayOfWeek(dateKey: string): number {
  const weekday = parseHotelCalendarDate(dateKey).toLocaleDateString("en-US", {
    timeZone: HOTEL_TIMEZONE,
    weekday: "short",
  });
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? 0;
}

/** Wall-clock time on a hotel calendar day (avoids UTC/server timezone drift). */
export function setHotelTime(date: Date | string, hours: number, minutes = 0): Date {
  const dateKey = typeof date === "string" ? date : hotelCalendarDate(date);
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  if (HOTEL_TIMEZONE === "Asia/Manila") {
    return new Date(`${dateKey}T${hh}:${mm}:00+08:00`);
  }
  return new Date(`${dateKey}T${hh}:${mm}:00`);
}

/** HH:mm for time inputs in the hotel timezone. */
export function hotelTimeInput(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: HOTEL_TIMEZONE,
  });
}

/** First day of a hotel calendar month. */
export function getHotelMonthStart(monthOffset = 0): Date {
  const [year, month] = hotelCalendarDate().split("-").map(Number);
  const monthIndex = month - 1 + monthOffset;
  const y = year + Math.floor(monthIndex / 12);
  const m = ((monthIndex % 12) + 12) % 12 + 1;
  return parseHotelCalendarDate(`${y}-${String(m).padStart(2, "0")}-01`);
}

/** Last day of the hotel calendar month containing `monthStart`. */
export function getHotelMonthEnd(monthStart: Date): Date {
  const startKey = hotelCalendarDate(monthStart);
  const [year, month] = startKey.split("-").map(Number);
  const monthIndex = month;
  const y = year + Math.floor(monthIndex / 12);
  const m = ((monthIndex % 12) + 12) % 12 + 1;
  return addHotelDays(parseHotelCalendarDate(`${y}-${String(m).padStart(2, "0")}-01`), -1);
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

/** Inclusive hotel-calendar days from start through end (Asia/Manila by default). */
export function eachHotelDayOfInterval(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let current = parseHotelCalendarDate(hotelCalendarDate(start));
  const last = parseHotelCalendarDate(hotelCalendarDate(end));
  while (current.getTime() <= last.getTime()) {
    days.push(new Date(current));
    current = addHotelDays(current, 1);
  }
  return days;
}

export function daysBetween(start: Date, end: Date): number {
  const a = parseHotelCalendarDate(hotelCalendarDate(start)).getTime();
  const b = parseHotelCalendarDate(hotelCalendarDate(end)).getTime();
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
