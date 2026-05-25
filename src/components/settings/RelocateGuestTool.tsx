"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RelocateGuestTool() {
  const router = useRouter();
  const [fromRoom, setFromRoom] = useState("23");
  const [toRoom, setToRoom] = useState("24");
  const [note, setNote] = useState("Under maintenance");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(dryRun: boolean) {
    setLoading(true);
    setError(null);
    if (!dryRun) setMessage(null);

    try {
      const res = await fetch("/api/admin/relocate-guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromRoomNumber: fromRoom,
          toRoomNumber: toRoom,
          maintenanceNote: note || undefined,
          dryRun,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");

      const { guestName, fromRoomNumber, toRoomNumber } = data.result;
      const summary = `${guestName}: Room ${fromRoomNumber} → Room ${toRoomNumber}`;

      if (dryRun) {
        setPreview(summary);
        setMessage(`Preview: ${summary}. Room ${fromRoomNumber} will be marked under maintenance.`);
      } else {
        setPreview(null);
        setMessage(`Done. ${summary}. Room ${fromRoomNumber} is under maintenance.`);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  const fieldClass =
    "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-room-occupied focus:outline-none focus:ring-1 focus:ring-room-occupied";

  return (
    <section className="mt-8 max-w-2xl rounded-xl border border-slate-200 bg-card p-5 shadow-sm">
      <h3 className="font-semibold text-slate-800">Move guest to another room</h3>
      <p className="mt-2 text-sm text-slate-600">
        Relocate an in-house or reserved guest and mark the original room under maintenance
        (out of order).
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
      {preview && (
        <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
          {preview}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-slate-500">From room</span>
          <input value={fromRoom} onChange={(e) => setFromRoom(e.target.value)} className={fieldClass} />
        </label>
        <label className="block text-sm">
          <span className="text-slate-500">To room</span>
          <input value={toRoom} onChange={(e) => setToRoom(e.target.value)} className={fieldClass} />
        </label>
      </div>
      <label className="mt-3 block text-sm">
        <span className="text-slate-500">Maintenance note (Room {fromRoom || "…"})</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={fieldClass} />
      </label>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={loading || !fromRoom || !toRoom}
          onClick={() => run(true)}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? "Working…" : "Preview"}
        </button>
        <button
          type="button"
          disabled={loading || !fromRoom || !toRoom}
          onClick={() => {
            if (
              !window.confirm(
                `Move guest from Room ${fromRoom} to Room ${toRoom} and mark Room ${fromRoom} under maintenance?`,
              )
            ) {
              return;
            }
            run(false);
          }}
          className="rounded-lg bg-room-occupied px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Apply move
        </button>
      </div>
    </section>
  );
}
