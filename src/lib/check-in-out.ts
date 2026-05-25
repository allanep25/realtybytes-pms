import { prisma } from "@/lib/db";
import { normalizeBookingFields } from "@/lib/booking-source";
import { addDays, daysBetween, setTime, startOfDay } from "@/lib/dates";
import { buildStayFolioLines, folioLinesTotal } from "@/lib/stay-pricing";
import type { BookingPlatform, BookingSource, PaymentMethod, RoomType } from "@prisma/client";

export type StaffActionContext = {
  employeeId: string;
};

export type AvailableRoom = {
  id: string;
  number: string;
  floor: number;
  type: RoomType;
  description: string;
  maxPax: number;
  status: string;
  baseRate: number;
  breakfastRate: number | null;
};

export type ActiveStay = {
  reservationId: string;
  guestName: string;
  roomNumber: string;
  roomType: RoomType;
  roomDescription: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  folioNumber: string | null;
  folioId: string | null;
  balanceDue: number;
  total: number;
  paid: number;
};

export type CheckInInput = {
  fullName: string;
  contactNumber?: string;
  idType?: string;
  idNumber?: string;
  address?: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  arrivalTime?: string;
  bookingSource?: BookingSource;
  bookingPlatform?: BookingPlatform | null;
  bookingReference?: string | null;
};

export type CheckInResult = {
  reservationId: string;
  guestId: string;
  folioNumber: string;
  roomNumber: string;
};

export type CreateReservationInput = {
  fullName: string;
  contactNumber?: string;
  idType?: string;
  idNumber?: string;
  address?: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  arrivalTime?: string;
  extensionDays?: number;
  extensionHours?: number;
  bookingSource?: BookingSource;
  bookingPlatform?: BookingPlatform | null;
  bookingReference?: string | null;
  depositAmount?: number;
  paymentMethod?: PaymentMethod;
};

export type CreateReservationResult = {
  reservationId: string;
  guestId: string;
  roomNumber: string;
};

export type CheckOutInput = {
  reservationId: string;
  paymentAmount?: number;
  paymentMethod?: PaymentMethod;
};

function parseDateInput(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return startOfDay(new Date(y, m - 1, d));
}

function parseArrivalTime(checkIn: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  return setTime(checkIn, h || 14, m || 0);
}

async function createStayFolio(
  reservationId: string,
  roomNumber: string,
  nightlyRate: number,
  nights: number,
  extensionDays: number,
  extensionHours: number,
  options?: { depositAmount?: number; paymentMethod?: PaymentMethod },
): Promise<string> {
  const lines = buildStayFolioLines({
    roomNumber,
    nightlyRate,
    nights,
    extensionDays,
    extensionHours,
  });
  const total = folioLinesTotal(lines);
  const folioNumber = `F-${Date.now().toString(36).toUpperCase()}`;
  const deposit = Math.max(0, options?.depositAmount ?? 0);
  const paid = Math.min(deposit, total);
  const paymentMethod =
    paid > 0 ? (options?.paymentMethod ?? "CASH") : options?.paymentMethod ?? null;

  await prisma.folio.create({
    data: {
      folioNumber,
      reservationId,
      subtotal: total,
      total,
      paid,
      paidAt: paid > 0 ? new Date() : null,
      paymentMethod,
      lines: { create: lines },
    },
  });

  return folioNumber;
}

/** Create folios for checked-in or reserved guests that do not have one yet. */
export async function ensureOpenStayFolios(): Promise<number> {
  const rows = await prisma.reservation.findMany({
    where: {
      status: { in: ["CHECKED_IN", "RESERVED"] },
      bookingType: "GUEST",
      folio: null,
    },
    include: { room: true },
  });

  for (const res of rows) {
    const nights = Math.max(1, daysBetween(res.checkIn, res.checkOut));
    await createStayFolio(
      res.id,
      res.room.number,
      Number(res.room.baseRate),
      nights,
      res.extensionDays,
      res.extensionHours,
    );
  }

  return rows.length;
}

export async function hasRoomConflict(
  roomId: string,
  checkIn: Date,
  checkOut: Date,
  excludeReservationId?: string,
): Promise<boolean> {
  const conflict = await prisma.reservation.findFirst({
    where: {
      roomId,
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      status: { notIn: ["CANCELLED", "NO_SHOW", "CHECKED_OUT"] },
      bookingType: "GUEST",
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
    },
  });
  return Boolean(conflict);
}

export async function getAvailableRooms(
  checkInStr: string,
  checkOutStr: string,
  options?: { vacantOnly?: boolean },
): Promise<AvailableRoom[]> {
  const checkIn = parseDateInput(checkInStr);
  const checkOut = parseDateInput(checkOutStr);

  if (checkOut <= checkIn) return [];

  const rooms = await prisma.room.findMany({
    where: {
      status: options?.vacantOnly ? "VACANT" : { not: "OUT_OF_ORDER" },
    },
    orderBy: [{ floor: "asc" }, { number: "asc" }],
  });

  const available: AvailableRoom[] = [];

  for (const room of rooms) {
    const conflict = await hasRoomConflict(room.id, checkIn, checkOut);
    if (!conflict) {
      available.push({
        id: room.id,
        number: room.number,
        floor: room.floor,
        type: room.type,
        description: room.description,
        maxPax: room.maxPax,
        status: room.status,
        baseRate: Number(room.baseRate),
        breakfastRate: room.breakfastRate != null ? Number(room.breakfastRate) : null,
      });
    }
  }

  return available;
}

export type ReservedArrival = {
  reservationId: string;
  guestName: string;
  roomNumber: string;
  roomDescription: string;
  checkOut: string;
  total: number;
  paid: number;
  balanceDue: number;
};

export async function getTodayReservedArrivals(): Promise<ReservedArrival[]> {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);

  const rows = await prisma.reservation.findMany({
    where: {
      checkIn: { gte: today, lt: tomorrow },
      status: "RESERVED",
      bookingType: "GUEST",
    },
    include: {
      guest: { select: { fullName: true } },
      room: { select: { number: true, description: true } },
      folio: { select: { total: true, paid: true } },
    },
    orderBy: { scheduledArrival: "asc" },
  });

  return rows.map((r) => {
    const total = Number(r.folio?.total ?? 0);
    const paid = Number(r.folio?.paid ?? 0);
    return {
      reservationId: r.id,
      guestName: r.guest.fullName,
      roomNumber: r.room.number,
      roomDescription: r.room.description,
      checkOut: r.checkOut.toISOString(),
      total,
      paid,
      balanceDue: Math.max(0, total - paid),
    };
  });
}

export async function getActiveStays(): Promise<ActiveStay[]> {
  const rows = await prisma.reservation.findMany({
    where: {
      status: "CHECKED_IN",
      bookingType: "GUEST",
    },
    include: {
      guest: { select: { fullName: true } },
      room: { select: { number: true, type: true, description: true } },
      folio: { select: { id: true, folioNumber: true, total: true, paid: true } },
    },
    orderBy: { checkOut: "asc" },
  });

  return rows.map((r) => {
    const total = Number(r.folio?.total ?? 0);
    const paid = Number(r.folio?.paid ?? 0);
    return {
      reservationId: r.id,
      guestName: r.guest.fullName,
      roomNumber: r.room.number,
      roomType: r.room.type,
      roomDescription: r.room.description,
      checkIn: r.checkIn.toISOString(),
      checkOut: r.checkOut.toISOString(),
      adults: r.adults,
      children: r.children,
      folioNumber: r.folio?.folioNumber ?? null,
      folioId: r.folio?.id ?? null,
      total,
      paid,
      balanceDue: Math.max(0, total - paid),
    };
  });
}

export async function performCheckIn(
  input: CheckInInput,
  staff: StaffActionContext,
): Promise<CheckInResult> {
  if (!input.fullName.trim()) {
    throw new Error("Guest name is required");
  }
  if (!input.roomId) {
    throw new Error("Please select a room");
  }

  const checkIn = parseDateInput(input.checkIn);
  const checkOut = parseDateInput(input.checkOut);

  if (checkOut <= checkIn) {
    throw new Error("Check-out date must be after check-in date");
  }

  const adults = Math.max(1, input.adults || 1);
  const children = Math.max(0, input.children || 0);

  const room = await prisma.room.findUnique({ where: { id: input.roomId } });
  if (!room) throw new Error("Room not found");

  if (room.status === "OUT_OF_ORDER") {
    throw new Error("Room is out of order");
  }
  if (room.status !== "VACANT") {
    throw new Error("Only vacant rooms can be checked in — select another room");
  }

  if (await hasRoomConflict(room.id, checkIn, checkOut)) {
    throw new Error("Room is already booked for these dates");
  }

  const nights = Math.max(1, daysBetween(checkIn, checkOut));
  const rate = Number(room.baseRate);

  const scheduledArrival = input.arrivalTime
    ? parseArrivalTime(checkIn, input.arrivalTime)
    : setTime(checkIn, 14, 0);

  const booking = normalizeBookingFields(input);

  const guest = await prisma.guest.create({
    data: {
      fullName: input.fullName.trim(),
      contactNumber: input.contactNumber?.trim() || null,
      idType: input.idType?.trim() || null,
      idNumber: input.idNumber?.trim() || null,
      address: input.address?.trim() || null,
    },
  });

  const reservation = await prisma.reservation.create({
    data: {
      guestId: guest.id,
      roomId: room.id,
      checkIn,
      checkOut,
      scheduledArrival,
      adults,
      children,
      status: "CHECKED_IN",
      bookingType: "GUEST",
      bookingSource: booking.bookingSource,
      bookingPlatform: booking.bookingPlatform,
      bookingReference: booking.bookingReference,
      encodedById: staff.employeeId,
      checkedInById: staff.employeeId,
    },
  });

  await prisma.room.update({
    where: { id: room.id },
    data: { status: "OCCUPIED" },
  });

  await prisma.housekeepingTask.updateMany({
    where: { roomId: room.id },
    data: { status: "CLEAN", notes: null },
  });

  const folioNumber = await createStayFolio(
    reservation.id,
    room.number,
    rate,
    nights,
    0,
    0,
  );

  return {
    reservationId: reservation.id,
    guestId: guest.id,
    folioNumber,
    roomNumber: room.number,
  };
}

export async function createReservation(
  input: CreateReservationInput,
  staff: StaffActionContext,
): Promise<CreateReservationResult> {
  if (!input.fullName.trim()) {
    throw new Error("Guest name is required");
  }
  if (!input.roomId) {
    throw new Error("Please select a room");
  }

  const checkIn = parseDateInput(input.checkIn);
  const checkOut = parseDateInput(input.checkOut);
  const today = startOfDay(new Date());

  if (checkOut <= checkIn) {
    throw new Error("Check-out date must be after check-in date");
  }
  if (checkIn < today) {
    throw new Error("Check-in date cannot be in the past");
  }

  const adults = Math.max(1, input.adults || 1);
  const children = Math.max(0, input.children || 0);
  const extensionDays = Math.max(0, Math.floor(input.extensionDays ?? 0));
  const extensionHours = Math.max(0, Math.floor(input.extensionHours ?? 0));

  const room = await prisma.room.findUnique({ where: { id: input.roomId } });
  if (!room) throw new Error("Room not found");

  if (room.status === "OUT_OF_ORDER") {
    throw new Error("Room is out of order");
  }
  if (checkIn.getTime() === today.getTime() && room.status === "DIRTY") {
    throw new Error("Room needs cleaning — use Check-In after the room is ready");
  }
  if (checkIn.getTime() === today.getTime() && room.status === "OCCUPIED") {
    throw new Error("Room is currently occupied — use Check-In for walk-ins");
  }

  if (await hasRoomConflict(room.id, checkIn, checkOut)) {
    throw new Error("Room is already booked for these dates");
  }

  const scheduledArrival = input.arrivalTime
    ? parseArrivalTime(checkIn, input.arrivalTime)
    : setTime(checkIn, 14, 0);

  const guest = await prisma.guest.create({
    data: {
      fullName: input.fullName.trim(),
      contactNumber: input.contactNumber?.trim() || null,
      idType: input.idType?.trim() || null,
      idNumber: input.idNumber?.trim() || null,
      address: input.address?.trim() || null,
    },
  });

  const booking = normalizeBookingFields({
    bookingSource: input.bookingSource,
    bookingPlatform: input.bookingPlatform,
    bookingReference: input.bookingReference,
  });

  const reservation = await prisma.reservation.create({
    data: {
      guestId: guest.id,
      roomId: room.id,
      checkIn,
      checkOut,
      scheduledArrival,
      adults,
      children,
      extensionDays,
      extensionHours,
      status: "RESERVED",
      bookingType: "GUEST",
      bookingSource: booking.bookingSource,
      bookingPlatform: booking.bookingPlatform,
      bookingReference: booking.bookingReference,
      encodedById: staff.employeeId,
    },
  });

  if (room.status === "VACANT") {
    await prisma.room.update({
      where: { id: room.id },
      data: { status: "RESERVED" },
    });
  }

  const nights = Math.max(1, daysBetween(checkIn, checkOut));
  const rate = Number(room.baseRate);
  const depositAmount = Math.max(0, input.depositAmount ?? 0);
  if (depositAmount > 0 && !input.paymentMethod) {
    throw new Error("Select a payment method for the deposit");
  }

  await createStayFolio(
    reservation.id,
    room.number,
    rate,
    nights,
    extensionDays,
    extensionHours,
    {
      depositAmount,
      paymentMethod: input.paymentMethod,
    },
  );

  return {
    reservationId: reservation.id,
    guestId: guest.id,
    roomNumber: room.number,
  };
}

export async function performCheckInFromReservation(
  reservationId: string,
  staff: StaffActionContext,
): Promise<CheckInResult> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { guest: true, room: true, folio: true },
  });

  if (!reservation) throw new Error("Reservation not found");
  if (reservation.status !== "RESERVED") {
    throw new Error("This reservation is not pending check-in");
  }

  const room = reservation.room;
  if (room.status === "OUT_OF_ORDER") {
    throw new Error("Room is out of order");
  }
  if (room.status === "DIRTY") {
    throw new Error("Room needs cleaning before check-in");
  }

  const otherStay = await prisma.reservation.findFirst({
    where: {
      roomId: room.id,
      status: "CHECKED_IN",
      id: { not: reservationId },
      bookingType: "GUEST",
    },
  });
  if (otherStay) {
    throw new Error("Room is currently occupied by another guest");
  }

  const nights = Math.max(1, daysBetween(reservation.checkIn, reservation.checkOut));
  const rate = Number(room.baseRate);
  let folioNumber: string;

  if (reservation.folio) {
    folioNumber = reservation.folio.folioNumber;
  } else {
    folioNumber = await createStayFolio(
      reservation.id,
      room.number,
      rate,
      nights,
      reservation.extensionDays,
      reservation.extensionHours,
    );
  }

  await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      status: "CHECKED_IN",
      checkedInById: staff.employeeId,
    },
  });

  await prisma.room.update({
    where: { id: room.id },
    data: { status: "OCCUPIED" },
  });

  await prisma.housekeepingTask.updateMany({
    where: { roomId: room.id },
    data: { status: "CLEAN", notes: null },
  });

  return {
    reservationId: reservation.id,
    guestId: reservation.guestId,
    folioNumber,
    roomNumber: room.number,
  };
}

export async function performCheckOut(input: CheckOutInput): Promise<{ roomNumber: string }> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: input.reservationId },
    include: { room: true, folio: true },
  });

  if (!reservation) throw new Error("Reservation not found");
  if (reservation.status !== "CHECKED_IN") {
    throw new Error("Guest is not currently checked in");
  }

  const now = new Date();

  await prisma.reservation.update({
    where: { id: reservation.id },
    data: {
      status: "CHECKED_OUT",
      scheduledDeparture: now,
    },
  });

  await prisma.room.update({
    where: { id: reservation.roomId },
    data: { status: "DIRTY" },
  });

  await prisma.housekeepingTask.updateMany({
    where: { roomId: reservation.roomId },
    data: {
      status: "DIRTY",
      notes: "Checked out — needs cleaning",
    },
  });

  if (reservation.folio) {
    const total = Number(reservation.folio.total);
    let paid = Number(reservation.folio.paid);

    if (input.paymentAmount != null && input.paymentAmount > 0) {
      paid = Math.min(paid + input.paymentAmount, total);
    }

    await prisma.folio.update({
      where: { id: reservation.folio.id },
      data: {
        paid,
        paidAt: paid >= total ? now : reservation.folio.paidAt,
        paymentMethod: input.paymentMethod ?? reservation.folio.paymentMethod ?? "CASH",
      },
    });
  }

  return { roomNumber: reservation.room.number };
}
