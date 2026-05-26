"use client";

import { formatBookingChannel, BOOKING_SOURCE_LABELS } from "@/lib/booking-source";
import {
  calculateCancellationSettlement,
  isHotelCheckInDay,
} from "@/lib/cancellation-policy";
import { calcPresetDiscount, DISCOUNT_PRESETS } from "@/lib/billing";
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
  const [checkInDiscount, setCheckInDiscount] = useState("0");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [checkoutDiscount, setCheckoutDiscount] = useState("0");
  const [checkoutPaymentAmount, setCheckoutPaymentAmount] = useState("");
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState("CASH");
  const [checkingOut, setCheckingOut] = useState(false);

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

  useEffect(() => {
    if (!detail || !isHotelCheckInDay(detail.checkIn)) return;
    setCheckInDiscount(String(detail.discount || 0));
    setPaymentAmount(detail.balanceDue > 0 ? String(detail.balanceDue) : "");
    setPaymentMethod(detail.paymentMethod ?? "CASH");
  }, [detail]);

  useEffect(() => {
    if (!detail || detail.status !== "CHECKED_IN") return;
    setCheckoutDiscount(String(detail.discount || 0));
    setCheckoutPaymentAmount(detail.balanceDue > 0 ? String(detail.balanceDue) : "");
    setCheckoutPaymentMethod(detail.paymentMethod ?? "CASH");
  }, [detail]);

  const isArrivalDay = detail ? isHotelCheckInDay(detail.checkIn) : false;
  const discountLocked = detail != null && detail.discount > 0;
  const checkInPreview = useMemo(() => {
    if (!detail) return null;
    const subtotal = detail.estimatedTotal;
    const discount = discountLocked
      ? detail.discount
      : Math.min(subtotal, Math.max(0, Number.parseFloat(checkInDiscount) || 0));
    const total = Math.max(0, subtotal - discount);
    const collect = Math.max(0, Number.parseFloat(paymentAmount) || 0);
    const balanceAfter = Math.max(0, total - detail.paid - collect);
    return { subtotal, discount, total, collect, balanceAfter };
  }, [detail, checkInDiscount, paymentAmount, discountLocked]);
  const checkoutPreview = useMemo(() => {
    if (!detail) return null;
    const subtotal = detail.estimatedTotal;
    const discount = discountLocked
      ? detail.discount
      : Math.min(subtotal, Math.max(0, Number.parseFloat(checkoutDiscount) || 0));
    const total = Math.max(0, subtotal - discount);
    const collect = Math.max(0, Number.parseFloat(checkoutPaymentAmount) || 0);
    const balanceAfter = Math.max(0, total - detail.paid - collect);
    return { subtotal, discount, total, collect, balanceAfter };
  }, [detail, checkoutDiscount, checkoutPaymentAmount, discountLocked]);
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
    if (!reservationId || !detail || !checkInPreview) return;

    const collect = checkInPreview.collect;
    const maxCollect = Math.max(0, checkInPreview.total - detail.paid);

    if (collect > maxCollect + 0.001) {
      setError(`Payment cannot exceed balance due (${formatPHP(maxCollect)}).`);
      return;
    }

    setCheckingIn(true);
    setError(null);
    setSuccess(null);

    try {
      const body: Record<string, unknown> = {};
      if (!discountLocked) {
        body.discount = checkInPreview.discount;
      }
      if (collect > 0) {
        body.paymentAmount = collect;
        body.paymentMethod = paymentMethod;
      }

      const res = await fetch(`/api/reservations/${reservationId}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
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

  function applyDiscountPreset(preset: (typeof DISCOUNT_PRESETS)[number]) {
    if (!detail) return;
    const subtotal = detail.estimatedTotal;
    const discount = calcPresetDiscount(subtotal, preset);
    const total = Math.max(0, subtotal - discount);
    const balance = Math.max(0, total - detail.paid);
    setCheckInDiscount(String(discount));
    setPaymentAmount(balance > 0 ? String(balance) : "");
  }

  function applyCheckoutDiscountPreset(preset: (typeof DISCOUNT_PRESETS)[number]) {
    if (!detail) return;
    const subtotal = detail.estimatedTotal;
    const discount = calcPresetDiscount(subtotal, preset);
    const total = Math.max(0, subtotal - discount);
    const balance = Math.max(0, total - detail.paid);
    setCheckoutDiscount(String(discount));
    setCheckoutPaymentAmount(balance > 0 ? String(balance) : "");
  }

  async function handleCheckOut() {
    if (!reservationId || !detail || !checkoutPreview) return;

    const collect = checkoutPreview.collect;
    const maxCollect = Math.max(0, checkoutPreview.total - detail.paid);

    if (collect > maxCollect + 0.001) {
      setError(`Payment cannot exceed balance due (${formatPHP(maxCollect)}).`);
      return;
    }

    setCheckingOut(true);
    setError(null);
    setSuccess(null);

    try {
      const body: Record<string, unknown> = { reservationId };
      if (!discountLocked) {
        body.discount = checkoutPreview.discount;
      }
      if (collect > 0) {
        body.paymentAmount = collect;
        body.paymentMethod = checkoutPaymentMethod;
      }

      const res = await fetch("/api/check-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Check-out failed");

      setSuccess(
        `Room ${data.roomNumber} checked out. Housekeeping notified to clean the room.`,
      );
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check-out failed");
    } finally {
      setCheckingOut(false);
    }
  }

  async function handleRevertCheckIn() {
    if (!reservationId || !detail) return;
    if (
      !confirm(
        `Revert ${detail.guestName} to Reserved? This undoes check-in. Room ${detail.roomNumber} will show as arriving, not in-house.`,
      )
    ) {
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/edit-records/${reservationId}/revert-check-in`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Revert failed");

      setSuccess(`${data.guestName} reverted to Reserved. Room ${data.roomNumber}.`);
      router.refresh();
      await reloadDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revert failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteReservation() {
    if (!reservationId || !detail) return;
    if (
      !confirm(
        `Permanently delete ${detail.guestName}'s reservation (Room ${detail.roomNumber})? Folio and payments will be removed. This cannot be undone.`,
      )
    ) {
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/edit-records/${reservationId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");

      setSuccess(`Deleted reservation for ${data.guestName}. Room ${data.roomNumber} released.`);
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setActionLoading(false);
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
          <div className="border-t border-slate-100 p-5 space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-slate-800">Payment &amp; discount</h4>
              <p className="text-xs text-slate-500">
                {discountLocked
                  ? "Discount was applied at reservation. Record payment before checking the guest in."
                  : "Apply discounts and record payment before checking the guest in."}
              </p>

              <div>
                <p className="text-xs font-medium text-slate-600">Guest discount</p>
                {discountLocked ? (
                  <p className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    {formatPHP(detail.discount)} already applied — discount cannot be changed.
                  </p>
                ) : (
                  <>
                <div className="mt-2 flex flex-wrap gap-1">
                  {DISCOUNT_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyDiscountPreset(preset)}
                      disabled={checkingIn || actionLoading || detail.estimatedTotal <= 0}
                      className={cn(
                        "rounded border px-2 py-0.5 text-xs font-medium disabled:opacity-50",
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
                    onClick={() => {
                      setCheckInDiscount("0");
                      const balance = Math.max(0, detail.estimatedTotal - detail.paid);
                      setPaymentAmount(balance > 0 ? String(balance) : "");
                    }}
                    disabled={checkingIn || actionLoading}
                    className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-white disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
                <p className="mt-1 text-[10px] leading-snug text-slate-400">
                  Senior/PWD 20% — verify valid OSCA or PWD ID before applying.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={detail.estimatedTotal}
                    step={1}
                    value={checkInDiscount}
                    onChange={(e) => {
                      const subtotal = detail.estimatedTotal;
                      const discount = Math.min(
                        subtotal,
                        Math.max(0, Number.parseFloat(e.target.value) || 0),
                      );
                      setCheckInDiscount(e.target.value);
                      const total = Math.max(0, subtotal - discount);
                      const balance = Math.max(0, total - detail.paid);
                      setPaymentAmount(balance > 0 ? String(balance) : "");
                    }}
                    className="w-24 rounded border border-slate-200 px-2 py-1 text-right text-sm"
                    aria-label="Discount amount in pesos"
                  />
                  <span className="text-xs text-slate-500">peso discount</span>
                </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="text-slate-500">Payment method</span>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    disabled={checkingIn || actionLoading}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    {PAYMENT_METHOD_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="text-slate-500">Amount to collect</span>
                  <input
                    type="number"
                    min={0}
                    max={checkInPreview?.total ? checkInPreview.total - detail.paid : undefined}
                    step={0.01}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    disabled={checkingIn || actionLoading}
                    placeholder="0.00"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              {checkInPreview && (
                <dl className="space-y-1 border-t border-slate-200 pt-2 text-xs">
                  {checkInPreview.discount > 0 && (
                    <div className="flex justify-between text-room-vacant">
                      <dt>After discount</dt>
                      <dd>− {formatPHP(checkInPreview.discount)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Total after discount</dt>
                    <dd className="font-medium">{formatPHP(checkInPreview.total)}</dd>
                  </div>
                  {detail.paid > 0 && (
                    <div className="flex justify-between text-room-vacant">
                      <dt>Already paid</dt>
                      <dd>− {formatPHP(detail.paid)}</dd>
                    </div>
                  )}
                  {checkInPreview.collect > 0 && (
                    <div className="flex justify-between text-room-vacant">
                      <dt>Collecting now</dt>
                      <dd>− {formatPHP(checkInPreview.collect)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold">
                    <dt>Balance after check-in</dt>
                    <dd
                      className={cn(
                        checkInPreview.balanceAfter > 0 ? "text-room-occupied" : "text-room-vacant",
                      )}
                    >
                      {formatPHP(checkInPreview.balanceAfter)}
                    </dd>
                  </div>
                </dl>
              )}
            </div>

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

        {detail?.status === "CHECKED_IN" && detail.bookingType === "GUEST" && (
          <div className="border-t border-slate-100 p-5 space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-slate-800">Check-out payment</h4>
              <p className="text-xs text-slate-500">
                {discountLocked
                  ? "Discount was already applied. Collect the remaining balance before check-out."
                  : "Apply final discounts and collect balance before checking the guest out."}
              </p>

              <div>
                <p className="text-xs font-medium text-slate-600">Guest discount</p>
                {discountLocked ? (
                  <p className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    {formatPHP(detail.discount)} already applied — discount cannot be changed.
                  </p>
                ) : (
                  <>
                <div className="mt-2 flex flex-wrap gap-1">
                  {DISCOUNT_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyCheckoutDiscountPreset(preset)}
                      disabled={checkingOut || detail.estimatedTotal <= 0}
                      className={cn(
                        "rounded border px-2 py-0.5 text-xs font-medium disabled:opacity-50",
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
                    onClick={() => {
                      setCheckoutDiscount("0");
                      const balance = Math.max(0, detail.estimatedTotal - detail.paid);
                      setCheckoutPaymentAmount(balance > 0 ? String(balance) : "");
                    }}
                    disabled={checkingOut}
                    className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-white disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
                <p className="mt-1 text-[10px] leading-snug text-slate-400">
                  Senior/PWD 20% — verify valid OSCA or PWD ID before applying.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={detail.estimatedTotal}
                    step={1}
                    value={checkoutDiscount}
                    onChange={(e) => {
                      const subtotal = detail.estimatedTotal;
                      const discount = Math.min(
                        subtotal,
                        Math.max(0, Number.parseFloat(e.target.value) || 0),
                      );
                      setCheckoutDiscount(e.target.value);
                      const total = Math.max(0, subtotal - discount);
                      const balance = Math.max(0, total - detail.paid);
                      setCheckoutPaymentAmount(balance > 0 ? String(balance) : "");
                    }}
                    disabled={checkingOut}
                    className="w-24 rounded border border-slate-200 px-2 py-1 text-right text-sm"
                    aria-label="Discount amount in pesos"
                  />
                  <span className="text-xs text-slate-500">peso discount</span>
                </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="text-slate-500">Payment method</span>
                  <select
                    value={checkoutPaymentMethod}
                    onChange={(e) => setCheckoutPaymentMethod(e.target.value)}
                    disabled={checkingOut}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    {PAYMENT_METHOD_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="text-slate-500">Amount to collect</span>
                  <input
                    type="number"
                    min={0}
                    max={
                      checkoutPreview?.total
                        ? checkoutPreview.total - detail.paid
                        : undefined
                    }
                    step={0.01}
                    value={checkoutPaymentAmount}
                    onChange={(e) => setCheckoutPaymentAmount(e.target.value)}
                    disabled={checkingOut}
                    placeholder="0.00"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              {checkoutPreview && (
                <dl className="space-y-1 border-t border-slate-200 pt-2 text-xs">
                  {checkoutPreview.discount > 0 && (
                    <div className="flex justify-between text-room-vacant">
                      <dt>After discount</dt>
                      <dd>− {formatPHP(checkoutPreview.discount)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Total after discount</dt>
                    <dd className="font-medium">{formatPHP(checkoutPreview.total)}</dd>
                  </div>
                  {detail.paid > 0 && (
                    <div className="flex justify-between text-room-vacant">
                      <dt>Already paid</dt>
                      <dd>− {formatPHP(detail.paid)}</dd>
                    </div>
                  )}
                  {checkoutPreview.collect > 0 && (
                    <div className="flex justify-between text-room-vacant">
                      <dt>Collecting now</dt>
                      <dd>− {formatPHP(checkoutPreview.collect)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold">
                    <dt>Balance after check-out</dt>
                    <dd
                      className={cn(
                        checkoutPreview.balanceAfter > 0
                          ? "text-room-occupied"
                          : "text-room-vacant",
                      )}
                    >
                      {formatPHP(checkoutPreview.balanceAfter)}
                    </dd>
                  </div>
                </dl>
              )}
            </div>

            <button
              type="button"
              onClick={() => void handleCheckOut()}
              disabled={checkingOut}
              className="w-full rounded-lg bg-room-occupied py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {checkingOut ? "Checking out…" : "Check Out Guest"}
            </button>
            {checkoutPreview && checkoutPreview.balanceAfter > 0 && (
              <p className="text-center text-xs text-amber-800">
                Guest will check out with {formatPHP(checkoutPreview.balanceAfter)} still owing.
              </p>
            )}
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

        {isAdmin && reservationId && detail?.bookingType === "GUEST" && (
          <div className="border-t border-slate-100 p-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Administrator
            </p>
            {detail.status === "CHECKED_IN" && (
              <button
                type="button"
                onClick={() => void handleRevertCheckIn()}
                disabled={actionLoading || checkingOut}
                className="w-full rounded-lg border border-amber-200 bg-amber-50 py-2.5 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              >
                Revert to reserved (undo check-in)
              </button>
            )}
            {onEditRequest && (
              <button
                type="button"
                onClick={() => {
                  onEditRequest(reservationId);
                  onClose();
                }}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-100"
              >
                Edit record &amp; discount
              </button>
            )}
            {detail.status !== "CHECKED_OUT" && (
              <button
                type="button"
                onClick={() => void handleDeleteReservation()}
                disabled={actionLoading}
                className="w-full rounded-lg border border-red-200 bg-red-50 py-2.5 text-sm font-medium text-room-dirty hover:bg-red-100 disabled:opacity-50"
              >
                Delete reservation
              </button>
            )}
            <p className="text-center text-[10px] text-slate-400">
              Delete removes the encoded booking entirely. Use revert if check-in was done by mistake.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
