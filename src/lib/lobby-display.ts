import { getDashboardSummary } from "@/lib/dashboard-data";
import { getHotelSettings } from "@/lib/settings";
import type { HousekeepingStatus, RoomStatus } from "@prisma/client";

export type LobbyRoom = {
  number: string;
  floor: number;
  status: RoomStatus;
  housekeepingStatus: HousekeepingStatus | null;
};

export type LobbyDisplayData = {
  hotelName: string;
  updatedAt: string;
  fromDatabase: boolean;
  occupied: number;
  vacant: number;
  reserved: number;
  dirty: number;
  total: number;
  rooms: LobbyRoom[];
};

export function isValidLobbyDisplayKey(key: string | null | undefined): boolean {
  const secret = process.env.LOBBY_DISPLAY_KEY?.trim();
  if (!secret) return true;
  return Boolean(key && key === secret);
}

export type LobbyLayoutMode = "full" | "split";

export function parseLobbyLayoutMode(value: string | null | undefined): LobbyLayoutMode {
  if (value === "split" || value === "1" || value === "true") return "split";
  return "full";
}

export type LobbyRoomsSide = "left" | "right";

export function parseLobbyRoomsSide(value: string | null | undefined): LobbyRoomsSide {
  return value === "right" ? "right" : "left";
}

/** Ads panel URL from query param or LOBBY_ADS_URL env (https/http only). */
export function resolveLobbyAdsUrl(queryValue: string | null | undefined): string | null {
  const raw = (queryValue?.trim() || process.env.LOBBY_ADS_URL?.trim()) ?? "";
  if (!raw) return null;
  if (/your-ad/i.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function getLobbyDisplayData(): Promise<LobbyDisplayData> {
  const [summary, settings] = await Promise.all([getDashboardSummary(), getHotelSettings()]);

  return {
    hotelName: settings.name,
    updatedAt: new Date().toISOString(),
    fromDatabase: summary.fromDatabase,
    occupied: summary.occupied,
    vacant: summary.vacant,
    reserved: summary.reserved,
    dirty: summary.dirty,
    total: summary.total,
    rooms: summary.rooms.map((room) => ({
      number: room.number,
      floor: room.floor,
      status: room.status,
      housekeepingStatus: room.housekeepingStatus ?? null,
    })),
  };
}
