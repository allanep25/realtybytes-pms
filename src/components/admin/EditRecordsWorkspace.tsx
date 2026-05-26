"use client";

import {
  BOOKING_PLATFORM_OPTIONS,
  BOOKING_SOURCE_OPTIONS,
} from "@/lib/booking-source";
import { RESERVATION_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { EditableReservationListItem, EditableReservationRecord } from "@/lib/admin-edit";
import type { BookingPlatform, BookingSource } from "@prisma/client";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ID_TYPES = ["Passport", "Driver License", "National ID", "Other"];

type EditRecordsWorkspaceProps = {
  initialTodayRecords?: EditableReservationListItem[];
};

export function EditRecordsWorkspace({ initialTodayRecords = [] }: EditRecordsWorkspaceProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EditableReservationListItem[]>(initialTodayRecords);
  const [showingToday, setShowingToday] = useState(true);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [record, setRecord] = useState<EditableReservationRecord | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [saving, setSaving] = useState(false);
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

  const fieldClass =
    "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-room-occupied focus:outline-none focus:ring-1 focus:ring-room-occupied";

  async function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    setSearching(true);
    setError(null);
    setMessage(null);

    try {
      const params = new URLSearchParams({ q: query.trim() });
      const res = await fetch(`/api/admin/edit-records?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setResults(data.results ?? []);
      setShowingToday(false);
      if ((data.results ?? []).length === 0) {
        setMessage("No matching reservations found. Try a single word from the guest name or a room number.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function showTodayRecords() {
    setQuery("");
    setSearching(true);
    setError(null);
    setMessage(null);
    setRecord(null);
    setSelectedId(null);

    try {
      const res = await fetch("/api/admin/edit-records?scope=today");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load today's records");
      setResults(data.results ?? []);
      setShowingToday(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load today's records");
    } finally {
      setSearching(false);
    }
  }

  function applyRecord(data: EditableReservationRecord) {
    setRecord(data);
    setSelectedId(data.reservationId);
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
  }

  async function loadRecord(id: string) {
    setLoadingRecord(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/edit-records/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load record");
      applyRecord(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load record");
    } finally {
      setLoadingRecord(false);
    }
  }

  async function saveChanges() {
    if (!selectedId) return;

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
      const res = await fetch(`/api/admin/edit-records/${selectedId}`, {
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      applyRecord(data);
      setMessage("Changes saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-card p-5 shadow-sm">
        <h3 className="font-semibold text-slate-800">Find a reservation to edit</h3>
        <p className="mt-1 text-sm text-slate-500">
          Search by guest name, room number, folio number, contact, ID number, or OTA reference.
        </p>

        <form onSubmit={runSearch} className="mt-4 flex flex-wrap gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Uybaan, Jessie, Room 21, F-ABC123…"
            className="min-w-[240px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={searching}
            onClick={() => void showTodayRecords()}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Today&apos;s bookings
          </button>
          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="rounded-lg bg-room-occupied px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {searching ? "Searching…" : "Search"}
          </button>
        </form>

        {showingToday && results.length > 0 && (
          <p className="mt-3 text-sm text-slate-500">
            Showing {results.length} active booking(s) for today — arrivals, in-house guests, and
            departures.
          </p>
        )}

        {message && !record && (
          <p className="mt-3 text-sm text-slate-500">{message}</p>
        )}
        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-room-dirty">
            {error}
          </p>
        )}

        {results.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {results.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => void loadRecord(item.id)}
                  className={cn(
                    "flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50",
                    selectedId === item.id && "bg-amber-50",
                  )}
                >
                  <div>
                    <p className="font-medium text-slate-800">{item.guestName}</p>
                    <p className="text-sm text-slate-500">
                      Room {item.roomNumber} · {formatDate(item.checkIn)} –{" "}
                      {formatDate(item.checkOut)}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                      {RESERVATION_STATUS_LABELS[item.status] ?? item.status}
                    </span>
                    {item.folioNumber && (
                      <p className="mt-1 text-slate-500">{item.folioNumber}</p>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {loadingRecord && (
        <p className="text-sm text-slate-500">Loading record…</p>
      )}

      {record && !loadingRecord && (
        <section className="rounded-xl border border-slate-200 bg-card p-5 shadow-sm">
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
                  onChange={(e) =>
                    setGuestForm((f) => ({ ...f, contactNumber: e.target.value }))
                  }
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
                  onChange={(e) =>
                    setReservationForm((f) => ({ ...f, roomId: e.target.value }))
                  }
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
                    onChange={(e) =>
                      setReservationForm((f) => ({ ...f, adults: e.target.value }))
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-500">Children</span>
                  <input
                    type="number"
                    min={0}
                    value={reservationForm.children}
                    onChange={(e) =>
                      setReservationForm((f) => ({ ...f, children: e.target.value }))
                    }
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

          {message && (
            <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-room-vacant">
              {message}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => {
                setRecord(null);
                setSelectedId(null);
                setMessage(null);
                setError(null);
              }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
            >
              Close
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveChanges()}
              className="rounded-lg bg-room-vacant px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
