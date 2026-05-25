"use client";

import type { RoomGridItem } from "@/components/dashboard/RoomStatusGrid";
import { getRoomGridColor } from "@/lib/constants";
import type { DashboardStatFilter } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

type RoomStatModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  rooms: RoomGridItem[];
  filter: DashboardStatFilter | null;
};

export function RoomStatModal({ open, onClose, title, rooms, filter }: RoomStatModalProps) {
  if (!open || !filter) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-xl bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
            <p className="text-xs text-slate-400">
              {rooms.length} room{rooms.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4">
          {rooms.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No rooms in this category.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  title={room.description}
                  className={cn(
                    "flex h-10 items-center justify-center rounded-md text-xs font-semibold shadow-sm",
                    getRoomGridColor(room.status, room.housekeepingStatus),
                  )}
                >
                  {room.number}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
