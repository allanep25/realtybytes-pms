import type { RoomGridItem } from "@/components/dashboard/RoomStatusGrid";
import { prisma } from "@/lib/db";
import { compareRoomNumbers } from "@/lib/utils";
import type { RoomStatus } from "@prisma/client";

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
    const rooms = await prisma.room.findMany({
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
    });

    const grid: RoomGridItem[] = rooms
      .map((r) => ({
        id: r.id,
        number: r.number,
        floor: r.floor,
        status: r.status,
        housekeepingStatus: r.housekeepingTask?.status ?? null,
        description: r.description,
        maxPax: r.maxPax,
        baseRate: Number(r.baseRate),
        breakfastRate: r.breakfastRate != null ? Number(r.breakfastRate) : null,
      }))
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
