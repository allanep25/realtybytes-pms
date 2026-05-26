"use client";

import { formatBookingChannel, BOOKING_SOURCE_LABELS } from "@/lib/booking-source";
import {
  calculateCancellationSettlement,
  isHotelCheckInDay,
} from "@/lib/cancellation-policy";
import { PAYMENT_METHOD_OPTIONS, RESERVATION_STATUS_LABELS } from "@/lib/constants";
import { hotelCalendarDate } from "@/lib/dates";
import { formatDate, formatPHP, formatTime } from "@/lib/format";
import type { ReservationDetail } from "@/lib/reservations";
import { formatStaffAttribution } from "@/lib/staff-attribution";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type ReservationDrawerProps = {
  reservationId: string | null;
  onClose: () => void;
  isAdmin?: boolean;
  onEditRequest?: (reservationId: string) => void;
};

type ActionPanel = null | "rebook" | "cancel";

function toDateInput(iso: string): string {
  return hotelCalendarDate(new Date(iso));
}

export function ReservationDrawer({
  reservationId,
  onClose,
  isAdmin = false,
  onEditRequest,
}: ReservationDrawerProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<ReservationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionPanel, setActionPanel] = useState<ActionPanel>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [rebookCheckIn, setRebookCheckIn] = useState("");
  const [rebookCheckOut, setRebookCheckOut] = useState("");
  const [rebookReason, setRebookReason] = useState("");

  useEffect(() => {
    if (!reservationId) {
      setDetail(null);
      setError(null);
      setSuccess(null);
      setActionPanel(null);
      return;
    }

    setLoading(true);
    fetch(`/api/reservations/${reservationId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ReservationDetail | null) => {
        setDetail(data);
        if (data) {
          setRebookCheckIn(toDateInput(data.checkIn));
          setRebookCheckOut(toDateInput(data.checkOut));
        }
      })
      .finally(() => setLoading(false));
  }, [reservationId]);

  const isArrivalDay = detail ? isHotelCheckInDay(detail.checkIn) : false;
  const cancelPreview = useMemo(
    () =>
      detail
        ? calculateCancellationSettlement(detail.totalDue, detail.paid, detail.checkIn)
        : null,
    [detail],
  );

  async function reloadDetail() {
    if (!reservationId) return;
    const data = await fetch(`/api/reservations/${reservationId}`).then((r) =>
      r.ok ? r.json() : null,
    );
    setDetail(data);
  }

  async function handleCheckIn() {
    if (!reservationId) return;
    setCheckingIn(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/reservations/${reservationId}/check-in`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Check-in failed");

      setSuccess(`Checked in to Room ${data.roomNumber}. Folio ${data.folioNumber}.`);
      router.refresh();
      await reloadDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setCheckingIn(false);
    }
  }

  async function handleCancelReservation() {
    if (!reservationId || !detail) return;
    if (!cancelReason.trim()) {
      setError("Please provide a reason for cancellation");
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Cancel failed");

      let message = `Reservation cancelled. Room ${data.roomNumber} released.`;
      if (data.refundAmount > 0) {
        message += ` Refund ${formatPHP(data.refundAmount)} to the guest.`;
      }
      if (data.forfeitAmount > 0) {
        message += ` ${formatPHP(data.forfeitAmount)} retained (late cancellation).`;
      }
      setSuccess(message);
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRebook() {
    if (!reservationId || !detail) return;
    if (!rebookReason.trim()) {
      setError("Please provide a reason for rebooking");
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/rebook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkIn: rebookCheckIn,
          checkOut: rebookCheckOut,
          reason: rebookReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Rebook failed");

      setSuccess(
        `Rebooked to ${formatDate(data.checkIn)} – ${formatDate(data.checkOut)}. Room ${data.roomNumber}.`,
      );
      setActionPanel(null);
      setRebookReason("");
      router.refresh();
      await reloadDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rebook failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleNoShow() {
    if (!reservationId || !detail) return;
    if (!confirm(`Mark ${detail.guestName} as no-show?`)) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/no-show`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No-show update failed");
      setSuccess(`Marked no-show. Room ${data.roomNumber} released.`);
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No-show update failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRemoveMaintenanceBlock() {
    if (!reservationId || !detail) return;
    if (!confirm("Remove this maintenance block?")) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/maintenance-blocks/${reservationId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to remove block");
      setSuccess(`Maintenance block removed for Room ${data.roomNumber}.`);
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove block");
    } finally {
      setActionLoading(false);
    }
  }

  if (!reservationId) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <button type="button" className="flex-1" aria-label="Close" onClick={onClose} />

      <aside className="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-800">Reservation</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Close panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && <p className="text-sm text-slate-500">Loading…</p>}
          {!loading && !detail && (
            <p className="text-sm text-room-dirty">Could not load reservation.</p>
          )}

          {error && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-room-dirty">
              {error}
            </p>
          )}
          {success && (
            <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-room-vacant">
              {success}
            </p>
          )}

          {detail && (
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-slate-500">Guest</dt>
                <dd className="mt-0.5 text-lg font-semibold text-slate-800">{detail.guestName}</dd>
              </div>

              {detail.bookingType === "GUEST" && (
                <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">Booked via</dt>
                    <dd className="mt-0.5 font-medium text-slate-800">
                      {BOOKING_SOURCE_LABELS[detail.bookingSource]}
                    </dd>
                  </div>
                  {detail.bookingSource === "ONLINE" && detail.bookingReference && (
                    <div className="sm:col-span-2">
                      <dt className="text-slate-500">Reference #</dt>
                      <dd className="mt-0.5 font-mono text-sm font-medium text-slate-800">
                        {detail.bookingReference}
                      </dd>
                    </div>
                  )}
                </div>
              )}

              {detail.encodedBy && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <dt className="text-slate-500">Encoded by</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">
                    {formatStaffAttribution(detail.encodedBy)}
                  </dd>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-slate-500">Room</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">{detail.roomNumber}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Description</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">{detail.roomDescription}</dd>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-slate-500">Check-in</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">{formatDate(detail.checkIn)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Check-out</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">{formatDate(detail.checkOut)}</dd>
                </div>
              </div>

              {detail.scheduledArrival && (
                <div>
                  <dt className="text-slate-500">Arrival time</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">
                    {formatTime(detail.scheduledArrival)}
                  </dd>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-slate-500">Status</dt>
                  <dd className="mt-0.5">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                      {RESERVATION_STATUS_LABELS[detail.status] ?? detail.status}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Guests</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">
                    {detail.adults} adult{detail.adults !== 1 ? "s" : ""}
                  </dd>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-sm font-semibold text-slate-800">Billing</h4>
                <dl className="mt-3 space-y-2">
                  {detail.folioNumber && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Folio</dt>
                      <dd className="font-mono text-sm font-medium text-slate-800">
                        {detail.folioNumber}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Room charges</dt>
                    <dd className="font-medium text-slate-800">{formatPHP(detail.estimatedTotal)}</dd>
                  </div>
                  {detail.discount > 0 && (
                    <div className="flex justify-between gap-4 text-room-vacant">
                      <dt className="text-slate-500">Guest discount</dt>
                      <dd className="font-medium">− {formatPHP(detail.discount)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Total stay</dt>
                    <dd className="font-medium text-slate-800">{formatPHP(detail.totalDue)}</dd>
                  </div>
                  {detail.paid > 0 && (
                    <div className="flex justify-between gap-4 text-room-vacant">
                      <dt>
                        Paid
                        {detail.paymentMethod
                          ? ` (${PAYMENT_METHOD_OPTIONS.find((m) => m.value === detail.paymentMethod)?.label ?? detail.paymentMethod})`
                          : ""}
                      </dt>
                      <dd className="font-medium">− {formatPHP(detail.paid)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4 border-t border-slate-200 pt-2">
                    <dt className="font-semibold text-slate-800">Balance at check-out</dt>
                    <dd
                      className={cn(
                        "text-lg font-bold",
                        detail.balanceDue > 0 ? "text-room-occupied" : "text-room-vacant",
                      )}
                    >
                      {formatPHP(detail.balanceDue)}
                    </dd>
                  </div>
                </dl>
              </div>
            </dl>
          )}
        </div>

        {detail?.status === "RESERVED" && detail.bookingType === "GUEST" && !isArrivalDay && (
          <div className="border-t border-slate-100 p-5 space-y-3">
            <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
              Arrival is {formatDate(detail.checkIn)}. Check-in and no-show are available on that
              day only.
            </p>

            {actionPanel === "rebook" ? (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-800">Rebook other dates</p>
                <label className="block text-sm">
                  <span className="text-slate-500">New check-in</span>
                  <input
                    type="date"
                    value={rebookCheckIn}
                    onChange={(e) => setRebookCheckIn(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-500">New check-out</span>
                  <input
                    type="date"
                    value={rebookCheckOut}
                    min={rebookCheckIn}
                    onChange={(e) => setRebookCheckOut(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-500">Reason *</span>
                  <textarea
                    value={rebookReason}
                    onChange={(e) => setRebookReason(e.target.value)}
                    rows={3}
                    placeholder="Why are the dates changing?"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleRebook()}
                    disabled={actionLoading}
                    className="flex-1 rounded-lg bg-room-reserved py-2 text-sm font-medium text-slate-900 hover:opacity-90 disabled:opacity-50"
                  >
                    {actionLoading ? "Saving…" : "Save new dates"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionPanel(null)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600"
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : actionPanel === "cancel" ? (
              <div className="space-y-3 rounded-lg border border-red-100 bg-red-50/50 p-3">
                <p className="text-sm font-semibold text-slate-800">Cancel reservation</p>
                {cancelPreview && (
                  <p className="text-xs text-slate-600">
                    {cancelPreview.policy === "free" ? (
                      <>
                        Cancelled 24+ hours before arrival — <strong>no charge</strong>
                        {cancelPreview.paid > 0
                          ? ` · full deposit refund ${formatPHP(cancelPreview.refundAmount)}`
                          : ""}
                        .
                      </>
                    ) : (
                      <>
                        Within 24 hours of arrival — retain{" "}
                        <strong>{formatPHP(cancelPreview.forfeitAmount)}</strong> (20% of room
                        amount) from deposit
                        {cancelPreview.refundAmount > 0
                          ? ` · refund ${formatPHP(cancelPreview.refundAmount)}`
                          : ""}
                        .
                      </>
                    )}
                  </p>
                )}
                <label className="block text-sm">
                  <span className="text-slate-500">Reason *</span>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={3}
                    placeholder="Why is this booking being cancelled?"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCancelReservation()}
                    disabled={actionLoading}
                    className="flex-1 rounded-lg border border-red-200 bg-red-50 py-2 text-sm font-medium text-room-dirty hover:bg-red-100 disabled:opacity-50"
                  >
                    {actionLoading ? "Cancelling…" : "Confirm cancel"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionPanel(null)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600"
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setActionPanel("rebook");
                  }}
                  disabled={actionLoading}
                  className="rounded-lg bg-room-reserved py-2.5 text-sm font-medium text-slate-900 hover:opacity-90 disabled:opacity-50"
                >
                  Rebook other date
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setCancelReason("");
                    setActionPanel("cancel");
                  }}
                  disabled={actionLoading}
                  className="rounded-lg border border-red-200 bg-red-50 py-2.5 text-sm font-medium text-room-dirty hover:bg-red-100 disabled:opacity-50"
                >
                  Cancel reservation
                </button>
              </div>
            )}
          </div>
        )}

        {detail?.status === "RESERVED" && detail.bookingType === "GUEST" && isArrivalDay && (
          <div className="border-t border-slate-100 p-5 space-y-2">
            <button
              type="button"
              onClick={() => void handleCheckIn()}
              disabled={checkingIn || actionLoading}
              className="w-full rounded-lg bg-room-vacant py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {checkingIn ? "Checking in…" : "Check In Guest"}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleNoShow()}
                disabled={checkingIn || actionLoading}
                className="rounded-lg border border-amber-200 bg-amber-50 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              >
                No-show
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setCancelReason("");
                  setActionPanel("cancel");
                }}
                disabled={checkingIn || actionLoading}
                className="rounded-lg border border-red-200 bg-red-50 py-2 text-sm font-medium text-room-dirty hover:bg-red-100 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
            {actionPanel === "cancel" && cancelPreview && (
              <div className="space-y-3 rounded-lg border border-red-100 bg-red-50/50 p-3">
                <p className="text-xs text-slate-600">
                  {cancelPreview.policy === "free" ? (
                    <>No cancellation fee · refund {formatPHP(cancelPreview.refundAmount)}</>
                  ) : (
                    <>
                      Late cancel — retain {formatPHP(cancelPreview.forfeitAmount)}, refund{" "}
                      {formatPHP(cancelPreview.refundAmount)}
                    </>
                  )}
                </p>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={2}
                  placeholder="Reason for cancellation *"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void handleCancelReservation()}
                  disabled={actionLoading}
                  className="w-full rounded-lg border border-red-200 bg-white py-2 text-sm font-medium text-room-dirty"
                >
                  Confirm cancel
                </button>
              </div>
            )}
            <p className="text-center text-xs text-slate-400">Guest arrival day</p>
          </div>
        )}

        {detail?.status === "RESERVED" && detail.bookingType === "MAINTENANCE" && (
          <div className="border-t border-slate-100 p-5">
            <button
              type="button"
              onClick={() => void handleRemoveMaintenanceBlock()}
              disabled={actionLoading}
              className="w-full rounded-lg border border-red-200 bg-red-50 py-2.5 text-sm font-medium text-room-dirty hover:bg-red-100 disabled:opacity-50"
            >
              {actionLoading ? "Removing…" : "Remove maintenance block"}
            </button>
          </div>
        )}

        {isAdmin && reservationId && detail?.bookingType === "GUEST" && onEditRequest && (
          <div className="border-t border-slate-100 p-5">
            <button
              type="button"
              onClick={() => {
                onEditRequest(reservationId);
                onClose();
              }}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-100"
            >
              Edit record &amp; discount (Administrator)
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
