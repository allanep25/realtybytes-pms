import { prisma } from "@/lib/db";
import { addDays, daysBetween, eachDayOfInterval, startOfDay } from "@/lib/dates";
import { buildStayFolioLines, folioLinesTotal } from "@/lib/stay-pricing";
import { BookingType, Prisma, type ReservationStatus } from "@prisma/client";

export type ActivityItem = {
  id: string;
  guestName: string;
  roomNumber: string;
  time: Date;
};

export type TimelineBar = {
  id: string;
  roomNumber: string;
  guestName: string;
  startCol: number;
  span: number;
  colorClass: string;
  title: string;
  status: ReservationStatus;
  bookingType: BookingType;
  checkIn: string;
  checkOut: string;
};

export type ReservationTimelineSerialized = {
  rangeStart: string;
  rangeEnd: string;
  days: string[];
  roomNumbers: string[];
  bars: TimelineBar[];
  weekOffset: number;
};

export type ReservationDetail = {
  id: string;
  guestName: string;
  roomNumber: string;
  roomType: string;
  roomDescription: string;
  checkIn: string;
  checkOut: string;
  status: ReservationStatus;
  bookingType: BookingType;
  adults: number;
  children: number;
  extensionDays: number;
  extensionHours: number;
  estimatedTotal: number;
  scheduledArrival: string | null;
  scheduledDeparture: string | null;
};

export type ReservationTimelineData = {
  rangeStart: Date;
  rangeEnd: Date;
  days: Date[];
  roomNumbers: string[];
  bars: TimelineBar[];
};

export type TodayRevenue = {
  today: number;
  yesterday: number;
  changePercent: number | null;
};

function barColor(status: ReservationStatus, bookingType: BookingType): string {
  if (bookingType === "MAINTENANCE") return "bg-room-dirty";
  switch (status) {
    case "CHECKED_IN":
      return "bg-room-vacant";
    case "RESERVED":
      return "bg-room-reserved";
    case "CHECKED_OUT":
      return "bg-slate-400";
    default:
      return "bg-slate-300";
  }
}

function barLabel(status: ReservationStatus, bookingType: BookingType): string {
  if (bookingType === "MAINTENANCE") return "Maintenance";
  switch (status) {
    case "CHECKED_IN":
      return "Checked in";
    case "RESERVED":
      return "Reserved";
    default:
      return status.replace("_", " ");
  }
}

export function getTimelineRange(weekOffset = 0): { start: Date; end: Date } {
  const today = startOfDay(new Date());
  const anchor = addDays(today, -3 + weekOffset * 7);
  const start = startOfDay(anchor);
  const end = addDays(start, 6);
  return { start, end };
}

export function getDefaultTimelineRange(): { start: Date; end: Date } {
  return getTimelineRange(0);
}

export function serializeTimeline(
  data: ReservationTimelineData,
  weekOffset: number,
): ReservationTimelineSerialized {
  return {
    rangeStart: data.rangeStart.toISOString(),
    rangeEnd: data.rangeEnd.toISOString(),
    days: data.days.map((d) => d.toISOString()),
    roomNumbers: data.roomNumbers,
    bars: data.bars,
    weekOffset,
  };
}

export async function getReservationTimeline(
  rangeStart: Date,
  rangeEnd: Date,
): Promise<ReservationTimelineData> {
  const start = startOfDay(rangeStart);
  const end = startOfDay(rangeEnd);
  const days = eachDayOfInterval(start, end);
  const dayCount = days.length;

  const rooms = await prisma.room.findMany({
    orderBy: [{ floor: "asc" }, { number: "asc" }],
    select: { number: true },
  });
  const roomNumbers = rooms.map((r) => r.number);

  const rangeEndExclusive = addDays(end, 1);

  const reservations = await prisma.reservation.findMany({
    where: {
      checkIn: { lt: rangeEndExclusive },
      checkOut: { gt: start },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    include: {
      guest: { select: { fullName: true } },
      room: { select: { number: true } },
    },
    orderBy: { checkIn: "asc" },
  });

  const bars: TimelineBar[] = [];

  for (const res of reservations) {
    const checkIn = startOfDay(res.checkIn);
    const checkOut = startOfDay(res.checkOut);
    const visibleStart = checkIn < start ? start : checkIn;
    const visibleEnd = checkOut > end ? addDays(end, 1) : checkOut;

    const startCol = Math.round((visibleStart.getTime() - start.getTime()) / 86_400_000);
    const span = Math.max(
      1,
      Math.round((visibleEnd.getTime() - visibleStart.getTime()) / 86_400_000),
    );

    if (startCol >= dayCount || startCol + span <= 0) continue;

    const clampedStart = Math.max(0, startCol);
    const clampedSpan = Math.min(span, dayCount - clampedStart);

    bars.push({
      id: res.id,
      roomNumber: res.room.number,
      guestName:
        res.bookingType === "MAINTENANCE" ? "Maintenance" : res.guest.fullName,
      startCol: clampedStart,
      span: clampedSpan,
      colorClass: barColor(res.status, res.bookingType),
      title: `${res.room.number} — ${barLabel(res.status, res.bookingType)}`,
      status: res.status,
      bookingType: res.bookingType,
      checkIn: res.checkIn.toISOString(),
      checkOut: res.checkOut.toISOString(),
    });
  }

  return { rangeStart: start, rangeEnd: end, days, roomNumbers, bars };
}

export async function getTodayArrivals(): Promise<ActivityItem[]> {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);

  const rows = await prisma.reservation.findMany({
    where: {
      checkIn: { gte: today, lt: tomorrow },
      status: { in: ["RESERVED", "CHECKED_IN"] },
      bookingType: BookingType.GUEST,
    },
    include: {
      guest: { select: { fullName: true } },
      room: { select: { number: true } },
    },
    orderBy: { scheduledArrival: "asc" },
  });

  return rows.map((r) => ({
    id: r.id,
    guestName: r.guest.fullName,
    roomNumber: r.room.number,
    time: r.scheduledArrival ?? r.checkIn,
  }));
}

export async function getTodayDepartures(): Promise<ActivityItem[]> {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);

  const rows = await prisma.reservation.findMany({
    where: {
      checkOut: { gte: today, lt: tomorrow },
      status: { in: ["CHECKED_IN", "CHECKED_OUT"] },
      bookingType: BookingType.GUEST,
    },
    include: {
      guest: { select: { fullName: true } },
      room: { select: { number: true } },
    },
    orderBy: { scheduledDeparture: "asc" },
  });

  return rows.map((r) => ({
    id: r.id,
    guestName: r.guest.fullName,
    roomNumber: r.room.number,
    time: r.scheduledDeparture ?? r.checkOut,
  }));
}

export async function getTodayRevenue(): Promise<TodayRevenue> {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);
  const paidFilter = { gt: new Prisma.Decimal(0) };

  const todayFolios = await prisma.folio.findMany({
    where: {
      paidAt: { gte: today, lt: tomorrow, not: null },
      paid: paidFilter,
    },
    select: { paid: true },
  });

  const yesterdayFolios = await prisma.folio.findMany({
    where: {
      paidAt: { gte: yesterday, lt: today, not: null },
      paid: paidFilter,
    },
    select: { paid: true },
  });

  const sum = (rows: { paid: unknown }[]) =>
    rows.reduce((acc, r) => acc + Number(r.paid), 0);

  const todayTotal = sum(todayFolios);
  const yesterdayTotal = sum(yesterdayFolios);

  const changePercent =
    yesterdayTotal > 0
      ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100
      : todayTotal > 0
        ? 100
        : null;

  return { today: todayTotal, yesterday: yesterdayTotal, changePercent };
}

export async function getReservationById(id: string): Promise<ReservationDetail | null> {
  const res = await prisma.reservation.findUnique({
    where: { id },
    include: {
      guest: { select: { fullName: true } },
      room: { select: { number: true, type: true, description: true, baseRate: true } },
    },
  });

  if (!res) return null;

  const nights = Math.max(1, daysBetween(res.checkIn, res.checkOut));
  const nightlyRate = Number(res.room.baseRate);
  const lines = buildStayFolioLines({
    roomNumber: res.room.number,
    nightlyRate,
    nights,
    extensionDays: res.extensionDays,
    extensionHours: res.extensionHours,
  });

  return {
    id: res.id,
    guestName:
      res.bookingType === "MAINTENANCE" ? "Maintenance" : res.guest.fullName,
    roomNumber: res.room.number,
    roomType: res.room.type,
    roomDescription: res.room.description,
    checkIn: res.checkIn.toISOString(),
    checkOut: res.checkOut.toISOString(),
    status: res.status,
    bookingType: res.bookingType,
    adults: res.adults,
    children: res.children,
    extensionDays: res.extensionDays,
    extensionHours: res.extensionHours,
    estimatedTotal: folioLinesTotal(lines),
    scheduledArrival: res.scheduledArrival?.toISOString() ?? null,
    scheduledDeparture: res.scheduledDeparture?.toISOString() ?? null,
  };
}
