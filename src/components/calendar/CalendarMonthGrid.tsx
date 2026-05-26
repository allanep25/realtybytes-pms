"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { EditRecordModal } from "@/components/admin/EditRecordModal";
import { CalendarBookingActions } from "@/components/calendar/CalendarBookingActions";
import { ReservationDrawer } from "@/components/calendar/ReservationDrawer";
import type { RoomGridItem } from "@/components/dashboard/RoomStatusGrid";
import { MaintenanceBlockModal } from "@/components/maintenance/MaintenanceBlockModal";
import { ReservationFormModal } from "@/components/reservations/ReservationFormModal";
import { nextHotelCalendarDate } from "@/lib/dates";
import type { CalendarDayBooking, MonthCalendarGrid } from "@/lib/reservations";
import { isAdministrator } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Plus, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type CalendarMonthGridProps = {
  data: MonthCalendarGrid;
  rooms?: RoomGridItem[];
  bookable?: boolean;
};

const LEGEND = [
  { label: "Checked in", className: "bg-room-occupied" },
  { label: "Reserved", className: "bg-room-reserved" },
  { label: "Maintenance", className: "bg-room-dirty" },
];

type ActionState = {
  dateKey: string;
  reservationId: string | null;
  guestLabel?: string;
  roomNumber?: string;
};

export function CalendarMonthGrid({
  data,
  rooms = [],
  bookable = true,
}: CalendarMonthGridProps) {
  const router = useRouter();
  const user = useAuth();
  const isAdmin = isAdministrator(user.role);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [bookingCheckIn, setBookingCheckIn] = useState<string | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionState, setActionState] = useState<ActionState | null>(null);
  const [availableRooms, setAvailableRooms] = useState<number | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editReservationId, setEditReservationId] = useState<string | null>(null);

  const { monthOffset, monthLabel, weekdayHeaders, weeks } = data;
  const weekCount = weeks.length;

  const fetchAvailableRoomCount = useCallback(async (checkIn: string) => {
    const params = new URLSearchParams({
      checkIn,
      checkOut: nextHotelCalendarDate(checkIn),
    });
    const res = await fetch(`/api/rooms/available?${params}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to check availability");
    return Array.isArray(data) ? data.length : 0;
  }, []);

  function navigateMonth(delta: number) {
    router.push(`/calendar?month=${monthOffset + delta}`);
  }

  function openReservationModal(checkIn: string | null) {
    setBookingCheckIn(checkIn);
    setModalOpen(true);
  }

  function closeReservationModal() {
    setModalOpen(false);
    setBookingCheckIn(null);
  }

  function closeActions() {
    setActionOpen(false);
    setActionState(null);
    setAvailableRooms(null);
    setCheckingAvailability(false);
  }

  async function openDayActions(
    dateKey: string,
    options?: { booking?: CalendarDayBooking; hasBookings?: boolean },
  ) {
    if (!bookable) return;

    setNotice(null);
    setActionState({
      dateKey,
      reservationId: options?.booking?.id ?? null,
      guestLabel: options?.booking?.guestName,
      roomNumber: options?.booking?.roomNumber,
    });
    setActionOpen(true);
    setCheckingAvailability(true);
    setAvailableRooms(null);

    try {
      const count = await fetchAvailableRoomCount(dateKey);
      setAvailableRooms(count);

      const showMenu = Boolean(options?.booking) || Boolean(options?.hasBookings);

      if (!showMenu) {
        closeActions();
        if (count > 0) {
          openReservationModal(dateKey);
        } else {
          setNotice(`No vacant rooms available for ${dateKey}.`);
        }
        return;
      }

      if (count === 0) {
        setNotice(`All rooms are booked on ${dateKey}.`);
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Failed to check room availability");
      closeActions();
    } finally {
      setCheckingAvailability(false);
    }
  }

  async function handleDayClick(day: { dateKey: string; bookings: CalendarDayBooking[] }) {
    if (!bookable) return;
    await openDayActions(day.dateKey, { hasBookings: day.bookings.length > 0 });
  }

  function handleBookingChipClick(
    e: React.MouseEvent,
    day: { dateKey: string },
    booking: CalendarDayBooking,
  ) {
    e.stopPropagation();
    void openDayActions(day.dateKey, { booking, hasBookings: true });
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="font-semibold text-slate-800">Reservation Calendar</h2>
            <p className="text-xs text-slate-500">
              {monthLabel} · {weekCount} week{weekCount === 1 ? "" : "s"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {bookable && (
              <>
                <button
                  type="button"
                  onClick={() => openReservationModal(null)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-room-reserved px-3 py-2 text-xs font-medium text-slate-900 hover:opacity-90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Reservation
                </button>
                <button
                  type="button"
                  onClick={() => setBlockOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Wrench className="h-3.5 w-3.5" />
                  Block Room
                </button>
              </>
            )}
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
          </div>
        </div>

        {notice && (
          <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            {notice}
          </p>
        )}

        <p className="border-b border-slate-50 px-4 py-1.5 text-xs text-slate-400">
          Click any day to book if a room is vacant · click a booking chip for view, add, or edit
          {isAdmin ? " (admin)" : ""}
        </p>

        <div className="p-3">
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
              {weekdayHeaders.map((label) => (
                <div
                  key={label}
                  className="border-r border-slate-200 px-2 py-2 text-center text-xs font-semibold uppercase text-slate-500 last:border-r-0"
                >
                  {label}
                </div>
              ))}
            </div>

            <div
              className="grid grid-cols-7"
              style={{ gridTemplateRows: `repeat(${weekCount}, minmax(140px, 1fr))` }}
            >
              {weeks.flat().map((day) => (
                <div
                  key={day.dateKey}
                  role={bookable ? "button" : undefined}
                  tabIndex={bookable ? 0 : undefined}
                  onClick={() => void handleDayClick(day)}
                  onKeyDown={(e) => {
                    if (!bookable) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      void handleDayClick(day);
                    }
                  }}
                  title={
                    bookable
                      ? day.bookings.length > 0
                        ? `Options for ${day.dateKey}`
                        : `New reservation — check-in ${day.dateKey}`
                      : undefined
                  }
                  className={cn(
                    "group flex min-h-[140px] flex-col border-b border-r border-slate-200 p-2 text-left transition last:border-r-0",
                    !day.inMonth && "bg-slate-50/80",
                    day.isToday && "bg-amber-50/60 ring-1 ring-inset ring-amber-200",
                    day.bookings.length > 0 && "bg-slate-50/40",
                    bookable &&
                      "cursor-pointer hover:bg-amber-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-room-occupied/40",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-semibold",
                        day.isToday
                          ? "bg-room-occupied text-white"
                          : day.inMonth
                            ? "text-slate-800"
                            : "text-slate-400",
                      )}
                    >
                      {day.dayOfMonth}
                    </span>
                    {day.bookings.length > 0 ? (
                      <span className="text-[10px] text-slate-400">{day.bookings.length}</span>
                    ) : bookable ? (
                      <span className="text-[10px] font-medium text-room-occupied opacity-0 transition group-hover:opacity-100">
                        + Book
                      </span>
                    ) : null}
                  </div>

                  <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
                    {day.bookings.map((booking) => (
                      <button
                        key={`${day.dateKey}-${booking.id}`}
                        type="button"
                        title={booking.title}
                        onClick={(e) => handleBookingChipClick(e, day, booking)}
                        className={cn(
                          "flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left text-[10px] font-medium text-white hover:ring-2 hover:ring-room-occupied/40",
                          booking.colorClass,
                        )}
                      >
                        <span className="shrink-0 font-bold">{booking.roomNumber}</span>
                        <span className="truncate">{booking.guestName.split(",")[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
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

      <CalendarBookingActions
        open={actionOpen}
        onClose={closeActions}
        dateKey={actionState?.dateKey ?? ""}
        guestLabel={actionState?.guestLabel}
        roomNumber={actionState?.roomNumber}
        isAdmin={isAdmin}
        availableRooms={availableRooms}
        checkingAvailability={checkingAvailability}
        onView={() => {
          if (actionState?.reservationId) {
            setSelectedId(actionState.reservationId);
          }
          closeActions();
        }}
        onAddBooking={() => {
          if (actionState?.dateKey) {
            openReservationModal(actionState.dateKey);
          }
          closeActions();
        }}
        onEdit={() => {
          if (actionState?.reservationId) {
            setEditReservationId(actionState.reservationId);
          }
          closeActions();
        }}
      />

      <ReservationDrawer
        reservationId={selectedId}
        onClose={() => setSelectedId(null)}
        isAdmin={isAdmin}
        onEditRequest={isAdmin ? setEditReservationId : undefined}
      />

      <EditRecordModal
        open={editReservationId != null}
        reservationId={editReservationId}
        onClose={() => setEditReservationId(null)}
      />

      <ReservationFormModal
        open={modalOpen}
        onClose={closeReservationModal}
        initialCheckIn={bookingCheckIn}
        bookable={bookable}
      />

      <MaintenanceBlockModal
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        room={null}
        rooms={rooms}
      />
    </>
  );
}
