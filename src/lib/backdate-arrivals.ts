import { prisma } from "@/lib/db";
import { addDays, setTime, startOfDay } from "@/lib/dates";

export type BackdateResult = {
  reservationId: string;
  guestName: string;
  roomNumber: string;
  previousCheckIn: string;
  previousCheckOut: string;
  newCheckIn: string;
  newCheckOut: string;
};

export async function backdateTodayArrivalsToCheckout(options?: {
  dryRun?: boolean;
}): Promise<BackdateResult[]> {
  const today = startOfDay(new Date());
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);
  const dryRun = options?.dryRun ?? false;

  const reservations = await prisma.reservation.findMany({
    where: {
      checkIn: { gte: today, lt: tomorrow },
      status: { in: ["RESERVED", "CHECKED_IN"] },
      bookingType: "GUEST",
    },
    include: {
      guest: { select: { fullName: true } },
      room: { select: { id: true, number: true } },
    },
    orderBy: { room: { number: "asc" } },
  });

  const results: BackdateResult[] = [];

  for (const res of reservations) {
    const newCheckIn = yesterday;
    const newCheckOut = today;

    const newScheduledArrival = res.scheduledArrival
      ? addDays(res.scheduledArrival, -1)
      : setTime(yesterday, 14, 0);

    const newScheduledDeparture = res.scheduledDeparture
      ? addDays(res.scheduledDeparture, -1)
      : setTime(today, 12, 0);

    results.push({
      reservationId: res.id,
      guestName: res.guest.fullName,
      roomNumber: res.room.number,
      previousCheckIn: res.checkIn.toISOString(),
      previousCheckOut: res.checkOut.toISOString(),
      newCheckIn: newCheckIn.toISOString(),
      newCheckOut: newCheckOut.toISOString(),
    });

    if (dryRun) continue;

    await prisma.$transaction([
      prisma.reservation.update({
        where: { id: res.id },
        data: {
          checkIn: newCheckIn,
          checkOut: newCheckOut,
          scheduledArrival: newScheduledArrival,
          scheduledDeparture: newScheduledDeparture,
          status: "CHECKED_IN",
        },
      }),
      prisma.room.update({
        where: { id: res.roomId },
        data: { status: "OCCUPIED" },
      }),
      prisma.housekeepingTask.updateMany({
        where: { roomId: res.roomId },
        data: { status: "CLEAN", notes: null },
      }),
    ]);
  }

  return results;
}

function parseDateInput(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return startOfDay(new Date(y, m - 1, d));
}

/** Move guest check-ins that start on `fromDate` back by one day (keeps stay length). */
export async function shiftCheckInsFromDate(
  fromDateStr: string,
  options?: {
    dryRun?: boolean;
    roomNumber?: string;
    reservationId?: string;
    recentOnly?: boolean;
  },
): Promise<BackdateResult[]> {
  const dryRun = options?.dryRun ?? false;
  const fromDate = parseDateInput(fromDateStr);
  const toDate = addDays(fromDate, 1);

  const reservations = await prisma.reservation.findMany({
    where: {
      ...(options?.reservationId ? { id: options.reservationId } : {}),
      ...(options?.roomNumber
        ? { room: { number: options.roomNumber } }
        : {}),
      ...(!options?.reservationId
        ? {
            checkIn: { gte: fromDate, lt: toDate },
          }
        : {}),
      status: { in: ["CHECKED_IN", "RESERVED"] },
      bookingType: "GUEST",
    },
    include: {
      guest: { select: { fullName: true } },
      room: { select: { id: true, number: true } },
    },
    orderBy: { createdAt: "desc" },
    ...(options?.recentOnly && !options.reservationId ? { take: 1 } : {}),
  });

  const results: BackdateResult[] = [];

  for (const res of reservations) {
    const newCheckIn = addDays(res.checkIn, -1);
    const newCheckOut = addDays(res.checkOut, -1);
    const newScheduledArrival = res.scheduledArrival
      ? addDays(res.scheduledArrival, -1)
      : setTime(newCheckIn, 14, 0);
    const newScheduledDeparture = res.scheduledDeparture
      ? addDays(res.scheduledDeparture, -1)
      : null;

    results.push({
      reservationId: res.id,
      guestName: res.guest.fullName,
      roomNumber: res.room.number,
      previousCheckIn: res.checkIn.toISOString(),
      previousCheckOut: res.checkOut.toISOString(),
      newCheckIn: newCheckIn.toISOString(),
      newCheckOut: newCheckOut.toISOString(),
    });

    if (dryRun) continue;

    await prisma.$transaction([
      prisma.reservation.update({
        where: { id: res.id },
        data: {
          checkIn: newCheckIn,
          checkOut: newCheckOut,
          scheduledArrival: newScheduledArrival,
          scheduledDeparture: newScheduledDeparture,
        },
      }),
      ...(res.status === "CHECKED_IN"
        ? [
            prisma.room.update({
              where: { id: res.roomId },
              data: { status: "OCCUPIED" },
            }),
            prisma.housekeepingTask.updateMany({
              where: { roomId: res.roomId },
              data: { status: "CLEAN", notes: null },
            }),
          ]
        : []),
    ]);
  }

  return results;
}
