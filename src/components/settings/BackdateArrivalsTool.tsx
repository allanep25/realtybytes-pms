"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BackdateArrivalsTool() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<
    Array<{ guestName: string; roomNumber: string; newCheckOut: string }>
  | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(dryRun: boolean) {
    setLoading(true);
    setError(null);
    if (!dryRun) setMessage(null);

    try {
      const res = await fetch("/api/admin/backdate-arrivals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");

      if (dryRun) {
        setPreview(data.results ?? []);
        setMessage(
          data.count === 0
            ? "No reservations with check-in today were found."
            : `Preview: ${data.count} guest(s) would move to check-in yesterday and check-out today.`,
        );
      } else {
        setPreview(null);
        setMessage(`Updated ${data.count} reservation(s). Guests now show under Today's Departures.`);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-8 max-w-2xl rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
      <h3 className="font-semibold text-slate-800">Fix today&apos;s arrivals</h3>
      <p className="mt-2 text-sm text-slate-600">
        Use this when reservations were entered with check-in today but guests actually arrived
        yesterday and should check out today. Moves each today arrival to check-in yesterday,
        check-out today, and marks them as checked in.
      </p>

      {message && (
        <p className="mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-room-vacant">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-room-dirty">
          {error}
        </p>
      )}

      {preview && preview.length > 0 && (
        <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm">
          {preview.map((row) => (
            <li key={`${row.roomNumber}-${row.guestName}`}>
              Room {row.roomNumber} — {row.guestName} → check-out{" "}
              {row.newCheckOut.slice(0, 10)}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={() => run(true)}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? "Working…" : "Preview changes"}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            if (
              !window.confirm(
                "Move all of today's arrivals to checked-in yesterday with check-out today?",
              )
            ) {
              return;
            }
            run(false);
          }}
          className="rounded-lg bg-room-occupied px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Apply fix
        </button>
      </div>
    </section>
  );
}
