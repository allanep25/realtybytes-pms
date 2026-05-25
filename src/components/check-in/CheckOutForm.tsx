"use client";

import { formatDate, formatPHP } from "@/lib/format";
import type { ActiveStay } from "@/lib/check-in-out";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "GCASH", label: "GCash" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
];

type CheckOutFormProps = {
  activeStays: ActiveStay[];
};

export function CheckOutForm({ activeStays }: CheckOutFormProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(activeStays[0]?.reservationId ?? "");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [collectPayment, setCollectPayment] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const stay = activeStays.find((s) => s.reservationId === selectedId);

  async function handleCheckOut(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/check-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId: selectedId,
          ...(collectPayment && stay && stay.balanceDue > 0
            ? { paymentAmount: stay.balanceDue, paymentMethod }
            : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Check-out failed");

      setSuccess(`Room ${data.roomNumber} checked out. Housekeeping notified to clean the room.`);
      setSelectedId("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check-out failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (activeStays.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-card p-12 text-center">
        <p className="text-slate-600">No guests currently checked in.</p>
        <p className="mt-2 text-sm text-slate-400">
          Use the Check-In tab to register a new guest.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleCheckOut} className="space-y-6">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-room-dirty">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-room-vacant">
          {success}
          {stay?.folioId && (
            <>
              {" "}
              <Link href={`/receipts?folio=${stay.folioId}`} className="font-medium underline">
                Print receipt
              </Link>
            </>
          )}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-card p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-slate-800">Select Stay</h3>
          <label className="block text-sm">
            <span className="text-slate-500">Checked-in guest</span>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {activeStays.map((s) => (
                <option key={s.reservationId} value={s.reservationId}>
                  {s.guestName} — Room {s.roomNumber} (out {formatDate(s.checkOut)})
                </option>
              ))}
            </select>
          </label>

          <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto text-sm">
            {activeStays.map((s) => (
              <li key={s.reservationId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(s.reservationId)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-left transition",
                    selectedId === s.reservationId
                      ? "border-room-occupied bg-room-occupied/10"
                      : "border-slate-100 hover:bg-slate-50",
                  )}
                >
                  <span className="font-medium text-slate-800">{s.guestName}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Room {s.roomNumber} · until {formatDate(s.checkOut)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {stay && (
          <section className="rounded-xl border border-slate-200 bg-card p-5 shadow-sm">
            <h3 className="mb-4 font-semibold text-slate-800">Stay Summary</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Guest</dt>
                <dd className="font-medium text-slate-800">{stay.guestName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Room</dt>
                <dd className="font-medium text-slate-800">
                  {stay.roomNumber} ({stay.roomDescription})
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Check-in</dt>
                <dd>{formatDate(stay.checkIn)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Check-out</dt>
                <dd>{formatDate(stay.checkOut)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Guests</dt>
                <dd>
                  {stay.adults} adult{stay.adults !== 1 ? "s" : ""}
                  {stay.children > 0 ? `, ${stay.children} child` : ""}
                </dd>
              </div>
              {stay.folioNumber && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Folio</dt>
                  <dd className="font-mono text-xs">{stay.folioNumber}</dd>
                </div>
              )}
            </dl>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total</span>
                <span>{formatPHP(stay.total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Paid</span>
                <span>{formatPHP(stay.paid)}</span>
              </div>
              <div className="mt-1 flex justify-between font-semibold text-slate-800">
                <span>Balance due</span>
                <span className={stay.balanceDue > 0 ? "text-room-dirty" : "text-room-vacant"}>
                  {formatPHP(stay.balanceDue)}
                </span>
              </div>
            </div>

            {stay.balanceDue > 0 && (
              <div className="mt-4 space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={collectPayment}
                    onChange={(e) => setCollectPayment(e.target.checked)}
                  />
                  Collect payment on check-out
                </label>
                {collectPayment && (
                  <label className="block text-sm">
                    <span className="text-slate-500">Payment method</span>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || !selectedId}
          className={cn(
            "rounded-lg px-5 py-2.5 text-sm font-medium text-white",
            "bg-room-occupied hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {submitting ? "Processing…" : "Check-Out"}
        </button>
      </div>
    </form>
  );
}
