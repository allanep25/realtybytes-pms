import { prisma } from "@/lib/db";
import { normalizeBookingFields, validateGuestIdAtCheckIn } from "@/lib/booking-source";
import { addDays, addHotelDays, daysBetween, parseHotelCalendarDate, setHotelTime, startOfHotelDay } from "@/lib/dates";
import { recordFolioPayment } from "@/lib/folio-payments";
import { buildStayFolioLines, folioLinesTotal } from "@/lib/stay-pricing";
import { compareRoomNumbers } from "@/lib/utils";
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
  idPhotoFileName?: string;
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
  depositAmount?: number;
  paymentMethod?: PaymentMethod;
};

export type CheckInFromReservationInput = {
  reservationId: string;
  contactNumber?: string;
  idType?: string;
  idNumber?: string;
  idPhotoFileName?: string;
  address?: string;
  paymentAmount?: number;
  paymentMethod?: PaymentMethod;
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
  idPhotoFileName?: string;
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
  return parseHotelCalendarDate(value);
}

function parseArrivalTime(checkIn: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  return setHotelTime(checkIn, h || 14, m || 0);
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

  const folio = await prisma.folio.create({
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

  if (paid > 0 && paymentMethod) {
    await recordFolioPayment(folio.id, paid, paymentMethod);
  }

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
  contactNumber: string | null;
  idType: string | null;
  idNumber: string | null;
  address: string | null;
  isVip: boolean;
  roomNumber: string;
  roomDescription: string;
  checkOut: string;
  total: number;
  paid: number;
  balanceDue: number;
};

export async function getTodayReservedArrivals(): Promise<ReservedArrival[]> {
  const today = startOfHotelDay();
  const tomorrow = addHotelDays(new Date(), 1);

  const rows = await prisma.reservation.findMany({
    where: {
      checkIn: { gte: today, lt: tomorrow },
      status: "RESERVED",
      bookingType: "GUEST",
    },
    include: {
      guest: {
        select: {
          fullName: true,
          contactNumber: true,
          idType: true,
          idNumber: true,
          address: true,
          isVip: true,
        },
      },
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
      contactNumber: r.guest.contactNumber,
      idType: r.guest.idType,
      idNumber: r.guest.idNumber,
      address: r.guest.address,
      isVip: r.guest.isVip,
      roomNumber: r.room.number,
      roomDescription: r.room.description,
      checkOut: r.checkOut.toISOString(),
      total,
      paid,
      balanceDue: Math.max(0, total - paid),
    };
  });
}

export async function getReservationBalanceDue(reservationId: string): Promise<number> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { folio: { select: { total: true, paid: true } } },
  });

  if (!reservation?.folio) return 0;

  const total = Number(reservation.folio.total);
  const paid = Number(reservation.folio.paid);
  return Math.max(0, total - paid);
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
    orderBy: { room: { number: "asc" } },
  });

  return rows
    .map((r) => {
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
    })
    .sort((a, b) => compareRoomNumbers(a.roomNumber, b.roomNumber));
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

  const depositAmount = Math.max(0, input.depositAmount ?? 0);
  if (depositAmount > 0 && !input.paymentMethod) {
    throw new Error("Select a payment method for the deposit");
  }

  const nights = Math.max(1, daysBetween(checkIn, checkOut));
  const rate = Number(room.baseRate);

  const scheduledArrival = input.arrivalTime
    ? parseArrivalTime(checkIn, input.arrivalTime)
    : setHotelTime(checkIn, 14, 0);

  validateGuestIdAtCheckIn(input.idType);
  const booking = normalizeBookingFields(input);

  const guest = await prisma.guest.create({
    data: {
      fullName: input.fullName.trim(),
      contactNumber: input.contactNumber?.trim() || null,
      idType: input.idType?.trim() || null,
      idNumber: input.idNumber?.trim() || null,
      idPhotoFileName: input.idPhotoFileName?.trim() || null,
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
    {
      depositAmount: input.depositAmount,
      paymentMethod: input.paymentMethod,
    },
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
  const today = startOfHotelDay();

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
    : setHotelTime(checkIn, 14, 0);

  const booking = normalizeBookingFields({
    bookingSource: input.bookingSource,
    bookingPlatform: input.bookingPlatform,
    bookingReference: input.bookingReference,
  });

  const guest = await prisma.guest.create({
    data: {
      fullName: input.fullName.trim(),
      contactNumber: input.contactNumber?.trim() || null,
      idType: input.idType?.trim() || null,
      idNumber: input.idNumber?.trim() || null,
      idPhotoFileName: input.idPhotoFileName?.trim() || null,
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
  input: CheckInFromReservationInput,
  staff: StaffActionContext,
): Promise<CheckInResult> {
  const reservationId = input.reservationId;
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { guest: true, room: true, folio: true },
  });

  if (!reservation) throw new Error("Reservation not found");
  if (reservation.status !== "RESERVED") {
    throw new Error("This reservation is not pending check-in");
  }
  if (reservation.bookingType !== "GUEST") {
    throw new Error("Only guest reservations can be checked in");
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

  validateGuestIdAtCheckIn(input.idType, reservation.guest.idType);

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

  if (
    input.contactNumber !== undefined ||
    input.idType !== undefined ||
    input.idNumber !== undefined ||
    input.idPhotoFileName !== undefined ||
    input.address !== undefined
  ) {
    await prisma.guest.update({
      where: { id: reservation.guestId },
      data: {
        contactNumber: input.contactNumber?.trim() || null,
        idType: input.idType?.trim() || null,
        idNumber: input.idNumber?.trim() || null,
        idPhotoFileName: input.idPhotoFileName?.trim() || null,
        address: input.address?.trim() || null,
      },
    });
  }

  if (input.paymentAmount != null && input.paymentAmount > 0 && reservation.folio) {
    const method = input.paymentMethod ?? reservation.folio.paymentMethod ?? "CASH";
    const total = Number(reservation.folio.total);
    const paid = Math.min(Number(reservation.folio.paid) + input.paymentAmount, total);
    await recordFolioPayment(reservation.folio.id, input.paymentAmount, method);
    await prisma.folio.update({
      where: { id: reservation.folio.id },
      data: { paid, paidAt: new Date(), paymentMethod: method },
    });
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

export async function performCheckOut(
  input: CheckOutInput,
  staff: StaffActionContext,
): Promise<{ roomNumber: string }> {
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
      checkedOutById: staff.employeeId,
    },
  });

  await prisma.room.update({
    where: { id: reservation.roomId },
    data: { status: "DIRTY" },
  });

  await prisma.housekeepingTask.upsert({
    where: { roomId: reservation.roomId },
    create: {
      roomId: reservation.roomId,
      status: "DIRTY",
      notes: "Checked out — needs cleaning",
    },
    update: {
      status: "DIRTY",
      notes: "Checked out — needs cleaning",
      assignedTo: null,
    },
  });

  if (reservation.folio) {
    const total = Number(reservation.folio.total);
    let paid = Number(reservation.folio.paid);

    if (input.paymentAmount != null && input.paymentAmount > 0) {
      paid = Math.min(paid + input.paymentAmount, total);
      const method = input.paymentMethod ?? reservation.folio.paymentMethod ?? "CASH";
      await recordFolioPayment(
        reservation.folio.id,
        input.paymentAmount,
        method,
        now,
      );
    }

    await prisma.folio.update({
      where: { id: reservation.folio.id },
      data: {
        paid,
        paidAt:
          input.paymentAmount != null && input.paymentAmount > 0
            ? now
            : paid >= total
              ? now
              : reservation.folio.paidAt,
        paymentMethod: input.paymentMethod ?? reservation.folio.paymentMethod ?? "CASH",
      },
    });
  }

  return { roomNumber: reservation.room.number };
}

export type MaintenanceBlockInput = {
  roomId: string;
  checkIn: string;
  checkOut: string;
  reason?: string;
};

async function getMaintenanceGuestId() {
  const existing = await prisma.guest.findFirst({
    where: { fullName: "Maintenance Block" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const guest = await prisma.guest.create({
    data: { fullName: "Maintenance Block", notes: "System guest for room maintenance blocks" },
  });
  return guest.id;
}

export async function createMaintenanceBlock(
  input: MaintenanceBlockInput,
  staff: StaffActionContext,
) {
  const checkIn = parseDateInput(input.checkIn);
  const checkOut = parseDateInput(input.checkOut);
  if (checkOut <= checkIn) {
    throw new Error("End date must be after start date");
  }

  const room = await prisma.room.findUnique({ where: { id: input.roomId } });
  if (!room) throw new Error("Room not found");

  if (await hasRoomConflict(room.id, checkIn, checkOut)) {
    throw new Error("Room is already booked for these dates");
  }

  const guestId = await getMaintenanceGuestId();
  const note = input.reason?.trim() || "Maintenance block";

  const reservation = await prisma.reservation.create({
    data: {
      guestId,
      roomId: room.id,
      checkIn,
      checkOut,
      status: "RESERVED",
      bookingType: "MAINTENANCE",
      bookingSource: "OTHER",
      encodedById: staff.employeeId,
    },
  });

  const today = startOfHotelDay();
  if (checkIn <= today && checkOut > today) {
    await prisma.room.update({
      where: { id: room.id },
      data: { status: "OUT_OF_ORDER" },
    });
    await prisma.housekeepingTask.upsert({
      where: { roomId: room.id },
      create: { roomId: room.id, status: "OUT_OF_ORDER", notes: note },
      update: { status: "OUT_OF_ORDER", notes: note, assignedTo: null },
    });
  }

  return { reservationId: reservation.id, roomNumber: room.number };
}

async function releaseReservedRoom(roomId: string) {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room || room.status !== "RESERVED") return;

  await prisma.room.update({
    where: { id: roomId },
    data: { status: "VACANT" },
  });
}

export async function cancelReservation(reservationId: string, staff: StaffActionContext) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { room: true },
  });
  if (!reservation) throw new Error("Reservation not found");
  if (reservation.status !== "RESERVED") {
    throw new Error("Only reserved bookings can be cancelled");
  }
  if (reservation.bookingType !== "GUEST") {
    throw new Error("Maintenance blocks must be removed from the calendar");
  }

  await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: "CANCELLED", encodedById: staff.employeeId },
  });

  await releaseReservedRoom(reservation.roomId);
  return { roomNumber: reservation.room.number };
}

export async function markReservationNoShow(reservationId: string, staff: StaffActionContext) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { room: true },
  });
  if (!reservation) throw new Error("Reservation not found");
  if (reservation.status !== "RESERVED") {
    throw new Error("Only reserved bookings can be marked no-show");
  }
  if (reservation.bookingType !== "GUEST") {
    throw new Error("Invalid reservation type");
  }

  await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: "NO_SHOW", encodedById: staff.employeeId },
  });

  await releaseReservedRoom(reservation.roomId);
  return { roomNumber: reservation.room.number };
}

export async function cancelMaintenanceBlock(reservationId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { room: true },
  });
  if (!reservation) throw new Error("Block not found");
  if (reservation.bookingType !== "MAINTENANCE") {
    throw new Error("Not a maintenance block");
  }
  if (reservation.status === "CHECKED_OUT" || reservation.status === "CANCELLED") {
    throw new Error("This block is already closed");
  }

  await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: "CANCELLED" },
  });

  const activeBlock = await prisma.reservation.findFirst({
    where: {
      roomId: reservation.roomId,
      bookingType: "MAINTENANCE",
      status: "RESERVED",
      id: { not: reservationId },
    },
  });

  if (!activeBlock && reservation.room.status === "OUT_OF_ORDER") {
    await prisma.room.update({
      where: { id: reservation.roomId },
      data: { status: "VACANT" },
    });
    await prisma.housekeepingTask.updateMany({
      where: { roomId: reservation.roomId },
      data: { status: "DIRTY", notes: "Maintenance block removed — inspect room" },
    });
  }

  return { roomNumber: reservation.room.number };
}
