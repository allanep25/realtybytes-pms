import { prisma } from "@/lib/db";
import { addHotelDays, startOfHotelDay } from "@/lib/dates";

export type CheckoutAlert = {
  id: string;
  type: "needs_cleaning" | "departure_pending" | "unpaid_balance";
  roomNumber: string;
  message: string;
};

export async function getCheckoutAlerts(): Promise<CheckoutAlert[]> {
  const today = startOfHotelDay();
  const tomorrow = addHotelDays(today, 1);
  const recentCutoff = new Date(Date.now() - 6 * 60 * 60 * 1000);

  const [dirtyTasks, pendingDepartures, balanceRows] = await Promise.all([
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
    prisma.reservation.findMany({
      where: {
        bookingType: "GUEST",
        status: { in: ["CHECKED_IN", "RESERVED"] },
        OR: [
          { status: "CHECKED_IN" },
          { status: "RESERVED", checkIn: { gte: today, lt: tomorrow } },
        ],
      },
      include: {
        guest: { select: { fullName: true } },
        room: { select: { number: true } },
        folio: { select: { total: true, paid: true } },
      },
      orderBy: { checkIn: "asc" },
      take: 20,
    }),
  ]);

  const unpaidBalances = balanceRows
    .map((stay) => {
      const total = Number(stay.folio?.total ?? 0);
      const paid = Number(stay.folio?.paid ?? 0);
      return { stay, balanceDue: Math.max(0, total - paid) };
    })
    .filter((row) => row.balanceDue > 0.001)
    .slice(0, 8);

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
    ...unpaidBalances.map(({ stay, balanceDue }) => ({
      id: `balance-${stay.id}`,
      type: "unpaid_balance" as const,
      roomNumber: stay.room.number,
      message: `Room ${stay.room.number} · ${stay.guest.fullName} balance due ₱${balanceDue.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    })),
  ];

  return alerts.slice(0, 10);
}
