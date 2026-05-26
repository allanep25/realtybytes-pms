import { prisma } from "@/lib/db";
import { addHotelDays, startOfHotelDay } from "@/lib/dates";

export type CheckoutAlert = {
  id: string;
  type: "needs_cleaning" | "departure_pending";
  roomNumber: string;
  message: string;
};

export async function getCheckoutAlerts(): Promise<CheckoutAlert[]> {
  const today = startOfHotelDay();
  const tomorrow = addHotelDays(today, 1);
  const recentCutoff = new Date(Date.now() - 6 * 60 * 60 * 1000);

  const [dirtyTasks, pendingDepartures] = await Promise.all([
    prisma.housekeepingTask.findMany({
      where: {
        status: "DIRTY",
        updatedAt: { gte: recentCutoff },
        notes: { contains: "Checked out" },
      },
      include: { room: { select: { number: true } } },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    prisma.reservation.findMany({
      where: {
        status: "CHECKED_IN",
        bookingType: "GUEST",
        checkOut: { gte: today, lt: tomorrow },
      },
      include: {
        guest: { select: { fullName: true } },
        room: { select: { number: true } },
      },
      orderBy: { checkOut: "asc" },
      take: 8,
    }),
  ]);

  const alerts: CheckoutAlert[] = [
    ...dirtyTasks.map((task) => ({
      id: `clean-${task.roomId}`,
      type: "needs_cleaning" as const,
      roomNumber: task.room.number,
      message: `Room ${task.room.number} checked out — needs cleaning`,
    })),
    ...pendingDepartures.map((stay) => ({
      id: `depart-${stay.id}`,
      type: "departure_pending" as const,
      roomNumber: stay.room.number,
      message: `Room ${stay.room.number} · ${stay.guest.fullName} departing today`,
    })),
  ];

  return alerts.slice(0, 10);
}
