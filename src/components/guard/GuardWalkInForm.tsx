"use client";

import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants";
import { hotelCalendarDate, nextHotelCalendarDate } from "@/lib/dates";
import { formatPHP } from "@/lib/format";
import type { AvailableRoom } from "@/lib/check-in-out";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const ID_TYPES = ["Passport", "Driver License", "National ID", "Other"];

const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-room-occupied focus:outline-none focus:ring-1 focus:ring-room-occupied";

export function GuardWalkInForm() {
  const router = useRouter();
  const today = hotelCalendarDate();

  const [form, setForm] = useState({
    fullName: "",
    contactNumber: "",
    idType: "National ID",
    idNumber: "",
    roomId: "",
    checkOut: nextHotelCalendarDate(today),
    adults: "1",
    depositAmount: "",
    paymentMethod: "CASH",
  });
  const [rooms, setRooms] = useState<AvailableRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedRoom = rooms.find((room) => room.id === form.roomId);

  const loadRooms = useCallback(async () => {
    setLoadingRooms(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        checkIn: today,
        checkOut: form.checkOut,
        vacantOnly: "true",
      });
      const res = await fetch(`/api/rooms/available?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load rooms");
      setRooms(data);
      if (form.roomId && !data.some((room: AvailableRoom) => room.id === form.roomId)) {
        setForm((current) => ({ ...current, roomId: "" }));
      }
    } catch (e) {
      setRooms([]);
      setError(e instanceof Error ? e.message : "Failed to load rooms");
    } finally {
      setLoadingRooms(false);
    }
  }, [form.checkOut, form.roomId, today]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  function resetForm() {
    setForm({
      fullName: "",
      contactNumber: "",
      idType: "National ID",
      idNumber: "",
      roomId: "",
      checkOut: nextHotelCalendarDate(today),
      adults: "1",
      depositAmount: "",
      paymentMethod: "CASH",
    });
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.idType.trim()) {
      setError("ID type is required");
      return;
    }

    const depositAmount = Number(form.depositAmount) || 0;
    if (depositAmount > 0 && !form.paymentMethod.trim()) {
      setError("Select a payment method for this payment");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          contactNumber: form.contactNumber || undefined,
          idType: form.idType,
          idNumber: form.idNumber || undefined,
          roomId: form.roomId,
          checkIn: today,
          checkOut: form.checkOut,
          adults: Number(form.adults) || 1,
          children: 0,
          bookingSource: "WALK_IN",
          depositAmount,
          paymentMethod: depositAmount > 0 ? form.paymentMethod : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Check-in failed");

      setSuccess(
        `${form.fullName} checked in to Room ${data.roomNumber}. Folio ${data.folioNumber}.`,
      );
      resetForm();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm font-medium text-emerald-950">Walk-in arrival (after front desk hours)</p>
        <p className="mt-1 text-sm text-emerald-900/80">
          Register guests arriving when front desk is closed. Only vacant rooms for tonight can be
          assigned. Payment is not required — enter an amount below only if the guest opts to pay
          now; otherwise the balance is settled at check-out.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-room-dirty">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-room-vacant">
          {success}
        </p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Guest details</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="text-slate-500">Full name *</span>
            <input
              required
              value={form.fullName}
              onChange={(e) => setForm((current) => ({ ...current, fullName: e.target.value }))}
              className={fieldClass}
              placeholder="Guest full name"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">Contact number</span>
            <input
              value={form.contactNumber}
              onChange={(e) =>
                setForm((current) => ({ ...current, contactNumber: e.target.value }))
              }
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">Adults *</span>
            <input
              type="number"
              min={1}
              required
              value={form.adults}
              onChange={(e) => setForm((current) => ({ ...current, adults: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">ID type *</span>
            <select
              required
              value={form.idType}
              onChange={(e) => setForm((current) => ({ ...current, idType: e.target.value }))}
              className={fieldClass}
            >
              {ID_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">ID number</span>
            <input
              value={form.idNumber}
              onChange={(e) => setForm((current) => ({ ...current, idNumber: e.target.value }))}
              className={fieldClass}
            />
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Stay &amp; room</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-500">Check-in</span>
            <input type="date" value={today} readOnly className={cn(fieldClass, "bg-slate-50")} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">Check-out *</span>
            <input
              type="date"
              required
              min={today}
              value={form.checkOut}
              onChange={(e) => setForm((current) => ({ ...current, checkOut: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-slate-500">
              Vacant room * {loadingRooms && <span className="text-slate-400">(loading…)</span>}
            </span>
            <select
              required
              value={form.roomId}
              onChange={(e) => setForm((current) => ({ ...current, roomId: e.target.value }))}
              className={fieldClass}
            >
              <option value="">
                {rooms.length === 0
                  ? "No vacant rooms available for tonight"
                  : "Select a vacant room"}
              </option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  Room {room.number} — {room.description} · {formatPHP(room.baseRate)}/night
                </option>
              ))}
            </select>
          </label>
          {selectedRoom && (
            <p className="text-sm text-slate-600 sm:col-span-2">
              Nightly rate {formatPHP(selectedRoom.baseRate)} · up to {selectedRoom.maxPax} guests
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Payment (optional)</h2>
        <p className="mt-1 text-sm text-slate-500">
          Leave blank if the guest will pay at check-out. Enter an amount only if they pay now.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-500">Payment method</span>
            <select
              value={form.paymentMethod}
              onChange={(e) =>
                setForm((current) => ({ ...current, paymentMethod: e.target.value }))
              }
              className={fieldClass}
            >
              {PAYMENT_METHOD_OPTIONS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">Amount guest pays now</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.depositAmount}
              onChange={(e) =>
                setForm((current) => ({ ...current, depositAmount: e.target.value }))
              }
              className={fieldClass}
              placeholder="0 — pay at check-out"
            />
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || loadingRooms}
        className="w-full rounded-lg bg-room-vacant py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Checking in…" : "Check in walk-in guest"}
      </button>
    </form>
  );
}
