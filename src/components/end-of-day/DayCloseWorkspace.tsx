"use client";

import { hotelCalendarDate } from "@/lib/dates";
import type { DayCloseSummary } from "@/lib/day-close";
import { formatPHP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type DayCloseWorkspaceProps = {
  initialDate: string;
  initialSummary: DayCloseSummary;
};

const FIELDS = [
  { key: "cash", label: "Cash", expectedKey: "cash" as const, actualKey: "cash" as const },
  { key: "gcash", label: "GCash", expectedKey: "gcash" as const, actualKey: "gcash" as const },
  { key: "card", label: "Card", expectedKey: "card" as const, actualKey: "card" as const },
  {
    key: "bankTransfer",
    label: "Bank Transfer",
    expectedKey: "bankTransfer" as const,
    actualKey: "bankTransfer" as const,
  },
];

export function DayCloseWorkspace({ initialDate, initialSummary }: DayCloseWorkspaceProps) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [summary, setSummary] = useState(initialSummary);
  const [actualCash, setActualCash] = useState("");
  const [actualGcash, setActualGcash] = useState("");
  const [actualCard, setActualCard] = useState("");
  const [actualBankTransfer, setActualBankTransfer] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async (businessDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/day-close?date=${businessDate}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setSummary(data);
      setActualCash(data.actual?.cash?.toString() ?? "");
      setActualGcash(data.actual?.gcash?.toString() ?? "");
      setActualCard(data.actual?.card?.toString() ?? "");
      setActualBankTransfer(data.actual?.bankTransfer?.toString() ?? "");
      setNotes(data.notes ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (date === initialDate) {
      setSummary(initialSummary);
      setActualCash(initialSummary.actual?.cash?.toString() ?? "");
      setActualGcash(initialSummary.actual?.gcash?.toString() ?? "");
      setActualCard(initialSummary.actual?.card?.toString() ?? "");
      setActualBankTransfer(initialSummary.actual?.bankTransfer?.toString() ?? "");
      setNotes(initialSummary.notes ?? "");
      return;
    }
    void loadSummary(date);
  }, [date, initialDate, initialSummary, loadSummary]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/day-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessDate: date,
          actualCash: Number(actualCash) || 0,
          actualGcash: Number(actualGcash) || 0,
          actualCard: Number(actualCard) || 0,
          actualBankTransfer: Number(actualBankTransfer) || 0,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setSummary(data);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const actualTotal =
    (Number(actualCash) || 0) +
    (Number(actualGcash) || 0) +
    (Number(actualCard) || 0) +
    (Number(actualBankTransfer) || 0);
  const variance = actualTotal - summary.expected.total;

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Compare what the system recorded against what you counted at the front desk. Use the same
        date as your revenue report.
      </p>

      <div className="rounded-xl border border-slate-200 bg-card p-4 shadow-sm">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-500">Business date</span>
          <input
            type="date"
            value={date}
            max={hotelCalendarDate()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-room-dirty">
          {error}
        </p>
      )}

      <form onSubmit={handleSave} className={cn("space-y-4", loading && "opacity-50")}>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3 text-right">System</th>
                <th className="px-4 py-3 text-right">Actual counted</th>
                <th className="px-4 py-3 text-right">Variance</th>
              </tr>
            </thead>
            <tbody>
              {FIELDS.map((field) => {
                const expected = summary.expected[field.expectedKey];
                const actualValues = {
                  cash: actualCash,
                  gcash: actualGcash,
                  card: actualCard,
                  bankTransfer: actualBankTransfer,
                };
                const setters = {
                  cash: setActualCash,
                  gcash: setActualGcash,
                  card: setActualCard,
                  bankTransfer: setActualBankTransfer,
                };
                const actual = Number(actualValues[field.actualKey]) || 0;
                const rowVariance = actual - expected;
                return (
                  <tr key={field.key} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-800">{field.label}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatPHP(expected)}</td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={actualValues[field.actualKey]}
                        onChange={(e) => setters[field.actualKey](e.target.value)}
                        className="w-32 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm"
                      />
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-medium tabular-nums",
                        rowVariance === 0
                          ? "text-slate-500"
                          : rowVariance > 0
                            ? "text-room-vacant"
                            : "text-room-dirty",
                      )}
                    >
                      {rowVariance > 0 ? "+" : ""}
                      {formatPHP(rowVariance)}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatPHP(summary.expected.total)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatPHP(actualTotal)}</td>
                <td
                  className={cn(
                    "px-4 py-3 text-right tabular-nums",
                    variance === 0 ? "text-slate-600" : variance > 0 ? "text-room-vacant" : "text-room-dirty",
                  )}
                >
                  {variance > 0 ? "+" : ""}
                  {formatPHP(variance)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Explain any variance…"
          />
        </label>

        {summary.closedAt && (
          <p className="text-sm text-room-vacant">
            Last closed by {summary.closedByName} on {new Date(summary.closedAt).toLocaleString("en-PH")}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || loading}
          className="rounded-lg bg-sidebar px-5 py-2.5 text-sm font-medium text-white hover:bg-sidebar-hover disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save day close"}
        </button>
      </form>
    </div>
  );
}
