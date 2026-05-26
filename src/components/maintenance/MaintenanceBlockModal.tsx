"use client";

import type { RoomGridItem } from "@/components/dashboard/RoomStatusGrid";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type MaintenanceBlockModalProps = {
  open: boolean;
  onClose: () => void;
  room: RoomGridItem | null;
  rooms?: RoomGridItem[];
};

function defaultCheckOut(from: string) {
  const d = new Date(`${from}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function MaintenanceBlockModal({ open, onClose, room, rooms = [] }: MaintenanceBlockModalProps) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [roomId, setRoomId] = useState(room?.id ?? rooms[0]?.id ?? "");
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(defaultCheckOut(today));
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRoomId(room?.id ?? rooms[0]?.id ?? "");
    setCheckIn(today);
    setCheckOut(defaultCheckOut(today));
    setReason("");
    setError(null);
  }, [open, room, rooms, today]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!roomId) {
      setError("Select a room");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/maintenance-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, checkIn, checkOut, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to block room");
      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to block room");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedRoom = room ?? rooms.find((r) => r.id === roomId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-slate-800">
          {selectedRoom ? `Block Room ${selectedRoom.number}` : "Block room for maintenance"}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Mark the room out of order for maintenance during these dates.
        </p>

        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-room-dirty">
            {error}
          </p>
        )}

        {!room && rooms.length > 0 && (
          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-slate-500">Room</span>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  Room {r.number}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">From</span>
            <input
              type="date"
              required
              value={checkIn}
              onChange={(e) => {
                setCheckIn(e.target.value);
                if (checkOut <= e.target.value) setCheckOut(defaultCheckOut(e.target.value));
              }}
              className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">To</span>
            <input
              type="date"
              required
              min={checkIn}
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
            />
          </label>
        </div>

        <label className="mt-3 block text-sm">
          <span className="mb-1 block text-slate-500">Reason</span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="AC repair, painting, etc."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-room-dirty px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Block room"}
          </button>
        </div>
      </form>
    </div>
  );
}
