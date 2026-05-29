"use client";

import { EditRecordModal } from "@/components/admin/EditRecordModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { RoomAttentionModal } from "@/components/dashboard/RoomAttentionModal";
import { ReservationDrawer } from "@/components/calendar/ReservationDrawer";
import { ReservationFormModal } from "@/components/reservations/ReservationFormModal";
import { getRoomGridColor } from "@/lib/constants";
import { formatTime } from "@/lib/format";
import { isAdministrator } from "@/lib/permissions";
import { roomGridShowsCleaningColor } from "@/lib/room-cleaning";
import { cn } from "@/lib/utils";
import type { HousekeepingStatus, ReservationStatus, RoomStatus } from "@prisma/client";
import Link from "next/link";
import { useState } from "react";

export type RoomGridReservation = {
  id: string;
  status: Extract<ReservationStatus, "CHECKED_IN" | "RESERVED">;
  guestName: string;
  checkIn: string;
  checkOut: string;
  scheduledArrival: string | null;
  scheduledDeparture: string | null;
};

export type RoomCheckoutSummary = {
  guestName: string;
  checkedOutAt: string;
  checkedOutByName: string | null;
};

export type RoomGridItem = {
  id: string;
  number: string;
  floor: number;
  status: RoomStatus;
  housekeepingStatus?: HousekeepingStatus | null;
  description: string;
  maxPax: number;
  baseRate: number;
  breakfastRate: number | null;
  /** Guest reservation when status is RESERVED or OCCUPIED */
  activeReservationId?: string | null;
  /** All guest reservations touching today for this room, ordered by front-desk priority. */
  todayReservations?: RoomGridReservation[];
  /** Most recent checkout that made this room need housekeeping. */
  checkoutSummary?: RoomCheckoutSummary | null;
};

type RoomStatusGridProps = {
  rooms: RoomGridItem[];
  bookable?: boolean;
};

function roomClickHint(room: RoomGridItem): string {
  if ((room.todayReservations?.length ?? 0) > 1) {
    return `${room.description} · View today's departing and arriving guests`;
  }
  if (room.status === "OUT_OF_ORDER") return `${room.description} · Out of order`;
  if (roomGridShowsCleaningColor(room)) {
    if (room.housekeepingStatus === "CLEANING") {
      return `${room.description} · Cleaning — click for status`;
    }
    return `${room.description} · Needs cleaning — click for status`;
  }
  if (room.status === "RESERVED" || room.status === "OCCUPIED") {
    return `${room.description} · View today's guest`;
  }
  return `${room.description} · up to ${room.maxPax} guests · Click to book`;
}

function reservationTimeLabel(reservation: RoomGridReservation): string {
  if (reservation.status === "CHECKED_IN") {
    return `Occupied until ${formatTime(reservation.scheduledDeparture ?? reservation.checkOut)}`;
  }

  return `Arrives ${formatTime(reservation.scheduledArrival ?? reservation.checkIn)}`;
}

function reservationStatusLabel(reservation: RoomGridReservation): string {
  return reservation.status === "CHECKED_IN" ? "In-house" : "Reserved";
}

type TodayReservationPickerProps = {
  room: RoomGridItem | null;
  onClose: () => void;
  onSelect: (reservationId: string) => void;
};

function TodayReservationPicker({ room, onClose, onSelect }: TodayReservationPickerProps) {
  if (!room || !room.todayReservations || room.todayReservations.length <= 1) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="today-room-guests-title"
      >
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 id="today-room-guests-title" className="text-sm font-semibold text-slate-800">
            Room {room.number} today
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Same-day departure and arrival. Choose which guest record to open.
          </p>
        </div>

        <div className="space-y-2 p-4">
          {room.todayReservations.map((reservation) => (
            <button
              key={reservation.id}
              type="button"
              onClick={() => onSelect(reservation.id)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-room-occupied/40 hover:bg-white"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-800">{reservation.guestName}</span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                    reservation.status === "CHECKED_IN"
                      ? "bg-room-occupied/15 text-room-occupied"
                      : "bg-room-reserved/40 text-slate-900",
                  )}
                >
                  {reservationStatusLabel(reservation)}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{reservationTimeLabel(reservation)}</p>
            </button>
          ))}
        </div>

        <div className="border-t border-slate-100 p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function RoomStatusGrid({ rooms, bookable = true }: RoomStatusGridProps) {
  const user = useAuth();
  const isAdmin = isAdministrator(user.role);

  const [selectedRoom, setSelectedRoom] = useState<RoomGridItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerReservationId, setDrawerReservationId] = useState<string | null>(null);
  const [editReservationId, setEditReservationId] = useState<string | null>(null);
  const [cleaningRoom, setCleaningRoom] = useState<RoomGridItem | null>(null);
  const [reservationPickerRoom, setReservationPickerRoom] = useState<RoomGridItem | null>(null);

  function openBooking(room: RoomGridItem) {
    setSelectedRoom(room);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedRoom(null);
  }

  function handleRoomClick(room: RoomGridItem) {
    if (room.status === "OUT_OF_ORDER") return;

    // Blue grid = cleaning — always show the housekeeping notice first.
    if (roomGridShowsCleaningColor(room)) {
      setCleaningRoom(room);
      return;
    }

    if ((room.todayReservations?.length ?? 0) > 1) {
      setReservationPickerRoom(room);
      return;
    }

    if (
      (room.status === "RESERVED" || room.status === "OCCUPIED") &&
      room.activeReservationId
    ) {
      setDrawerReservationId(room.activeReservationId);
      return;
    }

    if (room.status === "VACANT" && bookable) {
      openBooking(room);
    }
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-card p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Room Status</h2>
            <p className="text-xs text-slate-400">
              Today only · Vacant = walk-in or booking · Arriving today = view guest
            </p>
          </div>
          <Link href="/rooms" className="text-xs text-room-occupied hover:underline">
            View All Rooms
          </Link>
        </div>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
          {rooms.map((room) => {
            const isReservedOrOccupied =
              room.status === "RESERVED" || room.status === "OCCUPIED";
            const isBookableToday =
              room.status === "VACANT" && bookable && !roomGridShowsCleaningColor(room);
            const needsCleaning = roomGridShowsCleaningColor(room);
            const hasSameDayTurn = (room.todayReservations?.length ?? 0) > 1;
            const isClickable =
              room.status !== "OUT_OF_ORDER" &&
              (needsCleaning ||
                hasSameDayTurn ||
                (isReservedOrOccupied && Boolean(room.activeReservationId)) ||
                isBookableToday);

            return (
              <button
                key={room.number}
                type="button"
                disabled={!isClickable}
                onClick={() => handleRoomClick(room)}
                title={roomClickHint(room)}
                className={cn(
                  "relative flex h-9 items-center justify-center rounded-md text-xs font-semibold shadow-sm transition",
                  getRoomGridColor(room.status, room.housekeepingStatus),
                  hasSameDayTurn && "ring-2 ring-amber-400 ring-offset-1",
                  isClickable &&
                    "cursor-pointer hover:ring-2 hover:ring-room-occupied/60 hover:ring-offset-1",
                  !isClickable && "cursor-default opacity-80",
                )}
              >
                {room.number}
                {hasSameDayTurn && (
                  <span className="absolute -right-1 -top-1 rounded-full bg-amber-500 px-1 text-[9px] font-bold leading-3 text-white">
                    2
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <ReservationFormModal
        open={modalOpen}
        onClose={closeModal}
        initialRoom={selectedRoom}
        bookable={bookable}
      />

      <RoomAttentionModal room={cleaningRoom} onClose={() => setCleaningRoom(null)} />

      <TodayReservationPicker
        room={reservationPickerRoom}
        onClose={() => setReservationPickerRoom(null)}
        onSelect={(reservationId) => {
          setReservationPickerRoom(null);
          setDrawerReservationId(reservationId);
        }}
      />

      <ReservationDrawer
        reservationId={drawerReservationId}
        onClose={() => setDrawerReservationId(null)}
        isAdmin={isAdmin}
        onEditRequest={
          isAdmin
            ? (id) => {
                setEditReservationId(id);
                setDrawerReservationId(null);
              }
            : undefined
        }
      />

      <EditRecordModal
        open={editReservationId != null}
        reservationId={editReservationId}
        onClose={() => setEditReservationId(null)}
      />
    </>
  );
}
