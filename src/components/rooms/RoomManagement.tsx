"use client";

import { ROOM_STATUS_COLORS, ROOM_STATUS_LABELS, ROOM_TYPE_LABELS } from "@/lib/constants";
import { formatPHP } from "@/lib/format";
import type { RoomListItem } from "@/lib/rooms";
import { cn } from "@/lib/utils";
import type { RoomStatus, RoomType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type RoomManagementProps = {
  rooms: RoomListItem[];
  initialStatus?: string;
  initialType?: string;
  initialFloor?: string;
};

const STATUS_OPTIONS: RoomStatus[] = [
  "VACANT",
  "OCCUPIED",
  "RESERVED",
  "DIRTY",
  "OUT_OF_ORDER",
];

const TYPE_OPTIONS: RoomType[] = ["STANDARD", "DELUXE", "SUITE"];

export function RoomManagement({
  rooms,
  initialStatus = "",
  initialType = "",
  initialFloor = "",
}: RoomManagementProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [floorFilter, setFloorFilter] = useState(initialFloor);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<RoomListItem | null>(null);
  const [form, setForm] = useState({ status: "", type: "", baseRate: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const floors = useMemo(
    () => [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b),
    [rooms],
  );

  const filtered = useMemo(() => {
    return rooms.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (typeFilter && r.type !== typeFilter) return false;
      if (floorFilter && r.floor !== Number(floorFilter)) return false;
      if (search && !r.number.includes(search) && !r.description.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [rooms, statusFilter, typeFilter, floorFilter, search]);

  function applyFilters() {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter) params.set("type", typeFilter);
    if (floorFilter) params.set("floor", floorFilter);
    const q = params.toString();
    router.push(q ? `/rooms?${q}` : "/rooms");
  }

  function openEdit(room: RoomListItem) {
    setEditing(room);
    setForm({
      status: room.status,
      type: room.type,
      baseRate: String(room.baseRate),
    });
    setError(null);
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/rooms/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: form.status,
          type: form.type,
          baseRate: Number(form.baseRate),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Update failed");
      }

      setEditing(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-card p-4 shadow-sm sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm sm:w-auto"
          >
            <option value="">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {ROOM_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Type</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm sm:w-auto"
          >
            <option value="">All</option>
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {ROOM_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Floor</span>
          <select
            value={floorFilter}
            onChange={(e) => setFloorFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm sm:w-auto"
          >
            <option value="">All</option>
            {floors.map((f) => (
              <option key={f} value={f}>
                Floor {f}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Room #</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Room # or type"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm sm:w-28"
          />
        </label>

        <button
          type="button"
          onClick={applyFilters}
          className="rounded-lg bg-sidebar px-4 py-2 text-sm font-medium text-white hover:bg-sidebar-hover"
        >
          Apply
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Floor</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">PAX</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Rate</th>
              <th className="px-4 py-3">w/ Breakfast</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  No rooms match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((room) => (
                <tr key={room.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-semibold text-slate-800">{room.number}</td>
                  <td className="px-4 py-3 text-slate-600">{room.floor}</td>
                  <td className="px-4 py-3 text-slate-600">{room.description}</td>
                  <td className="px-4 py-3 text-slate-600">{room.maxPax}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                        ROOM_STATUS_COLORS[room.status],
                      )}
                    >
                      {ROOM_STATUS_LABELS[room.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatPHP(room.baseRate)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {room.breakfastRate != null ? formatPHP(room.breakfastRate) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openEdit(room)}
                      className="text-room-occupied hover:underline"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800">
              Edit Room {editing.number}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Floor {editing.floor} · {editing.description} · up to {editing.maxPax} guests
            </p>

            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="text-slate-500">Status</span>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {ROOM_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="text-slate-500">Type</span>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                >
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {ROOM_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="text-slate-500">Base rate (₱)</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={form.baseRate}
                  onChange={(e) => setForm((f) => ({ ...f, baseRate: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
            </div>

            {error && <p className="mt-3 text-sm text-room-dirty">{error}</p>}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="rounded-lg bg-room-vacant px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
