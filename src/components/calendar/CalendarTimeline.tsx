"use client";

import { ReservationDrawer } from "@/components/calendar/ReservationDrawer";
import type { RoomGridItem } from "@/components/dashboard/RoomStatusGrid";
import { ReservationFormModal } from "@/components/reservations/ReservationFormModal";
import { formatDayOfMonth, formatMonthYear, formatShortDate, formatWeekdayShort, hotelCalendarDate } from "@/lib/dates";
import type { ReservationTimelineSerialized } from "@/lib/reservations";
import { MaintenanceBlockModal } from "@/components/maintenance/MaintenanceBlockModal";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Plus, Wrench } from "lucide-react";
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
  { label: "Checked in", className: "bg-room-occupied" },
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
  const [blockRoom, setBlockRoom] = useState<RoomGridItem | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);

  const { days, roomNumbers, bars, monthOffset } = data;
  const colCount = days.length;
  const rangeStart = new Date(data.rangeStart);
  const rangeEnd = new Date(data.rangeEnd);
  const todayKey = hotelCalendarDate();
  const isMonthView = colCount > 7;

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

  function navigateMonth(delta: number) {
    const next = monthOffset + delta;
    const base = compact ? "/" : "/calendar";
    router.push(`${base}?month=${next}`);
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

  function openBlock(roomNumber: string) {
    const room = roomByNumber.get(roomNumber);
    if (room) {
      setBlockRoom(room);
      setBlockOpen(true);
    }
  }

  function closeBlockModal() {
    setBlockOpen(false);
    setBlockRoom(null);
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
              {isMonthView
                ? formatMonthYear(rangeStart)
                : `${formatShortDate(rangeStart)} – ${formatShortDate(rangeEnd)}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!compact && bookable && (
              <button
                type="button"
                onClick={openGeneralBooking}
                className="inline-flex items-center gap-1.5 rounded-lg bg-room-reserved px-3 py-2 text-xs font-medium text-slate-900 hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" />
                New Reservation
              </button>
            )}
            {!compact && bookable && (
              <button
                type="button"
                onClick={() => {
                  setBlockRoom(null);
                  setBlockOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Wrench className="h-3.5 w-3.5" />
                Block Room
              </button>
            )}
            {showNav && (
              <>
                <button
                  type="button"
                  onClick={() => navigateMonth(-1)}
                  className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => navigateMonth(1)}
                  className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                {monthOffset !== 0 && (
                  <button
                    type="button"
                    onClick={() => navigateMonth(-monthOffset)}
                    className="rounded-lg px-3 py-2 text-xs font-medium text-room-occupied hover:underline"
                  >
                    This month
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
          <table
            className="w-full border-collapse"
            style={{ minWidth: isMonthView ? `${64 + colCount * 28}px` : "640px" }}
          >
            <thead>
              <tr>
                <th className="sticky left-0 z-20 w-14 bg-card pb-2 pr-2 text-left text-xs font-medium text-slate-500">
                  Room
                </th>
                {days.map((dayIso) => {
                  const day = new Date(dayIso);
                  const dayKey = hotelCalendarDate(day);
                  const isToday = dayKey === todayKey;
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  return (
                    <th
                      key={dayIso}
                      className={cn(
                        "pb-2 text-center font-medium uppercase text-slate-500",
                        isMonthView ? "min-w-[28px] px-0 text-[9px]" : "text-[10px]",
                        isToday && "text-room-occupied",
                        isWeekend && !isToday && "text-slate-400",
                      )}
                    >
                      {isMonthView ? (
                        <>
                          <div className="leading-none">{formatWeekdayShort(day).slice(0, 1)}</div>
                          <div
                            className={cn(
                              "mt-0.5 normal-case leading-none",
                              isToday
                                ? "font-bold text-room-occupied"
                                : "font-semibold text-slate-700",
                            )}
                          >
                            {formatDayOfMonth(day)}
                          </div>
                        </>
                      ) : (
                        <>
                          <div>{formatWeekdayShort(day)}</div>
                          <div className="normal-case text-slate-700">{formatDayOfMonth(day)}</div>
                        </>
                      )}
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
                    <td className="sticky left-0 z-10 bg-card pr-2 align-middle">
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
                              "absolute top-1 z-10 flex cursor-pointer items-center overflow-hidden rounded px-1 text-[9px] font-medium text-white shadow-sm transition hover:ring-2 hover:ring-room-occupied/50",
                              compact && "text-[8px]",
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

      <MaintenanceBlockModal
        open={blockOpen}
        onClose={closeBlockModal}
        room={blockRoom}
        rooms={rooms}
      />
    </>
  );
}
