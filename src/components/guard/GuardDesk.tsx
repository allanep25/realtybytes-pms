"use client";

import { formatDate, formatPHP } from "@/lib/format";
import type { ActiveStay } from "@/lib/check-in-out";
import { cn, compareRoomNumbers } from "@/lib/utils";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "GCASH", label: "GCash" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
];

type GuardDeskProps = {
  activeStays: ActiveStay[];
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isLeavingToday(checkOut: string): boolean {
  return startOfDay(new Date(checkOut)).getTime() <= startOfDay(new Date()).getTime();
}

function matchesSearch(stay: ActiveStay, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    stay.guestName.toLowerCase().includes(q) ||
    stay.roomNumber.toLowerCase().includes(q) ||
    (stay.folioNumber?.toLowerCase().includes(q) ?? false)
  );
}

const STAY_GRID_CLASS = "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3";

function StayCard({
  stay,
  onCheckOut,
  checkingOut,
}: {
  stay: ActiveStay;
  onCheckOut: (stay: ActiveStay, paymentMethod: string) => void;
  checkingOut: boolean;
}) {
  const fullyPaid = stay.balanceDue <= 0;
  const [paymentMethod, setPaymentMethod] = useState("CASH");

  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-slate-900">Room {stay.roomNumber}</p>
          <p className="mt-0.5 font-medium text-slate-800">{stay.guestName}</p>
          <p className="mt-1 text-sm text-slate-500">
            Check-out {formatDate(stay.checkOut)}
            {isLeavingToday(stay.checkOut) && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                Leaving today
              </span>
            )}
          </p>
        </div>
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-right text-sm font-semibold",
            fullyPaid ? "bg-green-50 text-room-vacant" : "bg-red-50 text-room-dirty",
          )}
        >
          {fullyPaid ? "Fully paid" : "Balance due"}
          {!fullyPaid && (
            <p className="mt-0.5 text-base font-bold">{formatPHP(stay.balanceDue)}</p>
          )}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-sm">
        <div>
          <dt className="text-slate-400">Total</dt>
          <dd className="font-medium text-slate-700">{formatPHP(stay.total)}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Paid</dt>
          <dd className="font-medium text-slate-700">{formatPHP(stay.paid)}</dd>
        </div>
      </dl>

      {!fullyPaid && (
        <label className="mt-4 block text-sm">
          <span className="text-slate-500">Payment method</span>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            {PAYMENT_METHODS.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <button
        type="button"
        disabled={checkingOut}
        onClick={() => onCheckOut(stay, paymentMethod)}
        className={cn(
          "mt-auto w-full rounded-lg py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50",
          fullyPaid ? "bg-room-vacant" : "bg-room-occupied",
        )}
      >
        {checkingOut
          ? "Processing…"
          : fullyPaid
            ? "Check out guest"
            : `Collect ${formatPHP(stay.balanceDue)} & check out`}
      </button>
    </article>
  );
}

export function GuardDesk({ activeStays }: GuardDeskProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      activeStays
        .filter((stay) => matchesSearch(stay, search))
        .sort((a, b) => compareRoomNumbers(a.roomNumber, b.roomNumber)),
    [activeStays, search],
  );

  const leavingToday = useMemo(
    () => filtered.filter((stay) => isLeavingToday(stay.checkOut)),
    [filtered],
  );

  const otherStays = useMemo(
    () => filtered.filter((stay) => !isLeavingToday(stay.checkOut)),
    [filtered],
  );

  async function handleCheckOut(stay: ActiveStay, paymentMethod: string) {
    const confirmMessage =
      stay.balanceDue > 0
        ? `Collect ${formatPHP(stay.balanceDue)} (${paymentMethod.replace("_", " ")}) and check out ${stay.guestName} from Room ${stay.roomNumber}?`
        : `Check out ${stay.guestName} from Room ${stay.roomNumber}?`;

    if (!window.confirm(confirmMessage)) return;

    setCheckingOutId(stay.reservationId);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/check-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId: stay.reservationId,
          ...(stay.balanceDue > 0
            ? { paymentAmount: stay.balanceDue, paymentMethod }
            : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Check-out failed");

      setSuccess(
        stay.balanceDue > 0
          ? `Room ${data.roomNumber} checked out. ${formatPHP(stay.balanceDue)} collected. Housekeeping notified.`
          : `Room ${data.roomNumber} checked out. Housekeeping notified.`,
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check-out failed");
    } finally {
      setCheckingOutId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-slate-800">Front desk closed 9:00 PM – 6:00 AM</p>
        <p className="mt-1 text-sm text-slate-500">
          Check out guests who are fully paid, or collect their balance due before releasing the
          room.
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

      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search room number or guest name…"
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm shadow-sm focus:border-room-occupied focus:outline-none focus:ring-1 focus:ring-room-occupied"
        />
      </label>

      {activeStays.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-600">No guests currently checked in.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-600">No guests match your search.</p>
        </div>
      ) : (
        <>
          {leavingToday.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Leaving today ({leavingToday.length})
              </h2>
              <div className={STAY_GRID_CLASS}>
                {leavingToday.map((stay) => (
                  <StayCard
                    key={stay.reservationId}
                    stay={stay}
                    onCheckOut={handleCheckOut}
                    checkingOut={checkingOutId === stay.reservationId}
                  />
                ))}
              </div>
            </section>
          )}

          {otherStays.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {leavingToday.length > 0
                  ? `Other in-house guests (${otherStays.length})`
                  : `All in-house guests (${otherStays.length})`}
              </h2>
              <div className={STAY_GRID_CLASS}>
                {otherStays.map((stay) => (
                  <StayCard
                    key={stay.reservationId}
                    stay={stay}
                    onCheckOut={handleCheckOut}
                    checkingOut={checkingOutId === stay.reservationId}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
