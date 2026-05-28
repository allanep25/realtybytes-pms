import type {
  RoomGridItem,
  RoomGridReservation,
} from "@/components/dashboard/RoomStatusGrid";
import { prisma } from "@/lib/db";
import {
  deriveOperationalRoomStatus,
  syncAllRoomOperationalStatuses,
  todayGuestStayWhere,
} from "@/lib/room-status";
import { compareRoomNumbers } from "@/lib/utils";
import type { ReservationStatus, RoomStatus } from "@prisma/client";

export type DashboardSummary = {
  occupied: number;
  vacant: number;
  reserved: number;
  dirty: number;
  total: number;
  rooms: RoomGridItem[];
  fromDatabase: boolean;
};

const EMPTY_SUMMARY: DashboardSummary = {
  occupied: 0,
  vacant: 0,
  reserved: 0,
  dirty: 0,
  total: 0,
  rooms: [],
  fromDatabase: false,
};

function isDirtyRoom(room: RoomGridItem): boolean {
  return (
    room.status === "DIRTY" ||
    room.housekeepingStatus === "DIRTY" ||
    room.housekeepingStatus === "CLEANING"
  );
}

export type DashboardStatFilter = "occupied" | "vacant" | "reserved" | "dirty";

export function roomMatchesDashboardFilter(
  room: RoomGridItem,
  filter: DashboardStatFilter,
): boolean {
  switch (filter) {
    case "occupied":
      return room.status === "OCCUPIED";
    case "vacant":
      return room.status === "VACANT";
    case "reserved":
      return room.status === "RESERVED";
    case "dirty":
      return isDirtyRoom(room);
  }
}

function summarize(rooms: RoomGridItem[]): Omit<DashboardSummary, "rooms" | "fromDatabase"> {
  const total = rooms.length;
  const count = (status: RoomStatus) => rooms.filter((r) => r.status === status).length;
  return {
    occupied: count("OCCUPIED"),
    vacant: count("VACANT"),
    reserved: count("RESERVED"),
    dirty: rooms.filter(isDirtyRoom).length,
    total,
  };
}

type DashboardTodayStay = RoomGridReservation & {
  roomId: string;
};

const RESERVATION_PRIORITY: Record<Extract<ReservationStatus, "CHECKED_IN" | "RESERVED">, number> = {
  CHECKED_IN: 0,
  RESERVED: 1,
};

function getReservationSortTime(reservation: DashboardTodayStay): string {
  return (
    reservation.scheduledDeparture ??
    reservation.scheduledArrival ??
    reservation.checkOut ??
    reservation.checkIn
  );
}

function compareTodayStays(a: DashboardTodayStay, b: DashboardTodayStay): number {
  const priorityDifference = RESERVATION_PRIORITY[a.status] - RESERVATION_PRIORITY[b.status];
  if (priorityDifference !== 0) return priorityDifference;
  return getReservationSortTime(a).localeCompare(getReservationSortTime(b));
}

function isPlaceholderDatabaseUrl(url: string | undefined): boolean {
  if (!url) return true;
  return (
    url.includes("user:password@localhost") ||
    url === "postgresql://user:password@localhost:5432/amar_residence?schema=public"
  );
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const databaseUrl = process.env.DATABASE_URL;

  if (isPlaceholderDatabaseUrl(databaseUrl)) {
    return EMPTY_SUMMARY;
  }

  try {
    await syncAllRoomOperationalStatuses();

    const [rooms, todayStays] = await Promise.all([
      prisma.room.findMany({
        orderBy: [{ floor: "asc" }, { number: "asc" }],
        select: {
          id: true,
          number: true,
          floor: true,
          status: true,
          description: true,
          maxPax: true,
          baseRate: true,
          breakfastRate: true,
          housekeepingTask: { select: { status: true } },
        },
      }),
      prisma.reservation.findMany({
        where: todayGuestStayWhere(),
        select: {
          id: true,
          roomId: true,
          status: true,
          checkIn: true,
          checkOut: true,
          scheduledArrival: true,
          scheduledDeparture: true,
          guest: { select: { fullName: true } },
        },
      }),
    ]);

    const todayStaysByRoom = new Map<string, DashboardTodayStay[]>();

    for (const reservation of todayStays) {
      const stays = todayStaysByRoom.get(reservation.roomId) ?? [];
      stays.push({
        id: reservation.id,
        roomId: reservation.roomId,
        status: reservation.status as Extract<ReservationStatus, "CHECKED_IN" | "RESERVED">,
        guestName: reservation.guest.fullName,
        checkIn: reservation.checkIn.toISOString(),
        checkOut: reservation.checkOut.toISOString(),
        scheduledArrival: reservation.scheduledArrival?.toISOString() ?? null,
        scheduledDeparture: reservation.scheduledDeparture?.toISOString() ?? null,
      });
      todayStaysByRoom.set(reservation.roomId, stays);
    }

    const grid: RoomGridItem[] = rooms
      .map((r) => {
        const housekeepingStatus = r.housekeepingTask?.status ?? null;
        const todayReservations = (todayStaysByRoom.get(r.id) ?? []).sort(compareTodayStays);
        const todayStay = todayReservations[0] ?? null;
        const status = deriveOperationalRoomStatus(r.status, housekeepingStatus, todayStay);

        return {
          id: r.id,
          number: r.number,
          floor: r.floor,
          status,
          housekeepingStatus,
          description: r.description,
          maxPax: r.maxPax,
          baseRate: Number(r.baseRate),
          breakfastRate: r.breakfastRate != null ? Number(r.breakfastRate) : null,
          activeReservationId: todayStay?.id ?? null,
          todayReservations: todayReservations.map(({ roomId: _roomId, ...reservation }) => reservation),
        };
      })
      .sort((a, b) => compareRoomNumbers(a.number, b.number));

    return { ...summarize(grid), rooms: grid, fromDatabase: true };
  } catch {
    return EMPTY_SUMMARY;
  }
}

export function percent(part: number, total: number): string {
  if (total === 0) return "0%";
  return `${((part / total) * 100).toFixed(2)}%`;
}
