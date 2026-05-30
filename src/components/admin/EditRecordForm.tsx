"use client";

import {
  BOOKING_PLATFORM_OPTIONS,
  BOOKING_SOURCE_OPTIONS,
} from "@/lib/booking-source";
import { PAYMENT_METHOD_OPTIONS, RESERVATION_STATUS_LABELS } from "@/lib/constants";
import { DISCOUNT_PRESETS, calcPresetDiscount } from "@/lib/billing";
import { formatPHP } from "@/lib/format";
import type { EditableReservationRecord } from "@/lib/admin-edit";
import type { BookingPlatform, BookingSource, PaymentMethod } from "@prisma/client";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const ID_TYPES = ["Passport", "Driver License", "National ID", "Other"];

const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-room-occupied focus:outline-none focus:ring-1 focus:ring-room-occupied";

type EditRecordFormProps = {
  reservationId: string;
  onClose?: () => void;
  onSaved?: (record: EditableReservationRecord) => void;
};

export function EditRecordForm({ reservationId, onClose, onSaved }: EditRecordFormProps) {
  const router = useRouter();
  const [record, setRecord] = useState<EditableReservationRecord | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [guestForm, setGuestForm] = useState({
    fullName: "",
    contactNumber: "",
    idType: "",
    idNumber: "",
    address: "",
    isVip: false,
    notes: "",
  });

  const [reservationForm, setReservationForm] = useState({
    checkIn: "",
    checkOut: "",
    roomId: "",
    bookingSource: "PHONE" as BookingSource,
    bookingPlatform: "" as BookingPlatform | "",
    bookingReference: "",
    adults: "1",
    children: "0",
    extensionDays: "0",
    extensionHours: "0",
    arrivalTime: "14:00",
  });
  const [discount, setDiscount] = useState("0");
  const [paid, setPaid] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");

  function applyRecord(data: EditableReservationRecord) {
    setRecord(data);
    setGuestForm({
      fullName: data.guest.fullName,
      contactNumber: data.guest.contactNumber ?? "",
      idType: data.guest.idType ?? "",
      idNumber: data.guest.idNumber ?? "",
      address: data.guest.address ?? "",
      isVip: data.guest.isVip,
      notes: data.guest.notes ?? "",
    });
    setReservationForm({
      checkIn: data.reservation.checkIn,
      checkOut: data.reservation.checkOut,
      roomId: data.reservation.roomId,
      bookingSource: data.reservation.bookingSource,
      bookingPlatform: data.reservation.bookingPlatform ?? "",
      bookingReference: data.reservation.bookingReference ?? "",
      adults: String(data.reservation.adults),
      children: String(data.reservation.children),
      extensionDays: String(data.reservation.extensionDays),
      extensionHours: String(data.reservation.extensionHours),
      arrivalTime: data.reservation.arrivalTime ?? "14:00",
    });
    setDiscount(String(data.billing?.discount ?? 0));
    setPaid(String(data.billing?.paid ?? 0));
    setPaymentMethod(data.billing?.paymentMethod ?? "CASH");
  }

  useEffect(() => {
    let cancelled = false;

    async function loadRecord() {
      setLoadingRecord(true);
      setError(null);
      setMessage(null);
      setRecord(null);

      try {
        const res = await fetch(`/api/admin/edit-records/${reservationId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load record");
        if (!cancelled) applyRecord(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load record");
        }
      } finally {
        if (!cancelled) setLoadingRecord(false);
      }
    }

    void loadRecord();
    return () => {
      cancelled = true;
    };
  }, [reservationId]);

  async function saveChanges() {
    if (!record) return;

    if (!guestForm.fullName.trim()) {
      setError("Guest name is required");
      return;
    }
    if (
      reservationForm.bookingSource === "ONLINE" &&
      !reservationForm.bookingReference.trim()
    ) {
      setError("Booking reference is required for online bookings");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/edit-records/${reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest: {
            fullName: guestForm.fullName,
            contactNumber: guestForm.contactNumber || null,
            idType: guestForm.idType || null,
            idNumber: guestForm.idNumber || null,
            address: guestForm.address || null,
            isVip: guestForm.isVip,
            notes: guestForm.notes || null,
          },
          reservation: {
            checkIn: reservationForm.checkIn,
            checkOut: reservationForm.checkOut,
            roomId: reservationForm.roomId,
            bookingSource: reservationForm.bookingSource,
            bookingPlatform:
              reservationForm.bookingSource === "ONLINE" && reservationForm.bookingPlatform
                ? reservationForm.bookingPlatform
                : null,
            bookingReference:
              reservationForm.bookingSource === "ONLINE"
                ? reservationForm.bookingReference || null
                : null,
            adults: Number(reservationForm.adults),
            children: Number(reservationForm.children),
            extensionDays: Number(reservationForm.extensionDays) || 0,
            extensionHours: Number(reservationForm.extensionHours) || 0,
            arrivalTime: reservationForm.arrivalTime || null,
          },
          discount: record.billing ? Number(discount) || 0 : undefined,
          paid: record.billing ? Number(paid) || 0 : undefined,
          paymentMethod: record.billing ? paymentMethod : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      applyRecord(data);
      setMessage("Changes saved.");
      router.refresh();
      onSaved?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord() {
    if (!record) return;
    if (
      !confirm(
        `Permanently delete ${record.guest.fullName}'s reservation (Room ${record.reservation.roomNumber})? This cannot be undone.`,
      )
    ) {
      return;
    }

    setDeleting(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/edit-records/${reservationId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");

      setMessage(`Deleted reservation for ${data.guestName}. Room ${data.roomNumber} released.`);
      router.refresh();
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  if (loadingRecord) {
    return <p className="text-sm text-slate-500">Loading record…</p>;
  }

  if (!record) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-room-dirty">
        {error ?? "Could not load record."}
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Edit encoded record</h3>
          <p className="mt-1 text-sm text-slate-500">
            Status: {RESERVATION_STATUS_LABELS[record.reservation.status] ?? record.reservation.status}
            {record.reservation.folioNumber && ` · ${record.reservation.folioNumber}`}
            {record.reservation.encodedByName &&
              ` · Encoded by ${record.reservation.encodedByName}`}
          </p>
        </div>
      </div>

      <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
        Changing dates, room, or extensions will recalculate stay charges on the folio. Payments
        already recorded are kept up to the new total.
      </p>

      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-room-dirty">
          {error}
        </p>
      )}

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h4 className="font-medium text-slate-800">Guest</h4>
          <label className="block text-sm">
            <span className="text-slate-500">Full Name *</span>
            <input
              value={guestForm.fullName}
              onChange={(e) => setGuestForm((f) => ({ ...f, fullName: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">Contact Number</span>
            <input
              value={guestForm.contactNumber}
              onChange={(e) => setGuestForm((f) => ({ ...f, contactNumber: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">ID Type</span>
            <select
              value={guestForm.idType}
              onChange={(e) => setGuestForm((f) => ({ ...f, idType: e.target.value }))}
              className={fieldClass}
            >
              <option value="">Not recorded</option>
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
              value={guestForm.idNumber}
              onChange={(e) => setGuestForm((f) => ({ ...f, idNumber: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">Address</span>
            <textarea
              value={guestForm.address}
              onChange={(e) => setGuestForm((f) => ({ ...f, address: e.target.value }))}
              rows={2}
              className={fieldClass}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={guestForm.isVip}
              onChange={(e) => setGuestForm((f) => ({ ...f, isVip: e.target.checked }))}
            />
            VIP guest
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">Notes</span>
            <textarea
              value={guestForm.notes}
              onChange={(e) => setGuestForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className={fieldClass}
            />
          </label>
        </div>

        <div className="space-y-3">
          <h4 className="font-medium text-slate-800">Reservation</h4>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-slate-500">Check-in *</span>
              <input
                type="date"
                value={reservationForm.checkIn}
                onChange={(e) =>
                  setReservationForm((f) => ({ ...f, checkIn: e.target.value }))
                }
                className={fieldClass}
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">Check-out *</span>
              <input
                type="date"
                min={reservationForm.checkIn}
                value={reservationForm.checkOut}
                onChange={(e) =>
                  setReservationForm((f) => ({ ...f, checkOut: e.target.value }))
                }
                className={fieldClass}
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-slate-500">Room *</span>
            <select
              value={reservationForm.roomId}
              onChange={(e) => setReservationForm((f) => ({ ...f, roomId: e.target.value }))}
              className={fieldClass}
            >
              {record.rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.number} — {room.description}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">Arrival time</span>
            <input
              type="time"
              value={reservationForm.arrivalTime}
              onChange={(e) =>
                setReservationForm((f) => ({ ...f, arrivalTime: e.target.value }))
              }
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">Booking method</span>
            <select
              value={reservationForm.bookingSource}
              onChange={(e) =>
                setReservationForm((f) => ({
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
          {reservationForm.bookingSource === "ONLINE" && (
            <>
              <label className="block text-sm">
                <span className="text-slate-500">Online platform *</span>
                <select
                  required
                  value={reservationForm.bookingPlatform}
                  onChange={(e) =>
                    setReservationForm((f) => ({
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
                  value={reservationForm.bookingReference}
                  onChange={(e) =>
                    setReservationForm((f) => ({
                      ...f,
                      bookingReference: e.target.value,
                    }))
                  }
                  className={fieldClass}
                />
              </label>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-slate-500">Adults</span>
              <input
                type="number"
                min={1}
                value={reservationForm.adults}
                onChange={(e) => setReservationForm((f) => ({ ...f, adults: e.target.value }))}
                className={fieldClass}
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">Children</span>
              <input
                type="number"
                min={0}
                value={reservationForm.children}
                onChange={(e) => setReservationForm((f) => ({ ...f, children: e.target.value }))}
                className={fieldClass}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-slate-500">Extra days</span>
              <input
                type="number"
                min={0}
                value={reservationForm.extensionDays}
                onChange={(e) =>
                  setReservationForm((f) => ({ ...f, extensionDays: e.target.value }))
                }
                className={fieldClass}
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">Extra hours</span>
              <input
                type="number"
                min={0}
                value={reservationForm.extensionHours}
                onChange={(e) =>
                  setReservationForm((f) => ({ ...f, extensionHours: e.target.value }))
                }
                className={fieldClass}
              />
            </label>
          </div>
        </div>
      </div>

      {record.billing && (
        <section className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h4 className="font-medium text-slate-800">Billing, discount &amp; payment</h4>
          <p className="mt-1 text-xs text-slate-500">
            Folio {record.billing.folioNumber} · correct payment after room changes or encoding
            mistakes
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-slate-500">Room charges</dt>
              <dd className="font-medium text-slate-800">{formatPHP(record.billing.subtotal)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Total after discount</dt>
              <dd className="font-medium text-slate-800">
                {formatPHP(Math.max(0, record.billing.subtotal - (Number(discount) || 0)))}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Paid</dt>
              <dd className="font-medium text-slate-800">{formatPHP(Number(paid) || 0)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Balance</dt>
              <dd className="font-medium text-slate-800">
                {formatPHP(
                  Math.max(
                    0,
                    record.billing.subtotal - (Number(discount) || 0) - (Number(paid) || 0),
                  ),
                )}
              </dd>
            </div>
          </dl>

          <div className="mt-4">
            <span className="text-sm text-slate-500">Guest discount</span>
            <div className="mt-2 flex flex-wrap gap-1">
              {DISCOUNT_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    setDiscount(String(calcPresetDiscount(record.billing!.subtotal, preset)))
                  }
                  className={cn(
                    "rounded border px-2 py-0.5 text-xs font-medium",
                    preset.label.startsWith("Senior/PWD")
                      ? "border-room-vacant/40 bg-room-vacant/15 text-room-vacant hover:bg-room-vacant/25"
                      : "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100",
                  )}
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDiscount("0")}
                className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-white"
              >
                Clear
              </button>
            </div>
            <p className="mt-2 text-[10px] text-slate-400">
              Senior/PWD 20% — verify valid OSCA or PWD ID before applying.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={record.billing.subtotal}
                step={1}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                aria-label="Discount amount in pesos"
              />
              <span className="text-sm text-slate-500">pesos off</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-500">Correct total paid</span>
              <input
                type="number"
                min={0}
                max={Math.max(0, record.billing.subtotal - (Number(discount) || 0))}
                step={0.01}
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">Payment method</span>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                disabled={(Number(paid) || 0) <= 0}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {PAYMENT_METHOD_OPTIONS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            This replaces the folio&apos;s recorded payment total. Use it for wrong payment amount
            or method corrections.
          </p>
        </section>
      )}

      {message && (
        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-room-vacant">
          {message}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <button
          type="button"
          disabled={deleting || saving || record.reservation.status === "CHECKED_OUT"}
          onClick={() => void deleteRecord()}
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-room-dirty hover:bg-red-100 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete reservation"}
        </button>
        <div className="flex gap-3">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Close
          </button>
        )}
        <button
          type="button"
          disabled={saving || deleting}
          onClick={() => void saveChanges()}
          className="rounded-lg bg-room-vacant px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        </div>
      </div>
    </div>
  );
}
