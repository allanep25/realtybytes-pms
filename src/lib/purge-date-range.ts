import { prisma } from "@/lib/db";
import { addDays, startOfDay } from "@/lib/dates";
import { HousekeepingStatus, RoomStatus } from "@prisma/client";

export type PurgePreview = {
  reservationId: string;
  guestName: string;
  roomNumber: string;
  status: string;
  checkIn: string;
  checkOut: string;
  folioNumber: string | null;
};

function parseDateInput(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return startOfDay(new Date(y, m - 1, d));
}

/** Delete guest stays that overlap [fromDate, toDate] (inclusive calendar days). */
export async function purgeStaysInDateRange(
  fromDateStr: string,
  toDateStr: string,
  options?: { dryRun?: boolean },
): Promise<PurgePreview[]> {
  const from = parseDateInput(fromDateStr);
  const toExclusive = addDays(parseDateInput(toDateStr), 1);
  const dryRun = options?.dryRun ?? false;

  const reservations = await prisma.reservation.findMany({
    where: {
      bookingType: "GUEST",
      checkIn: { lt: toExclusive },
      checkOut: { gt: from },
    },
    include: {
      guest: { select: { id: true, fullName: true } },
      room: { select: { id: true, number: true } },
      folio: { select: { id: true, folioNumber: true } },
    },
    orderBy: [{ checkIn: "asc" }, { room: { number: "asc" } }],
  });

  const preview: PurgePreview[] = reservations.map((res) => ({
    reservationId: res.id,
    guestName: res.guest.fullName,
    roomNumber: res.room.number,
    status: res.status,
    checkIn: res.checkIn.toISOString(),
    checkOut: res.checkOut.toISOString(),
    folioNumber: res.folio?.folioNumber ?? null,
  }));

  if (dryRun || reservations.length === 0) {
    return preview;
  }

  const reservationIds = reservations.map((r) => r.id);
  const guestIds = [...new Set(reservations.map((r) => r.guestId))];
  const roomIds = [...new Set(reservations.map((r) => r.roomId))];
  const folioIds = reservations.flatMap((r) => (r.folio ? [r.folio.id] : []));

  await prisma.$transaction(async (tx) => {
    if (folioIds.length > 0) {
      await tx.folioLine.deleteMany({ where: { folioId: { in: folioIds } } });
      await tx.folio.deleteMany({ where: { id: { in: folioIds } } });
    }

    await tx.reservation.deleteMany({ where: { id: { in: reservationIds } } });

    for (const guestId of guestIds) {
      const remaining = await tx.reservation.count({ where: { guestId } });
      if (remaining === 0) {
        await tx.guest.delete({ where: { id: guestId } });
      }
    }

    for (const roomId of roomIds) {
      const activeStay = await tx.reservation.findFirst({
        where: {
          roomId,
          status: { in: ["CHECKED_IN", "RESERVED"] },
        },
      });

      if (activeStay) {
        const roomStatus =
          activeStay.status === "CHECKED_IN" ? RoomStatus.OCCUPIED : RoomStatus.RESERVED;
        await tx.room.update({ where: { id: roomId }, data: { status: roomStatus } });
      } else {
        await tx.room.update({ where: { id: roomId }, data: { status: RoomStatus.VACANT } });
        await tx.housekeepingTask.updateMany({
          where: { roomId },
          data: { status: HousekeepingStatus.CLEAN, notes: null },
        });
      }
    }
  });

  return preview;
}
