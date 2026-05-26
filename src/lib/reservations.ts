import { prisma } from "@/lib/db";
import { formatBookingChannel } from "@/lib/booking-source";
import {
  addDays,
  addHotelDays,
  daysBetween,
  eachDayOfInterval,
  formatMonthYear,
  getHotelMonthEnd,
  getHotelMonthStart,
  hotelCalendarDate,
  hotelDayOfWeek,
  parseHotelCalendarDate,
  startOfDay,
  startOfHotelDay,
} from "@/lib/dates";
import { mapStaffAttribution, type StaffAttribution } from "@/lib/staff-attribution";
import { buildStayFolioLines, folioLinesTotal } from "@/lib/stay-pricing";
import {
  BookingType,
  type BookingPlatform,
  type BookingSource,
  type ReservationStatus,
} from "@prisma/client";

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
  monthOffset: number;
};

export type CalendarDayBooking = {
  id: string;
  roomNumber: string;
  guestName: string;
  colorClass: string;
  title: string;
};

export type CalendarGridDay = {
  dateKey: string;
  dayOfMonth: number;
  inMonth: boolean;
  isToday: boolean;
  bookings: CalendarDayBooking[];
};

export type MonthCalendarGrid = {
  monthOffset: number;
  monthLabel: string;
  rangeStart: string;
  rangeEnd: string;
  weekdayHeaders: string[];
  weeks: CalendarGridDay[][];
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
  bookingSource: BookingSource;
  bookingPlatform: BookingPlatform | null;
  bookingReference: string | null;
  adults: number;
  children: number;
  extensionDays: number;
  extensionHours: number;
  estimatedTotal: number;
  scheduledArrival: string | null;
  scheduledDeparture: string | null;
  folioNumber: string | null;
  totalDue: number;
  discount: number;
  paid: number;
  balanceDue: number;
  paymentMethod: string | null;
  encodedBy: StaffAttribution | null;
  checkedInBy: StaffAttribution | null;
  checkedOutBy: StaffAttribution | null;
};

export type ReservationTimelineData = {
  rangeStart: Date;
  rangeEnd: Date;
  days: Date[];
  roomNumbers: string[];
  bars: TimelineBar[];
};

export type RevenueBreakdownItem = {
  method: string;
  label: string;
  amount: number;
};

export type TodayRevenue = {
  today: number;
  yesterday: number;
  changePercent: number | null;
  breakdown: RevenueBreakdownItem[];
};

function barColor(status: ReservationStatus, bookingType: BookingType): string {
  if (bookingType === "MAINTENANCE") return "bg-room-dirty";
  switch (status) {
    case "CHECKED_IN":
      return "bg-room-occupied";
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

export function getTimelineRange(monthOffset = 0): { start: Date; end: Date } {
  const start = getHotelMonthStart(monthOffset);
  const end = getHotelMonthEnd(start);
  return { start, end };
}

/** Sunday–Saturday week for compact room timeline views. */
export function getWeekTimelineRange(weekOffset = 0): { start: Date; end: Date } {
  const today = startOfDay(new Date());
  const start = addDays(today, -today.getDay() + weekOffset * 7);
  const end = addDays(start, 6);
  return { start, end };
}

export function buildMonthWeekRows(monthStart: Date, monthEnd: Date): Date[][] {
  const monthStartKey = hotelCalendarDate(monthStart);
  const monthEndKey = hotelCalendarDate(monthEnd);
  let cursorKey = hotelCalendarDate(
    addHotelDays(parseHotelCalendarDate(monthStartKey), -hotelDayOfWeek(monthStartKey)),
  );
  const gridEndKey = hotelCalendarDate(
    addHotelDays(parseHotelCalendarDate(monthEndKey), 6 - hotelDayOfWeek(monthEndKey)),
  );

  const weeks: Date[][] = [];

  while (weeks.length < 6) {
    const week: Date[] = [];
    for (let index = 0; index < 7; index++) {
      week.push(parseHotelCalendarDate(cursorKey));
      cursorKey = hotelCalendarDate(addHotelDays(parseHotelCalendarDate(cursorKey), 1));
    }
    weeks.push(week);
    if (cursorKey > gridEndKey) break;
  }

  return weeks;
}

export function getDefaultTimelineRange(): { start: Date; end: Date } {
  return getTimelineRange(0);
}

export function serializeTimeline(
  data: ReservationTimelineData,
  monthOffset: number,
): ReservationTimelineSerialized {
  return {
    rangeStart: data.rangeStart.toISOString(),
    rangeEnd: data.rangeEnd.toISOString(),
    days: data.days.map((d) => d.toISOString()),
    roomNumbers: data.roomNumbers,
    bars: data.bars,
    monthOffset,
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

    const guestLabel =
      res.bookingType === "MAINTENANCE" ? "Maintenance" : res.guest.fullName;
    const channel = formatBookingChannel(
      res.bookingSource,
      res.bookingPlatform,
      res.bookingReference,
    );

    bars.push({
      id: res.id,
      roomNumber: res.room.number,
      guestName: guestLabel,
      startCol: clampedStart,
      span: clampedSpan,
      colorClass: barColor(res.status, res.bookingType),
      title: `${res.room.number} — ${guestLabel} (${channel})`,
      status: res.status,
      bookingType: res.bookingType,
      checkIn: res.checkIn.toISOString(),
      checkOut: res.checkOut.toISOString(),
    });
  }

  return { rangeStart: start, rangeEnd: end, days, roomNumbers, bars };
}

function reservationOccupiesDay(checkIn: Date, checkOut: Date, day: Date): boolean {
  const dayKey = hotelCalendarDate(day);
  const checkInKey = hotelCalendarDate(checkIn);
  const checkOutKey = hotelCalendarDate(checkOut);
  return dayKey >= checkInKey && dayKey < checkOutKey;
}

export async function getMonthCalendarGrid(monthOffset = 0): Promise<MonthCalendarGrid> {
  const { start: monthStart, end: monthEnd } = getTimelineRange(monthOffset);
  const weeks = buildMonthWeekRows(monthStart, monthEnd);
  const gridStart = weeks[0][0];
  const gridEnd = weeks[weeks.length - 1][6];
  const rangeEndExclusive = addDays(startOfDay(gridEnd), 1);
  const todayKey = hotelCalendarDate();
  const monthStartKey = hotelCalendarDate(monthStart);
  const monthEndKey = hotelCalendarDate(monthEnd);

  const reservations = await prisma.reservation.findMany({
    where: {
      checkIn: { lt: rangeEndExclusive },
      checkOut: { gt: startOfDay(gridStart) },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    include: {
      guest: { select: { fullName: true } },
      room: { select: { number: true } },
    },
    orderBy: [{ room: { number: "asc" } }, { checkIn: "asc" }],
  });

  const weekdayHeaders = Array.from({ length: 7 }, (_, index) =>
    addDays(startOfDay(new Date(2024, 0, 7)), index).toLocaleDateString("en-PH", {
      weekday: "short",
    }),
  );

  const gridWeeks: CalendarGridDay[][] = weeks.map((week) =>
    week.map((day) => {
      const dateKey = hotelCalendarDate(day);
      const bookings: CalendarDayBooking[] = [];

      for (const res of reservations) {
        if (!reservationOccupiesDay(res.checkIn, res.checkOut, day)) continue;

        const guestLabel =
          res.bookingType === "MAINTENANCE" ? "Maintenance" : res.guest.fullName;
        const channel = formatBookingChannel(
          res.bookingSource,
          res.bookingPlatform,
          res.bookingReference,
        );

        bookings.push({
          id: res.id,
          roomNumber: res.room.number,
          guestName: guestLabel,
          colorClass: barColor(res.status, res.bookingType),
          title: `${res.room.number} — ${guestLabel} (${channel})`,
        });
      }

      return {
        dateKey,
        dayOfMonth: Number(dateKey.split("-")[2]),
        inMonth: dateKey >= monthStartKey && dateKey <= monthEndKey,
        isToday: dateKey === todayKey,
        bookings,
      };
    }),
  );

  return {
    monthOffset,
    monthLabel: formatMonthYear(monthStart),
    rangeStart: monthStart.toISOString(),
    rangeEnd: monthEnd.toISOString(),
    weekdayHeaders,
    weeks: gridWeeks,
  };
}

export async function getTodayArrivals(): Promise<ActivityItem[]> {
  const today = startOfHotelDay();
  const tomorrow = addHotelDays(new Date(), 1);

  const rows = await prisma.reservation.findMany({
    where: {
      checkIn: { gte: today, lt: tomorrow },
      status: "RESERVED",
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
  const today = startOfHotelDay();
  const tomorrow = addHotelDays(new Date(), 1);

  const rows = await prisma.reservation.findMany({
    where: {
      checkOut: { gte: today, lt: tomorrow },
      status: "CHECKED_IN",
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
  const { getTodayRevenueSummary } = await import("@/lib/revenue");
  const summary = await getTodayRevenueSummary();
  return {
    today: summary.total,
    yesterday: summary.previousPeriodTotal ?? 0,
    changePercent: summary.changePercent,
    breakdown: summary.breakdown,
  };
}

export async function getReservationById(id: string): Promise<ReservationDetail | null> {
  const res = await prisma.reservation.findUnique({
    where: { id },
    include: {
      guest: { select: { fullName: true } },
      room: { select: { number: true, type: true, description: true, baseRate: true } },
      folio: {
        select: {
          folioNumber: true,
          subtotal: true,
          discount: true,
          total: true,
          paid: true,
          paymentMethod: true,
        },
      },
      encodedBy: { select: { name: true, role: true } },
      checkedInBy: { select: { name: true, role: true } },
      checkedOutBy: { select: { name: true, role: true } },
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

  const estimatedTotal = folioLinesTotal(lines);
  const folioSubtotal = res.folio ? Number(res.folio.subtotal) : estimatedTotal;
  const folioDiscount = res.folio ? Number(res.folio.discount) : 0;
  const folioTotal = res.folio ? Number(res.folio.total) : estimatedTotal;
  const paid = res.folio ? Number(res.folio.paid) : 0;

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
    bookingSource: res.bookingSource,
    bookingPlatform: res.bookingPlatform,
    bookingReference: res.bookingReference,
    adults: res.adults,
    children: res.children,
    extensionDays: res.extensionDays,
    extensionHours: res.extensionHours,
    estimatedTotal: folioSubtotal,
    scheduledArrival: res.scheduledArrival?.toISOString() ?? null,
    scheduledDeparture: res.scheduledDeparture?.toISOString() ?? null,
    folioNumber: res.folio?.folioNumber ?? null,
    totalDue: folioTotal,
    discount: folioDiscount,
    paid,
    balanceDue: Math.max(0, folioTotal - paid),
    paymentMethod: res.folio?.paymentMethod ?? null,
    encodedBy: mapStaffAttribution(res.encodedBy),
    checkedInBy: mapStaffAttribution(res.checkedInBy),
    checkedOutBy: mapStaffAttribution(res.checkedOutBy),
  };
}
