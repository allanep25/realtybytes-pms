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

function splitGridLayout(roomCount: number): { cols: number; rows: number } {
  if (roomCount <= 4) return { cols: roomCount, rows: 1 };
  if (roomCount <= 8) return { cols: 4, rows: 2 };
  if (roomCount <= 10) return { cols: 5, rows: 2 };
  const cols = 5;
  return { cols, rows: Math.ceil(roomCount / cols) };
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

  const edgePadding = isSplit ? "px-4" : "px-6 lg:px-10 xl:px-12";

  return (
    <div
      className={cn(
        "lobby-display flex w-full flex-col bg-slate-950 text-white select-none",
        isSplit ? "h-full min-h-0 overflow-hidden" : "min-h-screen",
      )}
    >
      <header
        className={cn(
          "w-full shrink-0 border-b border-white/10",
          edgePadding,
          isSplit ? "py-2" : "py-6",
        )}
      >
        {!data.fromDatabase && !isSplit && (
          <p className="mb-4 rounded-lg border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-100">
            Database not connected or schema out of date. Run{" "}
            <code className="rounded bg-black/30 px-1">npm run db:deploy</code> locally, or check{" "}
            <code className="rounded bg-black/30 px-1">DATABASE_URL</code> on the server.
          </p>
        )}
        <div className={cn("flex items-center justify-between gap-3", isSplit && "gap-2")}>
          <div className="min-w-0">
            {!isSplit && (
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
                Room status
              </p>
            )}
            <h1
              className={cn(
                "font-bold tracking-tight truncate",
                isSplit ? "text-lg leading-tight" : "mt-1 text-4xl",
              )}
            >
              {data.hotelName}
            </h1>
            {!isSplit && <p className="mt-2 text-lg text-slate-300">{formatDateLine(now)}</p>}
          </div>

          <div className="shrink-0 text-right">
            <p
              className={cn(
                "font-semibold tabular-nums leading-none",
                isSplit ? "text-xl" : "text-5xl",
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
            "grid w-full",
            isSplit ? "mt-2 grid-cols-4 gap-1.5" : "mt-6 grid-cols-5 gap-3",
          )}
        >
          {[
            { label: "Occupied", value: data.occupied, className: "bg-room-occupied/20 text-room-occupied" },
            { label: "Available", value: data.vacant, className: "bg-room-vacant/20 text-room-vacant" },
            {
              label: isSplit ? "Arriving" : "Arriving",
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
              className={cn(
                "rounded-lg",
                isSplit ? "px-2 py-1" : "rounded-xl px-4 py-3",
                item.className,
              )}
            >
              <dt className={cn("font-medium opacity-80", isSplit ? "text-[9px]" : "text-sm")}>
                {item.label}
              </dt>
              <dd
                className={cn(
                  "font-bold tabular-nums leading-none",
                  isSplit ? "text-base" : "mt-1 text-3xl",
                )}
              >
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <main
        className={cn(
          "flex w-full min-h-0 flex-1 flex-col",
          edgePadding,
          isSplit ? "gap-1.5 py-2" : "py-6",
        )}
      >
        {isSplit ? (
          roomsByFloor.map(([floor, rooms]) => {
            const { cols, rows } = splitGridLayout(rooms.length);
            return (
              <section key={floor} className="flex min-h-0 flex-1 flex-col">
                <h2 className="mb-1 shrink-0 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  Floor {floor}
                </h2>
                <div
                  className="grid min-h-0 flex-1 gap-1.5"
                  style={{
                    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
                  }}
                >
                  {rooms.map((room) => (
                    <div
                      key={room.number}
                      className={cn(
                        "flex h-full min-h-0 w-full items-center justify-center rounded-lg shadow-md",
                        getRoomGridColor(room.status, room.housekeepingStatus),
                      )}
                      aria-label={`Room ${room.number}, ${lobbyStatusLabel(room.status, room.housekeepingStatus)}`}
                    >
                      <span className="text-xl font-bold leading-none sm:text-2xl">{room.number}</span>
                    </div>
                  ))}
                </div>
              </section>
            );
          })
        ) : (
        <div className="space-y-8">
          {roomsByFloor.map(([floor, rooms]) => (
            <section key={floor} className="w-full">
              <h2 className="mb-4 text-lg font-semibold uppercase tracking-widest text-slate-400">
                Floor {floor}
              </h2>
              <div
                className="grid w-full gap-4"
                style={{ gridTemplateColumns: `repeat(${rooms.length}, minmax(0, 1fr))` }}
              >
                {rooms.map((room) => (
                  <div
                    key={room.number}
                    className={cn(
                      "flex w-full min-h-[92px] flex-col items-center justify-center rounded-2xl py-4 shadow-lg xl:min-h-[108px]",
                      getRoomGridColor(room.status, room.housekeepingStatus),
                    )}
                    aria-label={`Room ${room.number}, ${lobbyStatusLabel(room.status, room.housekeepingStatus)}`}
                  >
                    <span className="text-3xl font-bold leading-none xl:text-4xl">{room.number}</span>
                    <span className="mt-2 px-2 text-center text-[10px] font-medium uppercase tracking-wide opacity-90 xl:text-xs">
                      {lobbyStatusLabel(room.status, room.housekeepingStatus)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
        )}
      </main>

      <footer
        className={cn(
          "w-full shrink-0 border-t border-white/10",
          edgePadding,
          isSplit ? "py-2" : "py-5",
        )}
      >
        <div
          className={cn(
            "flex w-full flex-wrap items-center",
            isSplit ? "justify-between gap-x-2 gap-y-1" : "justify-between gap-x-4 gap-y-3",
          )}
        >
          {LEGEND.map((item) => (
            <div key={item.status} className="flex items-center gap-1">
              <span
                className={cn(
                  "rounded shadow-sm",
                  isSplit ? "h-2.5 w-2.5" : "h-5 w-5 rounded-md",
                  getRoomGridColor(item.status, null),
                )}
                aria-hidden
              />
              <span className={cn("font-medium text-slate-300", isSplit ? "text-[9px]" : "text-sm")}>
                {isSplit && item.label === "Arriving today" ? "Arriving" : item.label}
              </span>
            </div>
          ))}
        </div>
        {!isSplit && (
          <p className="mt-4 text-left text-xs text-slate-500">
            Display only · For lobby use · Not for booking or editing
          </p>
        )}
      </footer>
    </div>
  );
}
