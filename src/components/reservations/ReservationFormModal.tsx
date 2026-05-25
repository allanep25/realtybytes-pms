"use client";

import type { RoomGridItem } from "@/components/dashboard/RoomStatusGrid";
import { StayBillingSummary } from "@/components/reservations/StayBillingSummary";
import { formatPHP } from "@/lib/format";
import type { AvailableRoom } from "@/lib/check-in-out";
import { calcHourlyExtensionRate, calcStayQuote } from "@/lib/stay-pricing";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const ID_TYPES = ["Passport", "Driver License", "National ID", "Other"];

type ReservationFormModalProps = {
  open: boolean;
  onClose: () => void;
  initialRoom?: RoomGridItem | null;
  bookable?: boolean;
};

function tomorrowInputValue() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function dayAfterTomorrowInputValue() {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 10);
}

const emptyForm = {
  fullName: "",
  contactNumber: "",
  idType: "Passport",
  idNumber: "",
  address: "",
  roomId: "",
  checkIn: "",
  checkOut: "",
  adults: "1",
  children: "0",
  arrivalTime: "14:00",
  extensionDays: "0",
  extensionHours: "0",
};

export function ReservationFormModal({
  open,
  onClose,
  initialRoom,
  bookable = true,
}: ReservationFormModalProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    ...emptyForm,
    checkIn: tomorrowInputValue(),
    checkOut: dayAfterTomorrowInputValue(),
  });
  const [rooms, setRooms] = useState<AvailableRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    if (!form.checkIn || !form.checkOut || !open) return;
    setLoadingRooms(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        checkIn: form.checkIn,
        checkOut: form.checkOut,
      });
      const res = await fetch(`/api/rooms/available?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load rooms");
      setRooms(data);
      const keepRoomId = initialRoom?.id;
      if (
        form.roomId &&
        form.roomId !== keepRoomId &&
        !data.some((r: AvailableRoom) => r.id === form.roomId)
      ) {
        setForm((f) => ({ ...f, roomId: "" }));
      }
    } catch (e) {
      setRooms([]);
      setError(e instanceof Error ? e.message : "Failed to load rooms");
    } finally {
      setLoadingRooms(false);
    }
  }, [form.checkIn, form.checkOut, form.roomId, open, initialRoom?.id]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm({
      ...emptyForm,
      checkIn: tomorrowInputValue(),
      checkOut: dayAfterTomorrowInputValue(),
      roomId: initialRoom?.id ?? "",
    });
  }, [open, initialRoom]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bookable) return;

    const roomId = initialRoom?.id ?? form.roomId;
    if (!roomId) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          contactNumber: form.contactNumber || undefined,
          idType: form.idType || undefined,
          idNumber: form.idNumber || undefined,
          address: form.address || undefined,
          roomId,
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          adults: Number(form.adults),
          children: Number(form.children),
          arrivalTime: form.arrivalTime,
          extensionDays: Number(form.extensionDays) || 0,
          extensionHours: Number(form.extensionHours) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Reservation failed");

      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reservation failed");
    } finally {
      setSubmitting(false);
    }
  }

  const fieldClass =
    "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-room-occupied focus:outline-none focus:ring-1 focus:ring-room-occupied";

  const roomLocked = Boolean(initialRoom);
  const effectiveRoomId = roomLocked ? initialRoom!.id : form.roomId;

  const roomOptions: AvailableRoom[] = useMemo(() => {
    const options = [...rooms];
    if (initialRoom && !options.some((r) => r.id === initialRoom.id)) {
      options.unshift({
        id: initialRoom.id,
        number: initialRoom.number,
        floor: initialRoom.floor,
        type: "STANDARD",
        description: initialRoom.description,
        maxPax: initialRoom.maxPax,
        status: initialRoom.status,
        baseRate: initialRoom.baseRate,
        breakfastRate: initialRoom.breakfastRate,
      });
    }
    return options;
  }, [rooms, initialRoom]);

  const selectedFromList = roomOptions.find((r) => r.id === effectiveRoomId);

  const quote = useMemo(() => {
    if (!open || !selectedFromList || !form.checkIn || !form.checkOut) return null;
    return calcStayQuote({
      nightlyRate: selectedFromList.baseRate,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      extensionDays: Number(form.extensionDays) || 0,
      extensionHours: Number(form.extensionHours) || 0,
    });
  }, [
    open,
    selectedFromList,
    form.checkIn,
    form.checkOut,
    form.extensionDays,
    form.extensionHours,
  ]);

  const hourlyRatePreview = selectedFromList
    ? calcHourlyExtensionRate(selectedFromList.baseRate)
    : null;

  if (!open) return null;

  const roomUnavailableForDates =
    roomLocked &&
    !loadingRooms &&
    rooms.length > 0 &&
    !rooms.some((r) => r.id === initialRoom!.id);

  const roomBlocked =
    initialRoom?.status === "OUT_OF_ORDER" ||
    initialRoom?.status === "OCCUPIED";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">New Reservation</h3>
            {initialRoom && (
              <p className="text-sm text-slate-500">
                Room {initialRoom.number} · {initialRoom.description}
              </p>
            )}
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5">
          {!bookable && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              Connect the database before creating reservations.
            </p>
          )}

          {roomUnavailableForDates && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              Room {initialRoom!.number} is not available for the selected dates. Change the
              dates or pick a different room from the calendar.
            </p>
          )}

          {roomBlocked && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              This room is currently {initialRoom?.status.toLowerCase().replace("_", " ")}.
              Pick different dates or choose another room.
            </p>
          )}

          {error && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-room-dirty">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-3">
              <h4 className="font-medium text-slate-800">Guest</h4>
              <label className="block text-sm">
                <span className="text-slate-500">Full Name *</span>
                <input
                  required
                  disabled={!bookable}
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  className={fieldClass}
                  placeholder="Reyes, John"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-500">Contact Number</span>
                <input
                  disabled={!bookable}
                  value={form.contactNumber}
                  onChange={(e) => setForm((f) => ({ ...f, contactNumber: e.target.value }))}
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-500">ID Type</span>
                <select
                  disabled={!bookable}
                  value={form.idType}
                  onChange={(e) => setForm((f) => ({ ...f, idType: e.target.value }))}
                  className={fieldClass}
                >
                  {ID_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-slate-800">Stay</h4>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="text-slate-500">Check-in *</span>
                  <input
                    type="date"
                    required
                    disabled={!bookable}
                    min={new Date().toISOString().slice(0, 10)}
                    value={form.checkIn}
                    onChange={(e) => setForm((f) => ({ ...f, checkIn: e.target.value }))}
                    className={fieldClass}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-500">Check-out *</span>
                  <input
                    type="date"
                    required
                    disabled={!bookable}
                    min={form.checkIn}
                    value={form.checkOut}
                    onChange={(e) => setForm((f) => ({ ...f, checkOut: e.target.value }))}
                    className={fieldClass}
                  />
                </label>
              </div>
              <label className="block text-sm">
                <span className="text-slate-500">Arrival Time</span>
                <input
                  type="time"
                  disabled={!bookable}
                  value={form.arrivalTime}
                  onChange={(e) => setForm((f) => ({ ...f, arrivalTime: e.target.value }))}
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-500">
                  Room *{" "}
                  {loadingRooms && !roomLocked && (
                    <span className="font-normal text-slate-400">(loading…)</span>
                  )}
                </span>
                {roomLocked && selectedFromList ? (
                  <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                    {selectedFromList.number} — {selectedFromList.description} (
                    {selectedFromList.maxPax} pax, {formatPHP(selectedFromList.baseRate)}/night)
                  </div>
                ) : (
                  <select
                    required
                    disabled={!bookable}
                    value={effectiveRoomId}
                    onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))}
                    className={fieldClass}
                  >
                    <option value="">
                      {roomOptions.length === 0
                        ? "No rooms available for these dates"
                        : "Select a room"}
                    </option>
                    {roomOptions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.number} — {r.description} ({r.maxPax} pax, {formatPHP(r.baseRate)}/night)
                      </option>
                    ))}
                  </select>
                )}
              </label>
              {selectedFromList && (
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <p>
                    {formatPHP(selectedFromList.baseRate)}/night
                    {selectedFromList.breakfastRate != null &&
                      ` · w/ breakfast ${formatPHP(selectedFromList.breakfastRate)}`}
                  </p>
                  <p>Max {selectedFromList.maxPax} guests · Floor {selectedFromList.floor}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="text-slate-500">Adults</span>
                  <input
                    type="number"
                    min={1}
                    disabled={!bookable}
                    value={form.adults}
                    onChange={(e) => setForm((f) => ({ ...f, adults: e.target.value }))}
                    className={fieldClass}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-500">Children</span>
                  <input
                    type="number"
                    min={0}
                    disabled={!bookable}
                    value={form.children}
                    onChange={(e) => setForm((f) => ({ ...f, children: e.target.value }))}
                    className={fieldClass}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-3">
              <h4 className="font-medium text-slate-800">Extensions (optional)</h4>
              <p className="text-xs text-slate-500">
                Add extra time beyond the booked stay. Day extensions use the nightly rate.
                Hour extensions use nightly rate ÷ 24 + 20%.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="text-slate-500">Extra days</span>
                  <input
                    type="number"
                    min={0}
                    disabled={!bookable}
                    value={form.extensionDays}
                    onChange={(e) => setForm((f) => ({ ...f, extensionDays: e.target.value }))}
                    className={fieldClass}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-500">Extra hours</span>
                  <input
                    type="number"
                    min={0}
                    disabled={!bookable}
                    value={form.extensionHours}
                    onChange={(e) => setForm((f) => ({ ...f, extensionHours: e.target.value }))}
                    className={fieldClass}
                  />
                </label>
              </div>
              {selectedFromList && hourlyRatePreview != null && (
                <p className="text-xs text-slate-500">
                  Hourly extension for Room {selectedFromList.number}:{" "}
                  {formatPHP(selectedFromList.baseRate)} ÷ 24 + 20% ={" "}
                  <span className="font-medium text-slate-700">
                    {formatPHP(hourlyRatePreview)}/hr
                  </span>
                </p>
              )}
            </div>

            <StayBillingSummary
              quote={quote}
              roomNumber={selectedFromList?.number}
            />
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !bookable || !effectiveRoomId || roomUnavailableForDates}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium text-white",
                "bg-room-reserved text-slate-900 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {submitting ? "Saving…" : "Save Reservation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
