"use client";

import { EditRecordForm } from "@/components/admin/EditRecordForm";
import { RESERVATION_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { EditableReservationListItem } from "@/lib/admin-edit";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

type EditRecordsWorkspaceProps = {
  initialTodayRecords?: EditableReservationListItem[];
  initialReservationId?: string | null;
};

export function EditRecordsWorkspace({
  initialTodayRecords = [],
  initialReservationId = null,
}: EditRecordsWorkspaceProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EditableReservationListItem[]>(initialTodayRecords);
  const [showingToday, setShowingToday] = useState(true);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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

  useEffect(() => {
    if (initialReservationId) {
      setSelectedId(initialReservationId);
    }
  }, [initialReservationId]);

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

        {message && !selectedId && (
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
                  onClick={() => setSelectedId(item.id)}
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

      {selectedId && (
        <section className="rounded-xl border border-slate-200 bg-card p-5 shadow-sm">
          <EditRecordForm
            reservationId={selectedId}
            onClose={() => {
              setSelectedId(null);
              setMessage(null);
              setError(null);
            }}
          />
        </section>
      )}
    </div>
  );
}
