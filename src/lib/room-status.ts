import { prisma } from "@/lib/db";
import { addHotelDays, startOfHotelDay } from "@/lib/dates";
import type { HousekeepingStatus, ReservationStatus, RoomStatus } from "@prisma/client";

export type TodayStayReservation = {
  id: string;
  roomId: string;
  status: ReservationStatus;
};

/** True when a stay overlaps the hotel calendar day (check-in ≤ day < check-out). */
export function reservationOverlapsHotelDay(
  checkIn: Date,
  checkOut: Date,
  day: Date = startOfHotelDay(),
): boolean {
  const dayStart = startOfHotelDay(day);
  const dayEnd = addHotelDays(dayStart, 1);
  return checkIn < dayEnd && checkOut > dayStart;
}

export function todayGuestStayWhere(day: Date = startOfHotelDay()) {
  const tomorrow = addHotelDays(day, 1);
  return {
    bookingType: "GUEST" as const,
    status: { in: ["RESERVED", "CHECKED_IN"] as ReservationStatus[] },
    checkIn: { lt: tomorrow },
    checkOut: { gt: day },
  };
}

/** Front-desk monitoring status for a single day — ignores future-only bookings. */
export function deriveOperationalRoomStatus(
  storedStatus: RoomStatus,
  housekeepingStatus: HousekeepingStatus | null | undefined,
  todayStay: { status: ReservationStatus } | null | undefined,
): RoomStatus {
  if (storedStatus === "OUT_OF_ORDER" || housekeepingStatus === "OUT_OF_ORDER") {
    return "OUT_OF_ORDER";
  }

  if (todayStay?.status === "CHECKED_IN") {
    return "OCCUPIED";
  }

  if (todayStay?.status === "RESERVED") {
    return "RESERVED";
  }

  if (
    storedStatus === "DIRTY" ||
    housekeepingStatus === "DIRTY" ||
    housekeepingStatus === "CLEANING"
  ) {
    return "DIRTY";
  }

  return "VACANT";
}

/** Align stored room.status with reservations and housekeeping for today. */
export async function syncRoomOperationalStatus(
  roomId: string,
  day: Date = startOfHotelDay(),
): Promise<RoomStatus> {
  const tomorrow = addHotelDays(day, 1);

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { housekeepingTask: true },
  });
  if (!room) {
    throw new Error("Room not found");
  }

  const maintenanceToday = await prisma.reservation.findFirst({
    where: {
      roomId,
      bookingType: "MAINTENANCE",
      status: { notIn: ["CANCELLED", "NO_SHOW", "CHECKED_OUT"] },
      checkIn: { lt: tomorrow },
      checkOut: { gt: day },
    },
  });

  if (maintenanceToday) {
    const status: RoomStatus = "OUT_OF_ORDER";
    if (room.status !== status) {
      await prisma.room.update({ where: { id: roomId }, data: { status } });
    }
    return status;
  }

  const checkedInToday = await prisma.reservation.findFirst({
    where: {
      roomId,
      bookingType: "GUEST",
      status: "CHECKED_IN",
      checkIn: { lt: tomorrow },
      checkOut: { gt: day },
    },
  });

  if (checkedInToday) {
    const status: RoomStatus = "OCCUPIED";
    if (room.status !== status) {
      await prisma.room.update({ where: { id: roomId }, data: { status } });
    }
    return status;
  }

  const reservedToday = await prisma.reservation.findFirst({
    where: {
      roomId,
      bookingType: "GUEST",
      status: "RESERVED",
      checkIn: { lt: tomorrow },
      checkOut: { gt: day },
    },
  });

  if (reservedToday) {
    const status: RoomStatus = "RESERVED";
    if (room.status !== status) {
      await prisma.room.update({ where: { id: roomId }, data: { status } });
    }
    return status;
  }

  const hkStatus = room.housekeepingTask?.status;
  const status: RoomStatus =
    hkStatus === "DIRTY" || hkStatus === "CLEANING" ? "DIRTY" : "VACANT";

  if (room.status !== status) {
    await prisma.room.update({ where: { id: roomId }, data: { status } });
  }

  return status;
}

export async function syncAllRoomOperationalStatuses(day: Date = startOfHotelDay()): Promise<void> {
  const rooms = await prisma.room.findMany({ select: { id: true } });
  for (const room of rooms) {
    await syncRoomOperationalStatus(room.id, day);
  }
}
