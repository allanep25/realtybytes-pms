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
