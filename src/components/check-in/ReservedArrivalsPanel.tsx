"use client";

import { formatDate, formatPHP } from "@/lib/format";
import type { ReservedArrival } from "@/lib/check-in-out";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ReservedArrivalsPanelProps = {
  arrivals: ReservedArrival[];
};

export function ReservedArrivalsPanel({ arrivals }: ReservedArrivalsPanelProps) {
  const router = useRouter();
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (arrivals.length === 0) return null;

  async function checkIn(reservationId: string) {
    setCheckingInId(reservationId);
    setError(null);

    try {
      const res = await fetch(`/api/reservations/${reservationId}/check-in`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Check-in failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setCheckingInId(null);
    }
  }

  return (
    <section className="rounded-xl border border-room-reserved/40 bg-amber-50/50 p-5 shadow-sm">
      <h3 className="font-semibold text-slate-800">Expected Arrivals Today</h3>
      <p className="mt-1 text-sm text-slate-500">
        Guests with reservations checking in today — click to check in when they arrive.
      </p>

      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-room-dirty">
          {error}
        </p>
      )}

      <ul className="mt-4 divide-y divide-amber-100/80">
        {arrivals.map((a) => (
          <li key={a.reservationId} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="font-medium text-slate-800">{a.guestName}</p>
              <p className="text-sm text-slate-500">
                Room {a.roomNumber} · {a.roomDescription} · out {formatDate(a.checkOut)}
              </p>
              <p className="mt-1 text-sm">
                <span className="text-slate-500">Total {formatPHP(a.total)}</span>
                {a.paid > 0 && (
                  <span className="text-room-vacant"> · Paid {formatPHP(a.paid)}</span>
                )}
                <span
                  className={
                    a.balanceDue > 0 ? " font-medium text-room-occupied" : " text-room-vacant"
                  }
                >
                  {" "}
                  · Balance {formatPHP(a.balanceDue)}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => checkIn(a.reservationId)}
              disabled={checkingInId === a.reservationId}
              className="rounded-lg bg-room-vacant px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {checkingInId === a.reservationId ? "Checking in…" : "Check In"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
