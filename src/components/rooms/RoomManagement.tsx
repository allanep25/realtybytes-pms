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
  canManageRooms?: boolean;
};

type RoomDraft = {
  number: string;
  floor: string;
  description: string;
  maxPax: string;
  status: string;
  type: string;
  baseRate: string;
  breakfastRate: string;
  housekeepingChecklist: string;
};

const STATUS_OPTIONS: RoomStatus[] = [
  "VACANT",
  "OCCUPIED",
  "RESERVED",
  "DIRTY",
  "OUT_OF_ORDER",
];

const TYPE_OPTIONS: RoomType[] = ["STANDARD", "DELUXE", "SUITE"];

const INVENTORY_TEMPLATES: Record<RoomType, string[]> = {
  STANDARD: ["TV remote", "Aircon remote", "2 towels", "Blanket", "Trash bin"],
  DELUXE: [
    "TV remote",
    "Aircon remote",
    "4 towels",
    "Blanket",
    "Electric kettle",
    "4 cups",
    "4 pillows",
  ],
  SUITE: [
    "TV remote",
    "Aircon remote",
    "4 towels",
    "Blanket",
    "Electric kettle",
    "4 cups",
    "4 pillows",
    "Hair dryer",
  ],
};

const EMPTY_DRAFT: RoomDraft = {
  number: "",
  floor: "",
  description: "",
  maxPax: "2",
  status: "VACANT",
  type: "STANDARD",
  baseRate: "",
  breakfastRate: "",
  housekeepingChecklist: "",
};

function roomToDraft(room?: RoomListItem | null): RoomDraft {
  if (!room) return { ...EMPTY_DRAFT };
  return {
    number: room.number,
    floor: String(room.floor),
    description: room.description,
    maxPax: String(room.maxPax),
    status: room.status,
    type: room.type,
    baseRate: String(room.baseRate),
    breakfastRate: room.breakfastRate != null ? String(room.breakfastRate) : "",
    housekeepingChecklist: room.housekeepingChecklist.join("\n"),
  };
}

function parseNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function RoomManagement({
  rooms,
  initialStatus = "",
  initialType = "",
  initialFloor = "",
  canManageRooms = false,
}: RoomManagementProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [floorFilter, setFloorFilter] = useState(initialFloor);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<RoomListItem | null>(null);
  const [form, setForm] = useState<RoomDraft>({ ...EMPTY_DRAFT });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inventoryInput, setInventoryInput] = useState("");

  const floors = useMemo(
    () => [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b),
    [rooms],
  );

  const filtered = useMemo(() => {
    return rooms.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (typeFilter && r.type !== typeFilter) return false;
      if (floorFilter && r.floor !== Number(floorFilter)) return false;
      if (
        search &&
        !r.number.includes(search) &&
        !r.description.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
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

  function openCreate() {
    if (!canManageRooms) return;
    setMode("create");
    setSelectedRoom(null);
    setForm({ ...EMPTY_DRAFT });
    setError(null);
  }

  function openEdit(room: RoomListItem) {
    if (!canManageRooms) return;
    setMode("edit");
    setSelectedRoom(room);
    setForm(roomToDraft(room));
    setError(null);
  }

  function closeModal() {
    setMode(null);
    setSelectedRoom(null);
    setForm({ ...EMPTY_DRAFT });
    setError(null);
  }

  function getInventoryItems() {
    return form.housekeepingChecklist
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function setInventoryItems(items: string[]) {
    setForm((f) => ({
      ...f,
      housekeepingChecklist: items.join("\n"),
    }));
  }

  function addInventoryItem() {
    const item = inventoryInput.trim();

    if (!item) return;

    const items = getInventoryItems();
    const exists = items.some(
      (existing) => existing.toLowerCase() === item.toLowerCase(),
    );

    if (exists) {
      setError("This inventory item already exists.");
      return;
    }

    setInventoryItems([...items, item]);
    setInventoryInput("");
    setError(null);
  }

  function removeInventoryItem(index: number) {
    const items = getInventoryItems();
    setInventoryItems(items.filter((_, i) => i !== index));
  }

  function editInventoryItem(index: number) {
    const items = getInventoryItems();

    const updated = window.prompt("Edit inventory item", items[index]);

    if (!updated?.trim()) return;

    const cleanValue = updated.trim();
    const exists = items.some(
      (existing, i) =>
        i !== index && existing.toLowerCase() === cleanValue.toLowerCase(),
    );

    if (exists) {
      setError("This inventory item already exists.");
      return;
    }

    items[index] = cleanValue;
    setInventoryItems([...items]);
    setError(null);
  }

  function applyInventoryTemplate() {
    const template = INVENTORY_TEMPLATES[form.type as RoomType];

    if (!template) return;

    const confirmed = window.confirm(
      `Apply ${form.type.toLowerCase()} room inventory template? This will replace the current inventory list.`,
    );

    if (!confirmed) return;

    setInventoryItems(template);
    setError(null);
  }

  async function saveRoom() {
    if (!mode || !canManageRooms) return;

    const roomNumber = form.number.trim();
    const floor = parseNumber(form.floor);
    const maxPax = parseNumber(form.maxPax);
    const baseRate = parseNumber(form.baseRate);
    const breakfastRate = parseNumber(form.breakfastRate);
    const housekeepingChecklist = form.housekeepingChecklist
      .split("\n")
      .map((item) => item.trim())
      .filter((item, index, array) => item !== "" && array.findIndex((value) => value.toLowerCase() === item.toLowerCase()) === index);

    if (roomNumber === "") {
      setError("Room number is required");
      return;
    }
    if (floor == null || Number.isNaN(floor) || floor < 1 || !Number.isInteger(floor)) {
      setError("Floor must be a whole number");
      return;
    }
    if (maxPax == null || Number.isNaN(maxPax) || maxPax < 1 || !Number.isInteger(maxPax)) {
      setError("PAX must be a whole number");
      return;
    }
    if (baseRate == null || Number.isNaN(baseRate) || baseRate < 0) {
      setError("Base rate is required");
      return;
    }
    if (form.breakfastRate.trim() !== "" && (breakfastRate == null || Number.isNaN(breakfastRate) || breakfastRate < 0)) {
      setError("Breakfast rate must be a valid number");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(mode === "create" ? "/api/rooms" : `/api/rooms/${selectedRoom!.id}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: roomNumber,
          floor,
          description: form.description,
          maxPax,
          status: form.status,
          type: form.type,
          baseRate,
          breakfastRate: form.breakfastRate.trim() === "" ? null : breakfastRate,
          housekeepingChecklist,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Save failed");
      }

      closeModal();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRoom(room: RoomListItem) {
    if (!canManageRooms) return;
    if (
      !window.confirm(
        `Delete Room ${room.number}? This cannot be undone, and rooms with reservations cannot be deleted.`,
      )
    ) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/rooms/${room.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Delete failed");
      }

      if (selectedRoom?.id === room.id) closeModal();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-card p-4 shadow-sm">
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
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm sm:w-32"
          />
        </label>

        <button
          type="button"
          onClick={applyFilters}
          className="rounded-lg bg-sidebar px-4 py-2 text-sm font-medium text-white hover:bg-sidebar-hover"
        >
          Apply
        </button>

        {canManageRooms && (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg border border-room-occupied px-4 py-2 text-sm font-medium text-room-occupied hover:bg-room-occupied/5"
          >
            Add Room
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Room</th>
                <th className="px-4 py-3">Floor</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">PAX</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Rate</th>
                <th className="px-4 py-3">W/ Breakfast</th>
                {canManageRooms && <th className="px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={canManageRooms ? 8 : 7} className="px-4 py-8 text-center text-slate-400">
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
                    {canManageRooms && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => openEdit(room)}
                            className="text-room-occupied hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteRoom(room)}
                            disabled={deleting}
                            className="text-room-dirty hover:underline disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {mode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800">
              {mode === "create" ? "Add Room" : `Edit Room ${selectedRoom?.number ?? ""}`}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {mode === "create"
                ? "Create a new room record."
                : `Floor ${selectedRoom?.floor ?? ""} · ${selectedRoom?.description ?? ""} · up to ${selectedRoom?.maxPax ?? ""} guests`}
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-slate-500">Room #</span>
                <input
                  value={form.number}
                  onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                  disabled={mode === "edit"}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-50"
                />
              </label>

              <label className="block text-sm">
                <span className="text-slate-500">Floor</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={form.floor}
                  onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>

              <label className="block text-sm sm:col-span-2">
                <span className="text-slate-500">Description</span>
                <input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>

              <label className="block text-sm">
                <span className="text-slate-500">PAX</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={form.maxPax}
                  onChange={(e) => setForm((f) => ({ ...f, maxPax: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>

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
                <span className="text-slate-500">Base rate (PHP)</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={form.baseRate}
                  onChange={(e) => setForm((f) => ({ ...f, baseRate: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>

              <label className="block text-sm">
                <span className="text-slate-500">W/ Breakfast (PHP)</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={form.breakfastRate}
                  onChange={(e) => setForm((f) => ({ ...f, breakfastRate: e.target.value }))}
                  placeholder="Leave blank if not available"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>

              <div className="col-span-2">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm text-slate-500">Room Inventory</span>

                  <div className="flex gap-2">
                    <input
                      value={inventoryInput}
                      onChange={(e) => setInventoryInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addInventoryItem();
                        }
                      }}
                      placeholder="Add item"
                      className="w-48 rounded-lg border border-slate-200 px-3 py-1 text-sm"
                    />

                    <button
                      type="button"
                      onClick={addInventoryItem}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      + Add
                    </button>

                    <button
                      type="button"
                      onClick={applyInventoryTemplate}
                      className="rounded-lg border border-emerald-200 px-3 py-1 text-sm text-emerald-700 hover:bg-emerald-50"
                    >
                      Apply Template
                    </button>
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  {getInventoryItems().length === 0 ? (
                    <p className="text-sm text-slate-400">No inventory items yet.</p>
                  ) : (
                    getInventoryItems().map((item, index) => (
                      <div
                        key={`${item}-${index}`}
                        className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span>{item}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => editInventoryItem(index)}
                            className="text-xs text-blue-500 hover:text-blue-700"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => removeInventoryItem(index)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <span className="mt-1 block text-xs text-slate-400">
                  Add the items that should belong to this room. Housekeeping will use this list
                  during room checks.
                </span>
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-room-dirty">{error}</p>}

            <div className="sticky bottom-0 mt-6 flex flex-wrap justify-end gap-2 bg-white pt-4">
              {canManageRooms && mode === "edit" && selectedRoom && (
                <button
                  type="button"
                  onClick={() => void deleteRoom(selectedRoom)}
                  disabled={saving || deleting}
                  className="mr-auto rounded-lg border border-room-dirty px-4 py-2 text-sm font-medium text-room-dirty hover:bg-room-dirty/5 disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete Room"}
                </button>
              )}
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveRoom}
                disabled={saving || deleting}
                className="rounded-lg bg-room-vacant px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving..." : mode === "create" ? "Create" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
