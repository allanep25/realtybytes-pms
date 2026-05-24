"use client";

import { ReservationDrawer } from "@/components/calendar/ReservationDrawer";
import type { RoomGridItem } from "@/components/dashboard/RoomStatusGrid";
import { ReservationFormModal } from "@/components/reservations/ReservationFormModal";
import { formatShortDate, formatWeekdayShort } from "@/lib/dates";
import type { ReservationTimelineSerialized } from "@/lib/reservations";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type CalendarTimelineProps = {
  data: ReservationTimelineSerialized;
  rooms?: RoomGridItem[];
  compact?: boolean;
  showNav?: boolean;
  bookable?: boolean;
};

const LEGEND = [
  { label: "Checked in", className: "bg-room-vacant" },
  { label: "Reserved", className: "bg-room-reserved" },
  { label: "Maintenance", className: "bg-room-dirty" },
];

export function CalendarTimeline({
  data,
  rooms = [],
  compact = false,
  showNav = true,
  bookable = true,
}: CalendarTimelineProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bookingRoom, setBookingRoom] = useState<RoomGridItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { days, roomNumbers, bars, weekOffset } = data;
  const colCount = days.length;
  const rangeStart = new Date(data.rangeStart);
  const rangeEnd = new Date(data.rangeEnd);

  const displayRooms = compact ? roomNumbers.slice(0, 6) : roomNumbers;
  const rowHeight = compact ? 30 : 40;

  const roomByNumber = useMemo(
    () => new Map(rooms.map((r) => [r.number, r])),
    [rooms],
  );

  const barsByRoom = new Map<string, typeof bars>();
  for (const bar of bars) {
    const list = barsByRoom.get(bar.roomNumber) ?? [];
    list.push(bar);
    barsByRoom.set(bar.roomNumber, list);
  }

  function navigateWeek(delta: number) {
    const next = weekOffset + delta;
    const base = compact ? "/" : "/calendar";
    router.push(`${base}?week=${next}`);
  }

  function openBooking(roomNumber: string) {
    const room = roomByNumber.get(roomNumber);
    if (room) {
      setBookingRoom(room);
      setModalOpen(true);
    }
  }

  function openGeneralBooking() {
    setBookingRoom(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setBookingRoom(null);
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="font-semibold text-slate-800">Reservation Calendar</h2>
            <p className="text-xs text-slate-500">
              {formatShortDate(rangeStart)} – {formatShortDate(rangeEnd)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!compact && (
              <button
                type="button"
                onClick={openGeneralBooking}
                className="inline-flex items-center gap-1.5 rounded-lg bg-room-reserved px-3 py-2 text-xs font-medium text-slate-900 hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" />
                New Reservation
              </button>
            )}
            {showNav && (
              <>
                <button
                  type="button"
                  onClick={() => navigateWeek(-1)}
                  className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
                  aria-label="Previous week"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => navigateWeek(1)}
                  className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
                  aria-label="Next week"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                {weekOffset !== 0 && (
                  <button
                    type="button"
                    onClick={() => navigateWeek(-weekOffset)}
                    className="rounded-lg px-3 py-2 text-xs font-medium text-room-occupied hover:underline"
                  >
                    Today
                  </button>
                )}
              </>
            )}
            {compact && (
              <Link
                href="/calendar"
                className="text-sm text-room-occupied hover:underline"
              >
                Full calendar
              </Link>
            )}
          </div>
        </div>

        <p className="border-b border-slate-50 px-4 py-1.5 text-xs text-slate-400">
          Click a room number to book · click a bar to view details
        </p>

        <div className="overflow-x-auto p-3">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr>
                <th className="w-16 pb-2 pr-2 text-left text-xs font-medium text-slate-500">
                  Room
                </th>
                {days.map((dayIso) => {
                  const day = new Date(dayIso);
                  return (
                    <th
                      key={dayIso}
                      className="pb-2 text-center text-[10px] font-medium uppercase text-slate-500"
                    >
                      <div>{formatWeekdayShort(day)}</div>
                      <div className="normal-case text-slate-700">{formatShortDate(day)}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {displayRooms.map((roomNumber) => {
                const roomMeta = roomByNumber.get(roomNumber);
                return (
                  <tr key={roomNumber}>
                    <td className="pr-2 align-middle">
                      {roomMeta ? (
                        <button
                          type="button"
                          onClick={() => openBooking(roomNumber)}
                          title={`Book ${roomMeta.description}`}
                          className="text-xs font-semibold text-room-occupied hover:underline"
                        >
                          {roomNumber}
                        </button>
                      ) : (
                        <span className="text-xs font-semibold text-slate-600">{roomNumber}</span>
                      )}
                    </td>
                    <td colSpan={colCount} className="p-0">
                      <div className="relative" style={{ height: rowHeight }}>
                        <div
                          className="absolute inset-0 grid gap-px"
                          style={{
                            gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
                          }}
                        >
                          {days.map((dayIso) => (
                            <div
                              key={dayIso}
                              className="border border-slate-100 bg-slate-50/80"
                            />
                          ))}
                        </div>
                        {(barsByRoom.get(roomNumber) ?? []).map((bar) => (
                          <button
                            key={bar.id}
                            type="button"
                            title={`${bar.guestName} — ${bar.title}`}
                            onClick={() => setSelectedId(bar.id)}
                            className={cn(
                              "absolute top-1 z-10 flex cursor-pointer items-center overflow-hidden rounded px-1.5 text-[10px] font-medium text-white shadow-sm transition hover:ring-2 hover:ring-room-occupied/50",
                              bar.colorClass,
                            )}
                            style={{
                              left: `calc(${(bar.startCol / colCount) * 100}% + 1px)`,
                              width: `calc(${(bar.span / colCount) * 100}% - 2px)`,
                              height: rowHeight - 8,
                            }}
                          >
                            <span className="truncate">{bar.guestName.split(",")[0]}</span>
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-4 border-t border-slate-100 px-5 py-3">
          {LEGEND.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className={cn("h-2.5 w-2.5 rounded", item.className)} />
              {item.label}
            </div>
          ))}
        </div>
      </div>

      <ReservationDrawer
        reservationId={selectedId}
        onClose={() => setSelectedId(null)}
      />

      <ReservationFormModal
        open={modalOpen}
        onClose={closeModal}
        initialRoom={bookingRoom}
        bookable={bookable}
      />
    </>
  );
}
