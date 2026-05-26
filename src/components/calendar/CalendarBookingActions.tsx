"use client";

import { cn } from "@/lib/utils";
import { CalendarPlus, Eye, Pencil, X } from "lucide-react";

type CalendarBookingActionsProps = {
  open: boolean;
  onClose: () => void;
  dateKey: string;
  guestLabel?: string;
  roomNumber?: string;
  isAdmin: boolean;
  availableRooms: number | null;
  checkingAvailability?: boolean;
  onView: () => void;
  onAddBooking: () => void;
  onEdit: () => void;
};

export function CalendarBookingActions({
  open,
  onClose,
  dateKey,
  guestLabel,
  roomNumber,
  isAdmin,
  availableRooms,
  checkingAvailability = false,
  onView,
  onAddBooking,
  onEdit,
}: CalendarBookingActionsProps) {
  if (!open) return null;

  const canAdd = !checkingAvailability && availableRooms != null && availableRooms > 0;
  const fullyBooked = !checkingAvailability && availableRooms === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-semibold text-slate-800">
              {guestLabel ? "Booking options" : "Day options"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {dateKey}
              {roomNumber ? ` · Room ${roomNumber}` : ""}
            </p>
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

        <div className="space-y-2 p-4">
          {guestLabel && (
            <button
              type="button"
              onClick={onView}
              className="flex w-full items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-left text-sm hover:bg-slate-50"
            >
              <Eye className="h-4 w-4 text-slate-500" />
              <span>
                <span className="font-medium text-slate-800">View reservation</span>
                <span className="mt-0.5 block text-xs text-slate-500">{guestLabel}</span>
              </span>
            </button>
          )}

          <button
            type="button"
            disabled={!canAdd}
            onClick={onAddBooking}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm",
              canAdd
                ? "border-room-reserved/40 bg-room-reserved/10 hover:bg-room-reserved/20"
                : "cursor-not-allowed border-slate-200 bg-slate-50 opacity-70",
            )}
          >
            <CalendarPlus className="h-4 w-4 text-room-occupied" />
            <span>
              <span className="font-medium text-slate-800">Add reservation</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {checkingAvailability
                  ? "Checking vacant rooms…"
                  : fullyBooked
                    ? "No vacant rooms for this date"
                    : `${availableRooms} room${availableRooms === 1 ? "" : "s"} available`}
              </span>
            </span>
          </button>

          {isAdmin && guestLabel && (
            <button
              type="button"
              onClick={onEdit}
              className="flex w-full items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-left text-sm hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4 text-slate-500" />
              <span>
                <span className="font-medium text-slate-800">Edit record</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Administrator — fix guest or stay details
                </span>
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
