"use client";

import { ReservationFormModal } from "@/components/reservations/ReservationFormModal";
import { getRoomGridColor } from "@/lib/constants";
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
};

type RoomStatusGridProps = {
  rooms: RoomGridItem[];
  bookable?: boolean;
};

export function RoomStatusGrid({ rooms, bookable = true }: RoomStatusGridProps) {
  const [selectedRoom, setSelectedRoom] = useState<RoomGridItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  function openBooking(room: RoomGridItem) {
    setSelectedRoom(room);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedRoom(null);
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-card p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Room Status</h2>
            <p className="text-xs text-slate-400">Click a room to book</p>
          </div>
          <Link href="/rooms" className="text-xs text-room-occupied hover:underline">
            View All Rooms
          </Link>
        </div>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
          {rooms.map((room) => (
            <button
              key={room.number}
              type="button"
              onClick={() => openBooking(room)}
              title={`${room.description} · up to ${room.maxPax} guests · Click to book`}
              className={cn(
                "flex h-9 cursor-pointer items-center justify-center rounded-md text-xs font-semibold shadow-sm transition hover:ring-2 hover:ring-room-occupied/60 hover:ring-offset-1",
                getRoomGridColor(room.status, room.housekeepingStatus),
              )}
            >
              {room.number}
            </button>
          ))}
        </div>
      </div>

      <ReservationFormModal
        open={modalOpen}
        onClose={closeModal}
        initialRoom={selectedRoom}
        bookable={bookable}
      />
    </>
  );
}
