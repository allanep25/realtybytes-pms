import { prisma } from "@/lib/db";
import { daysBetween } from "@/lib/dates";
import { syncAllRoomOperationalStatuses } from "@/lib/room-status";
import { buildStayFolioLines, folioLinesTotal } from "@/lib/stay-pricing";
import { compareRoomNumbers } from "@/lib/utils";
import { Prisma, type Room, type RoomType } from "@prisma/client";

export type RoomChangeOption = {
  id: string;
  number: string;
  floor: number;
  type: RoomType;
  description: string;
  maxPax: number;
  baseRate: number;
  breakfastRate: number | null;
  newSubtotal: number;
  newTotal: number;
  paid: number;
  balanceDue: number;
  difference: number;
};

export type RoomChangeOptionsResult = {
  reservationId: string;
  guestName: string;
  currentRoomNumber: string;
  currentTotal: number;
  paid: number;
  rooms: RoomChangeOption[];
};

export type ChangeInHouseRoomResult = {
  guestName: string;
  fromRoomNumber: string;
  toRoomNumber: string;
  subtotal: number;
  total: number;
  paid: number;
  balanceDue: number;
};

type ReservationForRoomChange = NonNullable<
  Awaited<ReturnType<typeof getRoomChangeReservation>>
>;

function isStayChargeForRoom(description: string, roomNumber: string): boolean {
  return (
    description.startsWith(`Room ${roomNumber} â€”`) ||
    description === `Day extension â€” Room ${roomNumber}` ||
    description === `Hour extension â€” Room ${roomNumber}`
  );
}

function getStayLinesForRoom(reservation: ReservationForRoomChange, room: Room) {
  const nights = Math.max(1, daysBetween(reservation.checkIn, reservation.checkOut));
  return buildStayFolioLines({
    roomNumber: room.number,
    nightlyRate: Number(room.baseRate),
    nights,
    extensionDays: reservation.extensionDays,
    extensionHours: reservation.extensionHours,
  });
}

function quoteRoomChange(reservation: ReservationForRoomChange, room: Room) {
  const stayLines = getStayLinesForRoom(reservation, room);
  const staySubtotal = folioLinesTotal(stayLines);
  const preservedSubtotal =
    reservation.folio?.lines.reduce((sum, line) => {
      if (isStayChargeForRoom(line.description, reservation.room.number)) return sum;
      return sum + Number(line.amount);
    }, 0) ?? 0;
  const subtotal = Math.round((preservedSubtotal + staySubtotal) * 100) / 100;
  const discount = Math.min(Number(reservation.folio?.discount ?? 0), subtotal);
  const total = Math.max(0, Math.round((subtotal - discount) * 100) / 100);
  const paid = Number(reservation.folio?.paid ?? 0);
  return {
    stayLines,
    subtotal,
    total,
    paid,
    balanceDue: Math.max(0, total - paid),
    difference: total - Number(reservation.folio?.total ?? 0),
  };
}

async function getRoomChangeReservation(reservationId: string) {
  return prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      guest: { select: { fullName: true } },
      room: true,
      folio: { include: { lines: true } },
    },
  });
}

async function getAvailableRoomChangeRooms(reservation: ReservationForRoomChange) {
  await syncAllRoomOperationalStatuses();

  const rooms = await prisma.room.findMany({
    where: {
      id: { not: reservation.roomId },
      status: "VACANT",
    },
    include: { housekeepingTask: true },
    orderBy: [{ floor: "asc" }, { number: "asc" }],
  });

  const cleanRooms = rooms.filter((room) => {
    const housekeepingStatus = room.housekeepingTask?.status;
    return housekeepingStatus == null || housekeepingStatus === "CLEAN";
  });

  if (cleanRooms.length === 0) return [];

  const conflicts = await prisma.reservation.findMany({
    where: {
      roomId: { in: cleanRooms.map((room) => room.id) },
      id: { not: reservation.id },
      bookingType: "GUEST",
      status: { notIn: ["CANCELLED", "NO_SHOW", "CHECKED_OUT"] },
      checkIn: { lt: reservation.checkOut },
      checkOut: { gt: reservation.checkIn },
    },
    select: { roomId: true },
  });
  const conflictedRoomIds = new Set(conflicts.map((conflict) => conflict.roomId));

  return cleanRooms
    .filter((room) => !conflictedRoomIds.has(room.id))
    .sort((a, b) => compareRoomNumbers(a.number, b.number));
}

function assertChangeableReservation(reservation: Awaited<ReturnType<typeof getRoomChangeReservation>>) {
  if (!reservation) throw new Error("Reservation not found");
  if (reservation.bookingType !== "GUEST") {
    throw new Error("Only guest reservations can change rooms");
  }
  if (reservation.status !== "CHECKED_IN") {
    throw new Error("Only checked-in guests can change rooms");
  }
  return reservation;
}

export async function getInHouseRoomChangeOptions(
  reservationId: string,
): Promise<RoomChangeOptionsResult> {
  const reservation = assertChangeableReservation(await getRoomChangeReservation(reservationId));
  const rooms = await getAvailableRoomChangeRooms(reservation);
  const currentTotal = Number(reservation.folio?.total ?? 0);
  const paid = Number(reservation.folio?.paid ?? 0);

  return {
    reservationId,
    guestName: reservation.guest.fullName,
    currentRoomNumber: reservation.room.number,
    currentTotal,
    paid,
    rooms: rooms.map((room) => {
      const quote = quoteRoomChange(reservation, room);
      return {
        id: room.id,
        number: room.number,
        floor: room.floor,
        type: room.type,
        description: room.description,
        maxPax: room.maxPax,
        baseRate: Number(room.baseRate),
        breakfastRate: room.breakfastRate != null ? Number(room.breakfastRate) : null,
        newSubtotal: quote.subtotal,
        newTotal: quote.total,
        paid: quote.paid,
        balanceDue: quote.balanceDue,
        difference: quote.difference,
      };
    }),
  };
}

export async function changeInHouseRoom(
  reservationId: string,
  toRoomId: string,
): Promise<ChangeInHouseRoomResult> {
  const reservation = assertChangeableReservation(await getRoomChangeReservation(reservationId));
  if (reservation.roomId === toRoomId) {
    throw new Error("Select a different room");
  }

  const availableRooms = await getAvailableRoomChangeRooms(reservation);
  const toRoom = availableRooms.find((room) => room.id === toRoomId);
  if (!toRoom) {
    throw new Error("Selected room is not available for this stay");
  }

  const quote = quoteRoomChange(reservation, toRoom);

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id: reservation.id },
      data: { roomId: toRoom.id },
    });

    await tx.room.update({
      where: { id: reservation.roomId },
      data: { status: "DIRTY" },
    });
    await tx.room.update({
      where: { id: toRoom.id },
      data: { status: "OCCUPIED" },
    });

    await tx.housekeepingTask.upsert({
      where: { roomId: reservation.roomId },
      create: {
        roomId: reservation.roomId,
        status: "DIRTY",
        checklistState: Prisma.DbNull,
        notes: `Guest moved to Room ${toRoom.number} — clean before reuse`,
      },
      update: {
        status: "DIRTY",
        notes: `Guest moved to Room ${toRoom.number} — clean before reuse`,
        assignedTo: null,
        checklistState: Prisma.DbNull,
      },
    });
    await tx.housekeepingTask.updateMany({
      where: { roomId: toRoom.id },
      data: { status: "CLEAN", notes: null, assignedTo: null, checklistState: Prisma.DbNull },
    });

    if (reservation.folio) {
      const stayLineIds = reservation.folio.lines
        .filter((line) => isStayChargeForRoom(line.description, reservation.room.number))
        .map((line) => line.id);

      if (stayLineIds.length > 0) {
        await tx.folioLine.deleteMany({ where: { id: { in: stayLineIds } } });
      }
      await tx.folioLine.createMany({
        data: quote.stayLines.map((line) => ({
          folioId: reservation.folio!.id,
          description: line.description,
          quantity: line.quantity,
          rate: line.rate,
          amount: line.amount,
        })),
      });
      await tx.folio.update({
        where: { id: reservation.folio.id },
        data: {
          subtotal: quote.subtotal,
          discount: Math.min(Number(reservation.folio.discount), quote.subtotal),
          total: quote.total,
        },
      });
    } else {
      await tx.folio.create({
        data: {
          folioNumber: `F-${Date.now().toString(36).toUpperCase()}`,
          reservationId: reservation.id,
          subtotal: quote.subtotal,
          total: quote.total,
          paid: 0,
          lines: {
            create: quote.stayLines,
          },
        },
      });
    }
  });

  return {
    guestName: reservation.guest.fullName,
    fromRoomNumber: reservation.room.number,
    toRoomNumber: toRoom.number,
    subtotal: quote.subtotal,
    total: quote.total,
    paid: quote.paid,
    balanceDue: quote.balanceDue,
  };
}










