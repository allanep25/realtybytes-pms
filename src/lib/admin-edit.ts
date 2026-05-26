import { normalizeBookingFields } from "@/lib/booking-source";
import { hasRoomConflict } from "@/lib/check-in-out";
import { prisma } from "@/lib/db";
import {
  addHotelDays,
  daysBetween,
  hotelCalendarDate,
  hotelTimeInput,
  parseHotelCalendarDate,
  setHotelTime,
  startOfHotelDay,
} from "@/lib/dates";
import { buildStayFolioLines, folioLinesTotal } from "@/lib/stay-pricing";
import type { BookingPlatform, BookingSource, Prisma } from "@prisma/client";

export type EditableReservationListItem = {
  id: string;
  guestName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  status: string;
  folioNumber: string | null;
  bookingReference: string | null;
  encodedByName: string | null;
};

export type RoomOption = {
  id: string;
  number: string;
  description: string;
};

export type EditableReservationRecord = {
  reservationId: string;
  guestId: string;
  guest: {
    fullName: string;
    contactNumber: string | null;
    idType: string | null;
    idNumber: string | null;
    address: string | null;
    isVip: boolean;
    notes: string | null;
  };
  reservation: {
    status: string;
    checkIn: string;
    checkOut: string;
    roomId: string;
    roomNumber: string;
    bookingSource: BookingSource;
    bookingPlatform: BookingPlatform | null;
    bookingReference: string | null;
    adults: number;
    children: number;
    extensionDays: number;
    extensionHours: number;
    arrivalTime: string | null;
    folioNumber: string | null;
    encodedByName: string | null;
  };
  rooms: RoomOption[];
};

export type AdminUpdateRecordInput = {
  guest?: {
    fullName?: string;
    contactNumber?: string | null;
    idType?: string | null;
    idNumber?: string | null;
    address?: string | null;
    isVip?: boolean;
    notes?: string | null;
  };
  reservation?: {
    checkIn?: string;
    checkOut?: string;
    roomId?: string;
    bookingSource?: BookingSource;
    bookingPlatform?: BookingPlatform | null;
    bookingReference?: string | null;
    adults?: number;
    children?: number;
    extensionDays?: number;
    extensionHours?: number;
    arrivalTime?: string | null;
  };
};

function toDateInput(value: Date): string {
  return hotelCalendarDate(value);
}

async function refreshRoomStatus(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { housekeepingTask: true },
  });
  if (!room || room.status === "OUT_OF_ORDER") return;

  const active = await prisma.reservation.findFirst({
    where: {
      roomId,
      bookingType: "GUEST",
      status: { in: ["CHECKED_IN", "RESERVED"] },
    },
    orderBy: { checkIn: "desc" },
  });

  if (!active) {
    const hkStatus = room.housekeepingTask?.status;
    const nextStatus =
      hkStatus === "DIRTY" || hkStatus === "CLEANING" ? "DIRTY" : "VACANT";
    await prisma.room.update({ where: { id: roomId }, data: { status: nextStatus } });
    return;
  }

  await prisma.room.update({
    where: { id: roomId },
    data: { status: active.status === "CHECKED_IN" ? "OCCUPIED" : "RESERVED" },
  });
}

async function rebuildReservationFolio(reservationId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { room: true, folio: true },
  });
  if (!reservation?.folio) return;

  const nights = Math.max(1, daysBetween(reservation.checkIn, reservation.checkOut));
  const lines = buildStayFolioLines({
    roomNumber: reservation.room.number,
    nightlyRate: Number(reservation.room.baseRate),
    nights,
    extensionDays: reservation.extensionDays,
    extensionHours: reservation.extensionHours,
  });
  const total = folioLinesTotal(lines);
  const discount = Number(reservation.folio.discount);
  const netTotal = Math.max(0, total - discount);
  const paid = Math.min(Number(reservation.folio.paid), netTotal);

  await prisma.$transaction(async (tx) => {
    await tx.folioLine.deleteMany({ where: { folioId: reservation.folio!.id } });
    await tx.folioLine.createMany({
      data: lines.map((line) => ({
        folioId: reservation.folio!.id,
        description: line.description,
        quantity: line.quantity,
        rate: line.rate,
        amount: line.amount,
      })),
    });
    await tx.folio.update({
      where: { id: reservation.folio!.id },
      data: {
        subtotal: total,
        total: netTotal,
        paid,
        paidAt: paid > 0 ? reservation.folio!.paidAt ?? new Date() : null,
      },
    });
  });
}

const reservationListInclude = {
  guest: { select: { fullName: true } },
  room: { select: { number: true } },
  folio: { select: { folioNumber: true } },
  encodedBy: { select: { name: true } },
} as const;

type ReservationListRow = Prisma.ReservationGetPayload<{ include: typeof reservationListInclude }>;

function mapReservationToListItem(res: ReservationListRow): EditableReservationListItem {
  return {
    id: res.id,
    guestName: res.guest.fullName,
    roomNumber: res.room.number,
    checkIn: hotelCalendarDate(res.checkIn),
    checkOut: hotelCalendarDate(res.checkOut),
    status: res.status,
    folioNumber: res.folio?.folioNumber ?? null,
    bookingReference: res.bookingReference,
    encodedByName: res.encodedBy?.name ?? null,
  };
}

function buildSearchWhere(query: string): Prisma.ReservationWhereInput {
  const q = query.trim();
  const tokens = q.split(/\s+/).filter(Boolean);

  const orConditions: Prisma.ReservationWhereInput[] = [
    { guest: { fullName: { contains: q, mode: "insensitive" } } },
    { guest: { contactNumber: { contains: q, mode: "insensitive" } } },
    { guest: { idNumber: { contains: q, mode: "insensitive" } } },
    { bookingReference: { contains: q, mode: "insensitive" } },
    { room: { number: { contains: q, mode: "insensitive" } } },
    { folio: { folioNumber: { contains: q, mode: "insensitive" } } },
  ];

  if (tokens.length > 1) {
    orConditions.push({
      AND: tokens.map((token) => ({
        guest: { fullName: { contains: token, mode: "insensitive" } },
      })),
    });
  }

  return {
    bookingType: "GUEST",
    OR: orConditions,
  };
}

export async function listTodayEditableReservations(): Promise<EditableReservationListItem[]> {
  const today = startOfHotelDay();
  const tomorrow = addHotelDays(today, 1);

  const reservations = await prisma.reservation.findMany({
    where: {
      bookingType: "GUEST",
      status: { notIn: ["CANCELLED", "NO_SHOW", "CHECKED_OUT"] },
      OR: [
        { checkIn: { gte: today, lt: tomorrow } },
        { checkOut: { gte: today, lt: tomorrow } },
        { status: "CHECKED_IN", checkOut: { gt: today } },
        { status: "RESERVED", checkIn: { lt: tomorrow }, checkOut: { gt: today } },
      ],
    },
    include: reservationListInclude,
    orderBy: [{ checkIn: "asc" }, { guest: { fullName: "asc" } }],
    take: 50,
  });

  return reservations.map(mapReservationToListItem);
}

export async function searchEditableReservations(
  query: string,
): Promise<EditableReservationListItem[]> {
  const q = query.trim();
  if (!q) return listTodayEditableReservations();

  const reservations = await prisma.reservation.findMany({
    where: buildSearchWhere(q),
    include: reservationListInclude,
    orderBy: { checkIn: "desc" },
    take: 30,
  });

  return reservations.map(mapReservationToListItem);
}

export async function getEditableReservation(
  reservationId: string,
): Promise<EditableReservationRecord | null> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId, bookingType: "GUEST" },
    include: {
      guest: true,
      room: true,
      folio: { select: { folioNumber: true } },
      encodedBy: { select: { name: true } },
    },
  });

  if (!reservation) return null;

  const rooms = await prisma.room.findMany({
    where: { status: { not: "OUT_OF_ORDER" } },
    orderBy: [{ floor: "asc" }, { number: "asc" }],
    select: { id: true, number: true, description: true },
  });

  if (!rooms.some((room) => room.id === reservation.roomId)) {
    rooms.unshift({
      id: reservation.room.id,
      number: reservation.room.number,
      description: reservation.room.description,
    });
  }

  return {
    reservationId: reservation.id,
    guestId: reservation.guestId,
    guest: {
      fullName: reservation.guest.fullName,
      contactNumber: reservation.guest.contactNumber,
      idType: reservation.guest.idType,
      idNumber: reservation.guest.idNumber,
      address: reservation.guest.address,
      isVip: reservation.guest.isVip,
      notes: reservation.guest.notes,
    },
    reservation: {
      status: reservation.status,
      checkIn: toDateInput(reservation.checkIn),
      checkOut: toDateInput(reservation.checkOut),
      roomId: reservation.roomId,
      roomNumber: reservation.room.number,
      bookingSource: reservation.bookingSource,
      bookingPlatform: reservation.bookingPlatform,
      bookingReference: reservation.bookingReference,
      adults: reservation.adults,
      children: reservation.children,
      extensionDays: reservation.extensionDays,
      extensionHours: reservation.extensionHours,
      arrivalTime: hotelTimeInput(reservation.scheduledArrival),
      folioNumber: reservation.folio?.folioNumber ?? null,
      encodedByName: reservation.encodedBy?.name ?? null,
    },
    rooms,
  };
}

export async function adminUpdateReservationRecord(
  reservationId: string,
  input: AdminUpdateRecordInput,
): Promise<EditableReservationRecord> {
  const existing = await prisma.reservation.findUnique({
    where: { id: reservationId, bookingType: "GUEST" },
    include: { guest: true, room: true, folio: true },
  });

  if (!existing) {
    throw new Error("Reservation not found");
  }

  if (existing.status === "CANCELLED" || existing.status === "NO_SHOW") {
    throw new Error("Cancelled and no-show reservations cannot be edited here");
  }

  const guestInput = input.guest ?? {};
  if (guestInput.fullName !== undefined && !guestInput.fullName.trim()) {
    throw new Error("Guest name is required");
  }

  const reservationInput = input.reservation ?? {};
  const checkIn = reservationInput.checkIn
    ? parseHotelCalendarDate(reservationInput.checkIn)
    : existing.checkIn;
  const checkOut = reservationInput.checkOut
    ? parseHotelCalendarDate(reservationInput.checkOut)
    : existing.checkOut;

  if (checkOut <= checkIn) {
    throw new Error("Check-out must be after check-in");
  }

  const roomId = reservationInput.roomId ?? existing.roomId;
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) throw new Error("Room not found");
  if (room.status === "OUT_OF_ORDER" && roomId !== existing.roomId) {
    throw new Error("Cannot move guest to an out-of-order room");
  }

  if (
    await hasRoomConflict(roomId, checkIn, checkOut, reservationId)
  ) {
    throw new Error("Room is not available for the selected dates");
  }

  const booking = normalizeBookingFields({
    bookingSource: reservationInput.bookingSource ?? existing.bookingSource,
    bookingPlatform:
      reservationInput.bookingPlatform !== undefined
        ? reservationInput.bookingPlatform
        : existing.bookingPlatform,
    bookingReference:
      reservationInput.bookingReference !== undefined
        ? reservationInput.bookingReference
        : existing.bookingReference,
  });

  const adults = Math.max(1, reservationInput.adults ?? existing.adults);
  const children = Math.max(0, reservationInput.children ?? existing.children);
  const extensionDays = Math.max(0, reservationInput.extensionDays ?? existing.extensionDays);
  const extensionHours = Math.max(0, reservationInput.extensionHours ?? existing.extensionHours);

  let scheduledArrival = existing.scheduledArrival;
  if (reservationInput.arrivalTime !== undefined) {
    if (reservationInput.arrivalTime) {
      const [h, m] = reservationInput.arrivalTime.split(":").map(Number);
      scheduledArrival = setHotelTime(checkIn, h || 14, m || 0);
    } else {
      scheduledArrival = null;
    }
  } else if (reservationInput.checkIn) {
    const previousTime = hotelTimeInput(existing.scheduledArrival);
    scheduledArrival = previousTime
      ? setHotelTime(
          checkIn,
          ...previousTime.split(":").map(Number) as [number, number],
        )
      : setHotelTime(checkIn, 14, 0);
  }

  const oldRoomId = existing.roomId;
  const stayChanged =
    roomId !== existing.roomId ||
    checkIn.getTime() !== existing.checkIn.getTime() ||
    checkOut.getTime() !== existing.checkOut.getTime() ||
    extensionDays !== existing.extensionDays ||
    extensionHours !== existing.extensionHours;

  await prisma.$transaction(async (tx) => {
    await tx.guest.update({
      where: { id: existing.guestId },
      data: {
        ...(guestInput.fullName != null ? { fullName: guestInput.fullName.trim() } : {}),
        ...(guestInput.contactNumber !== undefined
          ? { contactNumber: guestInput.contactNumber?.trim() || null }
          : {}),
        ...(guestInput.idType !== undefined ? { idType: guestInput.idType?.trim() || null } : {}),
        ...(guestInput.idNumber !== undefined
          ? { idNumber: guestInput.idNumber?.trim() || null }
          : {}),
        ...(guestInput.address !== undefined
          ? { address: guestInput.address?.trim() || null }
          : {}),
        ...(guestInput.isVip !== undefined ? { isVip: guestInput.isVip } : {}),
        ...(guestInput.notes !== undefined ? { notes: guestInput.notes?.trim() || null } : {}),
      },
    });

    await tx.reservation.update({
      where: { id: reservationId },
      data: {
        roomId,
        checkIn,
        checkOut,
        scheduledArrival,
        adults,
        children,
        extensionDays,
        extensionHours,
        bookingSource: booking.bookingSource,
        bookingPlatform: booking.bookingPlatform,
        bookingReference: booking.bookingReference,
      },
    });
  });

  if (stayChanged && existing.folio) {
    await rebuildReservationFolio(reservationId);
  }

  if (roomId !== oldRoomId) {
    await refreshRoomStatus(oldRoomId);
    await refreshRoomStatus(roomId);
  } else if (stayChanged) {
    await refreshRoomStatus(roomId);
  }

  const updated = await getEditableReservation(reservationId);
  if (!updated) throw new Error("Failed to load updated record");
  return updated;
}
