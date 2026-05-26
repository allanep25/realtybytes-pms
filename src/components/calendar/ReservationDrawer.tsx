"use client";



import { formatBookingChannel, BOOKING_SOURCE_LABELS } from "@/lib/booking-source";
import { PAYMENT_METHOD_OPTIONS, RESERVATION_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatPHP, formatTime } from "@/lib/format";
import type { ReservationDetail } from "@/lib/reservations";
import { formatStaffAttribution } from "@/lib/staff-attribution";

import { cn } from "@/lib/utils";

import { X } from "lucide-react";

import { useRouter } from "next/navigation";

import { useEffect, useState } from "react";



type ReservationDrawerProps = {

  reservationId: string | null;

  onClose: () => void;

  isAdmin?: boolean;

  onEditRequest?: (reservationId: string) => void;

};



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



  useEffect(() => {

    if (!reservationId) {

      setDetail(null);

      setError(null);

      setSuccess(null);

      return;

    }



    setLoading(true);

    fetch(`/api/reservations/${reservationId}`)

      .then((r) => (r.ok ? r.json() : null))

      .then((data) => setDetail(data))

      .finally(() => setLoading(false));

  }, [reservationId]);



  async function handleCheckIn() {

    if (!reservationId) return;

    setCheckingIn(true);

    setError(null);

    setSuccess(null);



    try {

      const res = await fetch(`/api/reservations/${reservationId}/check-in`, {

        method: "POST",

      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Check-in failed");



      setSuccess(`Checked in to Room ${data.roomNumber}. Folio ${data.folioNumber}.`);

      router.refresh();

      fetch(`/api/reservations/${reservationId}`)

        .then((r) => (r.ok ? r.json() : null))

        .then((d) => setDetail(d));

    } catch (e) {

      setError(e instanceof Error ? e.message : "Check-in failed");

    } finally {

      setCheckingIn(false);

    }

  }



  async function handleCancelReservation() {
    if (!reservationId || !detail) return;
    if (!confirm(`Cancel reservation for ${detail.guestName}?`)) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Cancel failed");
      setSuccess(`Reservation cancelled. Room ${data.roomNumber} released.`);
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
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
                  {detail.bookingSource === "ONLINE" && (
                    <>
                      <div>
                        <dt className="text-slate-500">Platform</dt>
                        <dd className="mt-0.5 font-medium text-slate-800">
                          {formatBookingChannel(
                            detail.bookingSource,
                            detail.bookingPlatform,
                            null,
                          )}
                        </dd>
                      </div>
                      {detail.bookingReference && (
                        <div className="sm:col-span-2">
                          <dt className="text-slate-500">Reference #</dt>
                          <dd className="mt-0.5 font-mono text-sm font-medium text-slate-800">
                            {detail.bookingReference}
                          </dd>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {detail.bookingType === "GUEST" &&
                (detail.encodedBy || detail.checkedInBy || detail.checkedOutBy) && (
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    {detail.encodedBy &&
                    detail.checkedInBy &&
                    !detail.checkedOutBy &&
                    formatStaffAttribution(detail.encodedBy) ===
                      formatStaffAttribution(detail.checkedInBy) ? (
                      <div>
                        <dt className="text-slate-500">Recorded by</dt>
                        <dd className="mt-0.5 font-medium text-slate-800">
                          {formatStaffAttribution(detail.encodedBy)}
                        </dd>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {detail.encodedBy && (
                          <div>
                            <dt className="text-slate-500">Encoded by</dt>
                            <dd className="mt-0.5 font-medium text-slate-800">
                              {formatStaffAttribution(detail.encodedBy)}
                            </dd>
                          </div>
                        )}
                        {detail.checkedInBy && (
                          <div>
                            <dt className="text-slate-500">Checked in by</dt>
                            <dd className="mt-0.5 font-medium text-slate-800">
                              {formatStaffAttribution(detail.checkedInBy)}
                            </dd>
                          </div>
                        )}
                        {detail.checkedOutBy && (
                          <div>
                            <dt className="text-slate-500">Checked out by</dt>
                            <dd className="mt-0.5 font-medium text-slate-800">
                              {formatStaffAttribution(detail.checkedOutBy)}
                            </dd>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

              <div className="grid grid-cols-2 gap-4">

                <div>

                  <dt className="text-slate-500">Room</dt>

                  <dd className="mt-0.5 font-medium text-slate-800">{detail.roomNumber}</dd>

                </div>

                <div>

                  <dt className="text-slate-500">Description</dt>

                  <dd className="mt-0.5 font-medium text-slate-800">

                    {detail.roomDescription}

                  </dd>

                </div>

              </div>

              <div className="grid grid-cols-2 gap-4">

                <div>

                  <dt className="text-slate-500">Check-in</dt>

                  <dd className="mt-0.5 font-medium text-slate-800">

                    {formatDate(detail.checkIn)}

                  </dd>

                </div>

                <div>

                  <dt className="text-slate-500">Check-out</dt>

                  <dd className="mt-0.5 font-medium text-slate-800">

                    {formatDate(detail.checkOut)}

                  </dd>

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

              {detail.scheduledDeparture && (

                <div>

                  <dt className="text-slate-500">Departure time</dt>

                  <dd className="mt-0.5 font-medium text-slate-800">

                    {formatTime(detail.scheduledDeparture)}

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

                    {detail.children > 0

                      ? `, ${detail.children} child${detail.children !== 1 ? "ren" : ""}`

                      : ""}

                  </dd>

                </div>

              </div>

              {detail.extensionDays > 0 && (
                <div>
                  <dt className="text-slate-500">Day extensions</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">
                    {detail.extensionDays} extra day{detail.extensionDays !== 1 ? "s" : ""}
                  </dd>
                </div>
              )}
              {detail.extensionHours > 0 && (
                <div>
                  <dt className="text-slate-500">Hour extensions</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">
                    {detail.extensionHours} extra hour{detail.extensionHours !== 1 ? "s" : ""}
                  </dd>
                </div>
              )}

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
                    <dd className="font-medium text-slate-800">
                      {formatPHP(detail.estimatedTotal)}
                    </dd>
                  </div>
                  {detail.discount > 0 && (
                    <div className="flex justify-between gap-4 text-room-vacant">
                      <dt className="text-slate-500">Guest discount</dt>
                      <dd className="font-medium">− {formatPHP(detail.discount)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Total stay</dt>
                    <dd className="font-medium text-slate-800">
                      {formatPHP(detail.totalDue)}
                    </dd>
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
                {detail.folioNumber && (
                  <a
                    href={`/billing?folio=${detail.folioNumber}`}
                    className="mt-3 inline-block text-xs font-medium text-room-vacant hover:underline"
                  >
                    {detail.discount > 0 ? "Adjust discount in Billing →" : "Apply discount in Billing →"}
                  </a>
                )}
              </div>

              {detail.bookingType === "MAINTENANCE" && (

                <p

                  className={cn(

                    "rounded-lg border border-room-dirty/30 bg-red-50 px-3 py-2 text-room-dirty",

                  )}

                >

                  Maintenance block — room unavailable for guests.

                </p>

              )}

            </dl>

          )}

        </div>



        {detail?.status === "RESERVED" && detail.bookingType === "GUEST" && (

          <div className="border-t border-slate-100 p-5 space-y-2">

            <button

              type="button"

              onClick={handleCheckIn}

              disabled={checkingIn || actionLoading}

              className="w-full rounded-lg bg-room-vacant py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"

            >

              {checkingIn ? "Checking in…" : "Check In Guest"}

            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleNoShow}
                disabled={checkingIn || actionLoading}
                className="rounded-lg border border-amber-200 bg-amber-50 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              >
                No-show
              </button>
              <button
                type="button"
                onClick={handleCancelReservation}
                disabled={checkingIn || actionLoading}
                className="rounded-lg border border-red-200 bg-red-50 py-2 text-sm font-medium text-room-dirty hover:bg-red-100 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>

            <p className="text-center text-xs text-slate-400">

              Use when the guest arrives on check-in day

            </p>

          </div>

        )}

        {detail?.status === "RESERVED" && detail.bookingType === "MAINTENANCE" && (
          <div className="border-t border-slate-100 p-5">
            <button
              type="button"
              onClick={handleRemoveMaintenanceBlock}
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
              Edit record (Administrator)
            </button>
          </div>
        )}

      </aside>

    </div>

  );

}

