import type { RoomGridItem } from "@/components/dashboard/RoomStatusGrid";
import { prisma } from "@/lib/db";
import { getRoomCatalogEntry, ROOM_NUMBERS } from "@/lib/room-rates";
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

const FALLBACK_ROOMS: RoomGridItem[] = ROOM_NUMBERS.map((number) => {
  const entry = getRoomCatalogEntry(number);
  const statusByNumber: Record<string, RoomStatus> = {
    "21": "OCCUPIED",
    "22": "OCCUPIED",
    "23": "VACANT",
    "24": "RESERVED",
    "25": "OCCUPIED",
    "26": "DIRTY",
    "27": "OCCUPIED",
    "28": "OCCUPIED",
    "31": "OCCUPIED",
    "32": "VACANT",
    "33": "OCCUPIED",
    "34": "RESERVED",
    "35": "OCCUPIED",
    "36": "DIRTY",
    "37": "OCCUPIED",
    "38": "VACANT",
  };
  return {
    id: `demo-${number}`,
    number,
    floor: entry.floor,
    status: statusByNumber[number] ?? "VACANT",
    description: entry.description,
    maxPax: entry.maxPax,
    baseRate: entry.regularRate,
    breakfastRate: entry.breakfastRate,
  };
});
function summarize(rooms: RoomGridItem[]): Omit<DashboardSummary, "rooms" | "fromDatabase"> {
  const total = rooms.length;
  const count = (status: RoomStatus) => rooms.filter((r) => r.status === status).length;
  return {
    occupied: count("OCCUPIED"),
    vacant: count("VACANT"),
    reserved: count("RESERVED"),
    dirty: count("DIRTY"),
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
    const rooms = FALLBACK_ROOMS;
    return { ...summarize(rooms), rooms, fromDatabase: false };
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
      },
    });

    if (rooms.length === 0) {
      const fallback = FALLBACK_ROOMS;
      return { ...summarize(fallback), rooms: fallback, fromDatabase: false };
    }

    const grid: RoomGridItem[] = rooms.map((r) => ({
      id: r.id,
      number: r.number,
      floor: r.floor,
      status: r.status,
      description: r.description,
      maxPax: r.maxPax,
      baseRate: Number(r.baseRate),
      breakfastRate: r.breakfastRate != null ? Number(r.breakfastRate) : null,
    }));
    return { ...summarize(grid), rooms: grid, fromDatabase: true };
  } catch {
    const rooms = FALLBACK_ROOMS;
    return { ...summarize(rooms), rooms, fromDatabase: false };
  }
}

export function percent(part: number, total: number): string {
  if (total === 0) return "0%";
  return `${((part / total) * 100).toFixed(2)}%`;
}
