"use client";

import {
  BOOKING_PLATFORM_OPTIONS,
  BOOKING_SOURCE_OPTIONS,
} from "@/lib/booking-source";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants";
import { formatPHP } from "@/lib/format";
import type { AvailableRoom } from "@/lib/check-in-out";
import { GuestIdCapture } from "@/components/guests/GuestIdCapture";
import { cn } from "@/lib/utils";
import type { BookingPlatform, BookingSource } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const ID_TYPES = ["Passport", "Driver License", "National ID", "Other"];

const emptyForm = {
  fullName: "",
  contactNumber: "",
  idType: "",
  idNumber: "",
  idPhotoFileName: "",
  address: "",
  roomId: "",
  checkIn: "",
  checkOut: "",
  adults: "1",
  children: "0",
  arrivalTime: "14:00",
  bookingSource: "WALK_IN" as BookingSource,
  bookingPlatform: "" as BookingPlatform | "",
  bookingReference: "",
  depositAmount: "",
  paymentMethod: "CASH",
};

function todayInputValue() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function defaultCheckOut() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function CheckInForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    ...emptyForm,
    checkIn: todayInputValue(),
    checkOut: defaultCheckOut(),
  });
  const [rooms, setRooms] = useState<AvailableRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedRoom = rooms.find((r) => r.id === form.roomId);

  const loadRooms = useCallback(async () => {
    if (!form.checkIn || !form.checkOut) return;
    setLoadingRooms(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        vacantOnly: "true",
      });
      const res = await fetch(`/api/rooms/available?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load rooms");
      setRooms(data);
      if (form.roomId && !data.some((r: AvailableRoom) => r.id === form.roomId)) {
        setForm((f) => ({ ...f, roomId: "" }));
      }
    } catch (e) {
      setRooms([]);
      setError(e instanceof Error ? e.message : "Failed to load rooms");
    } finally {
      setLoadingRooms(false);
    }
  }, [form.checkIn, form.checkOut]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  function clearForm() {
    setForm({
      ...emptyForm,
      checkIn: todayInputValue(),
      checkOut: defaultCheckOut(),
    });
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (form.bookingSource === "ONLINE" && !form.bookingReference.trim()) {
      setError("Booking reference number is required for online bookings");
      return;
    }
    if (!form.idType.trim()) {
      setError("ID type is required for the guest checking in");
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
          idType: form.idType || undefined,
          idNumber: form.idNumber || undefined,
          idPhotoFileName: form.idPhotoFileName || undefined,
          address: form.address || undefined,
          roomId: form.roomId,
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          adults: Number(form.adults),
          children: Number(form.children),
          arrivalTime: form.arrivalTime,
          bookingSource: form.bookingSource,
          bookingPlatform:
            form.bookingSource === "ONLINE" ? form.bookingPlatform || null : null,
          bookingReference:
            form.bookingSource === "ONLINE" ? form.bookingReference || null : null,
          depositAmount,
          paymentMethod: depositAmount > 0 ? form.paymentMethod : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Check-in failed");

      setSuccess(
        `${form.fullName} checked in to Room ${data.roomNumber}. Folio ${data.folioNumber}.`,
      );
      clearForm();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setSubmitting(false);
    }
  }

  const fieldClass =
    "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-room-occupied focus:outline-none focus:ring-1 focus:ring-room-occupied";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <p className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-2 text-sm text-slate-600">
        <span className="font-medium text-slate-800">Walk-in today?</span> Use this form to
        check in immediately. For future stays, click a room on the dashboard or use{" "}
        <span className="font-medium">Reservation Calendar → New Reservation</span>.
      </p>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-room-dirty">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-room-vacant">
          {success}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-card p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-slate-800">Guest Information</h3>
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="text-slate-500">Full Name *</span>
              <input
                required
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                className={fieldClass}
                placeholder="Reyes, John"
              />
            </label>
            <p className="text-xs font-medium text-slate-600">ID for guest above *</p>
            <label className="block text-sm">
              <span className="text-slate-500">ID Type *</span>
              <select
                required
                value={form.idType}
                onChange={(e) => setForm((f) => ({ ...f, idType: e.target.value }))}
                className={fieldClass}
              >
                <option value="">Select ID type...</option>
                {ID_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">ID Number</span>
              <input
                value={form.idNumber}
                onChange={(e) => setForm((f) => ({ ...f, idNumber: e.target.value }))}
                className={fieldClass}
              />
            </label>
            <GuestIdCapture
              guestName={form.fullName}
              savedFileName={form.idPhotoFileName || null}
              onSaved={(fileName) => setForm((f) => ({ ...f, idPhotoFileName: fileName }))}
              onClear={() => setForm((f) => ({ ...f, idPhotoFileName: "" }))}
              disabled={submitting}
            />
            <label className="block text-sm">
              <span className="text-slate-500">Contact Number</span>
              <input
                value={form.contactNumber}
                onChange={(e) => setForm((f) => ({ ...f, contactNumber: e.target.value }))}
                className={fieldClass}
                placeholder="+63 917 000 0000"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">Address</span>
              <textarea
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                rows={2}
                className={fieldClass}
              />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-card p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-slate-800">Booking Details</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-slate-500">Check-in *</span>
                <input
                  type="date"
                  required
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
                  value={form.checkOut}
                  min={form.checkIn}
                  onChange={(e) => setForm((f) => ({ ...f, checkOut: e.target.value }))}
                  className={fieldClass}
                />
              </label>
            </div>

            <label className="block text-sm">
              <span className="text-slate-500">Arrival Time</span>
              <input
                type="time"
                value={form.arrivalTime}
                onChange={(e) => setForm((f) => ({ ...f, arrivalTime: e.target.value }))}
                className={fieldClass}
              />
            </label>

            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                How was this booked?
              </p>
              <label className="block text-sm">
                <span className="text-slate-500">Booking source *</span>
                <select
                  required
                  value={form.bookingSource}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      bookingSource: e.target.value as BookingSource,
                      bookingPlatform: "",
                      bookingReference: "",
                    }))
                  }
                  className={fieldClass}
                >
                  {BOOKING_SOURCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              {form.bookingSource === "ONLINE" && (
                <div className="mt-3 space-y-3">
                  <label className="block text-sm">
                    <span className="text-slate-500">Online platform *</span>
                    <select
                      required
                      value={form.bookingPlatform}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          bookingPlatform: e.target.value as BookingPlatform,
                        }))
                      }
                      className={fieldClass}
                    >
                      <option value="">Select platform…</option>
                      {BOOKING_PLATFORM_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-500">Booking reference # *</span>
                    <input
                      required
                      value={form.bookingReference}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, bookingReference: e.target.value }))
                      }
                      className={fieldClass}
                      placeholder="Agoda / Booking.com confirmation number"
                    />
                  </label>
                </div>
              )}
            </div>

            <label className="block text-sm">
              <span className="text-slate-500">
                Room *{" "}
                {loadingRooms && (
                  <span className="font-normal text-slate-400">(loading…)</span>
                )}
              </span>
              <select
                required
                value={form.roomId}
                onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))}
                className={fieldClass}
              >
                <option value="">
                  {rooms.length === 0
                    ? "No vacant rooms available for these dates"
                    : "Select a vacant room"}
                </option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.number} — {r.description} ({r.maxPax} pax, {formatPHP(r.baseRate)}/night)
                  </option>
                ))}
              </select>
            </label>

            {selectedRoom && (
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <p>
                  <span className="font-medium">Room:</span> {selectedRoom.description}
                </p>
                <p>
                  <span className="font-medium">Max guests:</span> {selectedRoom.maxPax}
                </p>
                <p>
                  <span className="font-medium">Rate:</span>{" "}
                  {formatPHP(selectedRoom.baseRate)} / night
                </p>
                {selectedRoom.breakfastRate != null && (
                  <p>
                    <span className="font-medium">With breakfast:</span>{" "}
                    {formatPHP(selectedRoom.breakfastRate)} / night
                  </p>
                )}
                <p>
                  <span className="font-medium">Floor:</span> {selectedRoom.floor}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-slate-500">Adults</span>
                <input
                  type="number"
                  min={1}
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
                  value={form.children}
                  onChange={(e) => setForm((f) => ({ ...f, children: e.target.value }))}
                  className={fieldClass}
                />
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-800">Deposit (optional)</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-slate-500">Payment method</span>
                <select
                  value={form.paymentMethod}
                  onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                  className={fieldClass}
                >
                  {PAYMENT_METHOD_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-slate-500">Amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.depositAmount}
                  onChange={(e) => setForm((f) => ({ ...f, depositAmount: e.target.value }))}
                  className={fieldClass}
                  placeholder="0"
                />
              </label>
            </div>
          </div>
        </section>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={clearForm}
          className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Clear
        </button>
        <button
          type="submit"
          disabled={submitting || !form.roomId}
          className={cn(
            "rounded-lg px-5 py-2.5 text-sm font-medium text-white",
            "bg-room-vacant hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {submitting ? "Checking in…" : "Check-In"}
        </button>
      </div>
    </form>
  );
}
