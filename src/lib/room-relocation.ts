import { prisma } from "@/lib/db";
import { updateHousekeepingTask } from "@/lib/housekeeping";

export type RelocateGuestInput = {
  fromRoomNumber: string;
  toRoomNumber: string;
  maintenanceNote?: string;
  dryRun?: boolean;
};

export type RelocateGuestResult = {
  guestName: string;
  fromRoomNumber: string;
  toRoomNumber: string;
  reservationStatus: string;
};

export async function relocateGuestToRoom(
  input: RelocateGuestInput,
): Promise<RelocateGuestResult> {
  const fromRoom = await prisma.room.findUnique({
    where: { number: input.fromRoomNumber },
  });
  const toRoom = await prisma.room.findUnique({
    where: { number: input.toRoomNumber },
  });

  if (!fromRoom) throw new Error(`Room ${input.fromRoomNumber} not found`);
  if (!toRoom) throw new Error(`Room ${input.toRoomNumber} not found`);
  if (fromRoom.id === toRoom.id) {
    throw new Error("Source and destination rooms must be different");
  }

  const reservation = await prisma.reservation.findFirst({
    where: {
      roomId: fromRoom.id,
      bookingType: "GUEST",
      status: { in: ["CHECKED_IN", "RESERVED"] },
    },
    include: { guest: { select: { fullName: true } }, folio: { include: { lines: true } } },
    orderBy: { checkIn: "desc" },
  });

  if (!reservation) {
    throw new Error(`No active guest reservation found in Room ${input.fromRoomNumber}`);
  }

  const conflict = await prisma.reservation.findFirst({
    where: {
      roomId: toRoom.id,
      bookingType: "GUEST",
      status: { in: ["CHECKED_IN", "RESERVED"] },
      id: { not: reservation.id },
      checkIn: { lt: reservation.checkOut },
      checkOut: { gt: reservation.checkIn },
    },
  });

  if (conflict) {
    throw new Error(`Room ${input.toRoomNumber} is not available for this stay`);
  }

  if (toRoom.status === "OUT_OF_ORDER") {
    throw new Error(`Room ${input.toRoomNumber} is out of order`);
  }

  const result: RelocateGuestResult = {
    guestName: reservation.guest.fullName,
    fromRoomNumber: fromRoom.number,
    toRoomNumber: toRoom.number,
    reservationStatus: reservation.status,
  };

  if (input.dryRun) return result;

  const newRoomStatus =
    reservation.status === "CHECKED_IN"
      ? "OCCUPIED"
      : reservation.status === "RESERVED"
        ? "RESERVED"
        : toRoom.status;

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id: reservation.id },
      data: { roomId: toRoom.id },
    });

    await tx.room.update({
      where: { id: toRoom.id },
      data: { status: newRoomStatus },
    });

    if (reservation.folio) {
      for (const line of reservation.folio.lines) {
        if (line.description.includes(`Room ${fromRoom.number}`)) {
          await tx.folioLine.update({
            where: { id: line.id },
            data: {
              description: line.description.replaceAll(
                `Room ${fromRoom.number}`,
                `Room ${toRoom.number}`,
              ),
            },
          });
        }
      }
    }
  });

  await updateHousekeepingTask(fromRoom.id, {
    status: "OUT_OF_ORDER",
    notes: input.maintenanceNote ?? `Maintenance — guest moved to Room ${toRoom.number}`,
  });

  if (reservation.status === "CHECKED_IN") {
    await updateHousekeepingTask(toRoom.id, {
      status: "CLEAN",
      notes: null,
    });
  }

  return result;
}
