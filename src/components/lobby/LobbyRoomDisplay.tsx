"use client";

import { getRoomGridColor } from "@/lib/constants";
import type { LobbyDisplayData } from "@/lib/lobby-display";
import { cn } from "@/lib/utils";
import type { HousekeepingStatus, RoomStatus } from "@prisma/client";
import { useEffect, useMemo, useState } from "react";

const REFRESH_MS = 30_000;

const LOBBY_STATUS_LABELS: Record<string, string> = {
  VACANT: "Available",
  OCCUPIED: "Occupied",
  RESERVED: "Arriving today",
  DIRTY: "Cleaning",
  OUT_OF_ORDER: "Maintenance",
};

const LEGEND: { status: RoomStatus; label: string }[] = [
  { status: "VACANT", label: "Available" },
  { status: "OCCUPIED", label: "Occupied" },
  { status: "RESERVED", label: "Arriving today" },
  { status: "DIRTY", label: "Cleaning" },
  { status: "OUT_OF_ORDER", label: "Maintenance" },
];

type LobbyRoomDisplayProps = {
  initialData: LobbyDisplayData;
  displayKey?: string;
  variant?: "full" | "split";
};

function lobbyStatusLabel(status: RoomStatus, housekeepingStatus: HousekeepingStatus | null): string {
  if (status === "OUT_OF_ORDER" || housekeepingStatus === "OUT_OF_ORDER") {
    return LOBBY_STATUS_LABELS.OUT_OF_ORDER;
  }
  if (
    status === "DIRTY" ||
    housekeepingStatus === "DIRTY" ||
    housekeepingStatus === "CLEANING"
  ) {
    return LOBBY_STATUS_LABELS.DIRTY;
  }
  return LOBBY_STATUS_LABELS[status] ?? status;
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  });
}

function formatDateLine(date: Date): string {
  return date.toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  });
}

export function LobbyRoomDisplay({
  initialData,
  displayKey,
  variant = "full",
}: LobbyRoomDisplayProps) {
  const isSplit = variant === "split";
  const [data, setData] = useState(initialData);
  const [now, setNow] = useState(() => new Date());
  const [refreshError, setRefreshError] = useState(false);

  const roomsByFloor = useMemo(() => {
    const floors = new Map<number, LobbyDisplayData["rooms"]>();
    for (const room of data.rooms) {
      const list = floors.get(room.floor) ?? [];
      list.push(room);
      floors.set(room.floor, list);
    }
    return [...floors.entries()].sort(([a], [b]) => a - b);
  }, [data.rooms]);

  useEffect(() => {
    const clockTimer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    async function refresh() {
      try {
        const query = displayKey ? `?key=${encodeURIComponent(displayKey)}` : "";
        const res = await fetch(`/api/lobby/rooms${query}`, { cache: "no-store" });
        if (!res.ok) {
          setRefreshError(true);
          return;
        }
        const next = (await res.json()) as LobbyDisplayData;
        setData(next);
        setRefreshError(false);
      } catch {
        setRefreshError(true);
      }
    }

    const refreshTimer = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => window.clearInterval(refreshTimer);
  }, [displayKey]);

  return (
    <div
      className={cn(
        "lobby-display flex flex-col bg-slate-950 text-white select-none",
        isSplit ? "h-full overflow-y-auto" : "min-h-screen",
      )}
    >
      <header className={cn("border-b border-white/10", isSplit ? "px-4 py-4" : "px-8 py-6")}>
        {!data.fromDatabase && (
          <p className="mb-4 rounded-lg border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-100">
            Database not connected or schema out of date. Run{" "}
            <code className="rounded bg-black/30 px-1">npm run db:deploy</code> locally, or check{" "}
            <code className="rounded bg-black/30 px-1">DATABASE_URL</code> on the server.
          </p>
        )}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p
              className={cn(
                "font-medium uppercase tracking-[0.2em] text-slate-400",
                isSplit ? "text-[10px]" : "text-sm",
              )}
            >
              Room status
            </p>
            <h1
              className={cn(
                "mt-1 font-bold tracking-tight",
                isSplit ? "text-xl" : "text-4xl",
              )}
            >
              {data.hotelName}
            </h1>
            {!isSplit && <p className="mt-2 text-lg text-slate-300">{formatDateLine(now)}</p>}
          </div>

          <div className="text-right">
            <p
              className={cn(
                "font-semibold tabular-nums leading-none",
                isSplit ? "text-2xl" : "text-5xl",
              )}
            >
              {formatClock(now)}
            </p>
            {!isSplit && (
              <p className="mt-2 text-sm text-slate-400">
                {refreshError ? "Update paused — showing last status" : "Live · refreshes every 30s"}
              </p>
            )}
          </div>
        </div>

        <dl
          className={cn(
            "grid gap-2",
            isSplit ? "mt-3 grid-cols-3" : "mt-6 grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-5",
          )}
        >
          {[
            { label: "Occupied", value: data.occupied, className: "bg-room-occupied/20 text-room-occupied" },
            { label: "Available", value: data.vacant, className: "bg-room-vacant/20 text-room-vacant" },
            {
              label: "Arriving",
              value: data.reserved,
              className: "bg-room-reserved/20 text-room-reserved",
            },
            { label: "Cleaning", value: data.dirty, className: "bg-room-cleaning/20 text-room-cleaning" },
            ...(isSplit
              ? []
              : [{ label: "Total rooms", value: data.total, className: "bg-white/10 text-slate-200" }]),
          ].map((item) => (
            <div
              key={item.label}
              className={cn("rounded-xl", isSplit ? "px-2 py-2" : "px-4 py-3", item.className)}
            >
              <dt className={cn("font-medium opacity-80", isSplit ? "text-[10px]" : "text-sm")}>
                {item.label}
              </dt>
              <dd
                className={cn(
                  "mt-0.5 font-bold tabular-nums",
                  isSplit ? "text-lg" : "mt-1 text-3xl",
                )}
              >
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <main className={cn("flex-1", isSplit ? "px-3 py-3" : "px-8 py-6")}>
        <div className={cn(isSplit ? "space-y-4" : "space-y-8")}>
          {roomsByFloor.map(([floor, rooms]) => (
            <section key={floor}>
              <h2
                className={cn(
                  "mb-2 font-semibold uppercase tracking-widest text-slate-400",
                  isSplit ? "text-xs" : "mb-4 text-lg",
                )}
              >
                Floor {floor}
              </h2>
              <div
                className={cn(
                  "grid gap-2",
                  isSplit
                    ? "grid-cols-3 sm:grid-cols-4"
                    : "grid-cols-4 gap-4 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-9 2xl:grid-cols-10",
                )}
              >
                {rooms.map((room) => (
                  <div
                    key={room.number}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-xl shadow-lg",
                      isSplit ? "aspect-square px-1 py-2" : "aspect-square rounded-2xl",
                      getRoomGridColor(room.status, room.housekeepingStatus),
                    )}
                    aria-label={`Room ${room.number}, ${lobbyStatusLabel(room.status, room.housekeepingStatus)}`}
                  >
                    <span
                      className={cn(
                        "font-bold leading-none",
                        isSplit ? "text-lg" : "text-3xl xl:text-4xl",
                      )}
                    >
                      {room.number}
                    </span>
                    {!isSplit && (
                      <span className="mt-2 px-2 text-center text-[10px] font-medium uppercase tracking-wide opacity-90 xl:text-xs">
                        {lobbyStatusLabel(room.status, room.housekeepingStatus)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <footer className={cn("border-t border-white/10", isSplit ? "px-3 py-3" : "px-8 py-5")}>
        <div
          className={cn(
            "flex flex-wrap items-center justify-center",
            isSplit ? "gap-x-3 gap-y-2" : "gap-x-8 gap-y-3",
          )}
        >
          {LEGEND.map((item) => (
            <div key={item.status} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "rounded shadow-sm",
                  isSplit ? "h-3 w-3" : "h-5 w-5 rounded-md",
                  getRoomGridColor(item.status, null),
                )}
                aria-hidden
              />
              <span className={cn("font-medium text-slate-300", isSplit ? "text-[10px]" : "text-sm")}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
        {!isSplit && (
          <p className="mt-4 text-center text-xs text-slate-500">
            Display only · For lobby use · Not for booking or editing
          </p>
        )}
      </footer>
    </div>
  );
}
