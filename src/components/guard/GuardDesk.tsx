"use client";

import { GuardWalkInForm } from "@/components/guard/GuardWalkInForm";
import { formatDate, formatPHP } from "@/lib/format";
import { startOfHotelDay } from "@/lib/dates";
import type { ActiveStay } from "@/lib/check-in-out";
import { cn, compareRoomNumbers } from "@/lib/utils";
import { LogIn, LogOut, Search } from "lucide-react";
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

type GuardTab = "walk-in" | "check-out";

function isLeavingToday(checkOut: string): boolean {
  return startOfHotelDay(new Date(checkOut)).getTime() <= startOfHotelDay().getTime();
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
  onRecordPayment,
  onCheckOut,
  recordingPayment,
  checkingOut,
}: {
  stay: ActiveStay;
  onRecordPayment: (stay: ActiveStay, paymentMethod: string) => void;
  onCheckOut: (stay: ActiveStay) => void;
  recordingPayment: boolean;
  checkingOut: boolean;
}) {
  const readyForCheckout = stay.balanceDue <= 0.001;
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
            readyForCheckout ? "bg-green-50 text-room-vacant" : "bg-red-50 text-room-dirty",
          )}
        >
          {readyForCheckout ? "Fully paid" : "Balance due"}
          {!readyForCheckout && (
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

      {!readyForCheckout && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-slate-500">
            Confirm full payment before check-out is enabled.
          </p>
          <label className="block text-sm">
            <span className="text-slate-500">Payment method</span>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              disabled={recordingPayment || checkingOut}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={recordingPayment || checkingOut || !stay.folioId}
            onClick={() => onRecordPayment(stay, paymentMethod)}
            className="w-full rounded-lg bg-room-vacant py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {recordingPayment
              ? "Recording…"
              : `Confirm full payment (${formatPHP(stay.balanceDue)})`}
          </button>
        </div>
      )}

      {readyForCheckout && (
        <>
          <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-room-vacant">
            Fully paid — guest is ready to check out.
          </p>
          <button
            type="button"
            disabled={checkingOut || recordingPayment}
            onClick={() => onCheckOut(stay)}
            className="mt-auto w-full rounded-lg bg-room-occupied py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {checkingOut ? "Processing…" : "Check out guest"}
          </button>
        </>
      )}
    </article>
  );
}

export function GuardDesk({ activeStays }: GuardDeskProps) {
  const router = useRouter();
  const [tab, setTab] = useState<GuardTab>("walk-in");
  const [search, setSearch] = useState("");
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null);
  const [recordingPaymentId, setRecordingPaymentId] = useState<string | null>(null);
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

  async function handleRecordPayment(stay: ActiveStay, paymentMethod: string) {
    if (!stay.folioId || stay.balanceDue <= 0) return;

    if (
      !window.confirm(
        `Record ${formatPHP(stay.balanceDue)} (${paymentMethod.replace("_", " ")}) for ${stay.guestName} in Room ${stay.roomNumber}?`,
      )
    ) {
      return;
    }

    setRecordingPaymentId(stay.reservationId);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/folios/${stay.folioId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentAmount: stay.balanceDue,
          paymentMethod,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Payment failed");

      setSuccess(
        `Full payment recorded for ${stay.guestName}. Guest is ready to check out.`,
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setRecordingPaymentId(null);
    }
  }

  async function handleCheckOut(stay: ActiveStay) {
    if (stay.balanceDue > 0.001) {
      setError("Confirm full payment before checking out.");
      return;
    }

    if (
      !window.confirm(`Check out ${stay.guestName} from Room ${stay.roomNumber}?`)
    ) {
      return;
    }

    setCheckingOutId(stay.reservationId);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/check-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId: stay.reservationId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Check-out failed");

      setSuccess(`Room ${data.roomNumber} checked out. Housekeeping notified.`);
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
          Accept walk-in arrivals or check out in-house guests. Confirm full payment before
          releasing a room.
        </p>
      </div>

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

      <div className="flex gap-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setTab("walk-in")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition",
            tab === "walk-in"
              ? "bg-room-vacant text-white"
              : "text-slate-600 hover:bg-slate-50",
          )}
        >
          <LogIn className="h-4 w-4" />
          Walk-in check-in
        </button>
        <button
          type="button"
          onClick={() => setTab("check-out")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition",
            tab === "check-out"
              ? "bg-room-occupied text-white"
              : "text-slate-600 hover:bg-slate-50",
          )}
        >
          <LogOut className="h-4 w-4" />
          Check-out ({activeStays.length})
        </button>
      </div>

      {tab === "walk-in" ? (
        <GuardWalkInForm />
      ) : (
        <div className="space-y-5">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search guest, room, or folio…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm focus:border-room-occupied focus:outline-none focus:ring-1 focus:ring-room-occupied"
            />
          </label>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <p className="text-slate-600">No matching in-house guests.</p>
            </div>
          ) : (
            <>
              {leavingToday.length > 0 && (
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-amber-900">
                    Leaving today ({leavingToday.length})
                  </h3>
                  <div className={STAY_GRID_CLASS}>
                    {leavingToday.map((stay) => (
                      <StayCard
                        key={stay.reservationId}
                        stay={stay}
                        onRecordPayment={handleRecordPayment}
                        onCheckOut={handleCheckOut}
                        recordingPayment={recordingPaymentId === stay.reservationId}
                        checkingOut={checkingOutId === stay.reservationId}
                      />
                    ))}
                  </div>
                </section>
              )}

              {otherStays.length > 0 && (
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">
                    Other in-house guests ({otherStays.length})
                  </h3>
                  <div className={STAY_GRID_CLASS}>
                    {otherStays.map((stay) => (
                      <StayCard
                        key={stay.reservationId}
                        stay={stay}
                        onRecordPayment={handleRecordPayment}
                        onCheckOut={handleCheckOut}
                        recordingPayment={recordingPaymentId === stay.reservationId}
                        checkingOut={checkingOutId === stay.reservationId}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
