"use client";

import type { RoomGridItem } from "@/components/dashboard/RoomStatusGrid";
import { HOUSEKEEPING_STATUS_LABELS } from "@/lib/constants";
import { formatTime } from "@/lib/format";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";

type RoomAttentionModalProps = {
  room: RoomGridItem | null;
  onClose: () => void;
};

function cleaningLabel(room: RoomGridItem): string {
  if (room.housekeepingStatus === "CLEANING") return "Cleaning in progress";
  if (room.housekeepingStatus === "DIRTY" || room.status === "DIRTY") return "Needs cleaning";
  return HOUSEKEEPING_STATUS_LABELS.DIRTY;
}

export function RoomAttentionModal({ room, onClose }: RoomAttentionModalProps) {
  if (!room) return null;

  const arrivingGuest = room.todayReservations?.find(
    (reservation) => reservation.status === "RESERVED",
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-semibold text-slate-800">Room {room.number}</h3>
            <p className="mt-1 text-sm text-room-cleaning">{cleaningLabel(room)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {room.checkoutSummary && (
            <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                Last checkout
              </p>
              <p className="mt-1 font-medium text-slate-800">
                {room.checkoutSummary.guestName} · {formatTime(room.checkoutSummary.checkedOutAt)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Cleared by {room.checkoutSummary.checkedOutByName ?? "staff not recorded"}
              </p>
            </div>
          )}

          {arrivingGuest && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <strong>{arrivingGuest.guestName}</strong> is scheduled to arrive today. The room must
              be cleaned before check-in.
            </p>
          )}

          <p className="text-sm text-slate-600">
            This room is not ready for check-in yet. Housekeeping must finish and mark it clean
            before a guest can use it.
          </p>
          <p className="text-xs text-slate-500">
            To book a future stay, use the{" "}
            <Link href="/calendar" className="font-medium text-room-occupied hover:underline">
              reservation calendar
            </Link>
            .
          </p>

          <Link
            href="/housekeeping"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-room-cleaning py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            <Sparkles className="h-4 w-4" />
            Open housekeeping
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-slate-200 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
