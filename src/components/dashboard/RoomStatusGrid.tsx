"use client";

import { EditRecordModal } from "@/components/admin/EditRecordModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { RoomAttentionModal } from "@/components/dashboard/RoomAttentionModal";
import { ReservationDrawer } from "@/components/calendar/ReservationDrawer";
import { ReservationFormModal } from "@/components/reservations/ReservationFormModal";
import { getRoomGridColor } from "@/lib/constants";
import { isAdministrator } from "@/lib/permissions";
import { roomNeedsCleaningBeforeUse } from "@/lib/room-cleaning";
import { cn } from "@/lib/utils";
import type { HousekeepingStatus, RoomStatus } from "@prisma/client";
import Link from "next/link";
import { useState } from "react";

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
};

type RoomStatusGridProps = {
  rooms: RoomGridItem[];
  bookable?: boolean;
};

function roomClickHint(room: RoomGridItem): string {
  if (room.status === "OUT_OF_ORDER") return `${room.description} · Out of order`;
  if (room.status === "RESERVED" || room.status === "OCCUPIED") {
    return `${room.description} · View today's guest`;
  }
  if (room.status === "DIRTY" || room.housekeepingStatus === "CLEANING") {
    return `${room.description} · Cleaning — click for status`;
  }
  if (room.housekeepingStatus === "DIRTY") {
    return `${room.description} · Needs cleaning — click for status`;
  }
  return `${room.description} · up to ${room.maxPax} guests · Click to book`;
}

export function RoomStatusGrid({ rooms, bookable = true }: RoomStatusGridProps) {
  const user = useAuth();
  const isAdmin = isAdministrator(user.role);

  const [selectedRoom, setSelectedRoom] = useState<RoomGridItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerReservationId, setDrawerReservationId] = useState<string | null>(null);
  const [editReservationId, setEditReservationId] = useState<string | null>(null);
  const [cleaningRoom, setCleaningRoom] = useState<RoomGridItem | null>(null);

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

    if (
      (room.status === "RESERVED" || room.status === "OCCUPIED") &&
      room.activeReservationId
    ) {
      setDrawerReservationId(room.activeReservationId);
      return;
    }

    if (roomNeedsCleaningBeforeUse(room)) {
      setCleaningRoom(room);
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
            const isBookableToday = room.status === "VACANT" && bookable && !roomNeedsCleaningBeforeUse(room);
            const needsCleaning = roomNeedsCleaningBeforeUse(room);
            const isClickable =
              room.status !== "OUT_OF_ORDER" &&
              ((isReservedOrOccupied && Boolean(room.activeReservationId)) ||
                isBookableToday ||
                needsCleaning);

            return (
              <button
                key={room.number}
                type="button"
                disabled={!isClickable}
                onClick={() => handleRoomClick(room)}
                title={roomClickHint(room)}
                className={cn(
                  "flex h-9 items-center justify-center rounded-md text-xs font-semibold shadow-sm transition",
                  getRoomGridColor(room.status, room.housekeepingStatus),
                  isClickable &&
                    "cursor-pointer hover:ring-2 hover:ring-room-occupied/60 hover:ring-offset-1",
                  !isClickable && "cursor-default opacity-80",
                )}
              >
                {room.number}
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
