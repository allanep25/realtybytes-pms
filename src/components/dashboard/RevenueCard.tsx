"use client";

import { RevenueTransactionsModal } from "@/components/dashboard/RevenueTransactionsModal";
import { hotelCalendarDate } from "@/lib/dates";
import { formatDate, formatPHP } from "@/lib/format";
import type { RevenueSummary } from "@/lib/revenue";
import { cn } from "@/lib/utils";
import { CalendarRange, List } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type RevenueCardProps = {
  initialSummary: RevenueSummary;
};

function periodTitle(from: string, to: string) {
  const today = hotelCalendarDate();
  if (from === to && from === today) return "Today's Revenue";
  if (from === to) return `Revenue · ${formatDate(from)}`;
  return `Revenue · ${formatDate(from)} — ${formatDate(to)}`;
}

export function RevenueCard({ initialSummary }: RevenueCardProps) {
  const today = hotelCalendarDate();
  const [from, setFrom] = useState(initialSummary.from);
  const [to, setTo] = useState(initialSummary.to);
  const [summary, setSummary] = useState(initialSummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTransactions, setShowTransactions] = useState(false);

  const loadSummary = useCallback(async (fromDate: string, toDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      const res = await fetch(`/api/revenue?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load revenue");
      setSummary(data as RevenueSummary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load revenue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (from === initialSummary.from && to === initialSummary.to) {
      setSummary(initialSummary);
      return;
    }
    if (to < from) return;
    void loadSummary(from, to);
  }, [from, to, initialSummary, loadSummary]);

  const { total, changePercent, breakdown, transactions } = summary;
  const positive = changePercent != null && changePercent >= 0;
  const isToday = from === to && from === today;
  const showComparison = isToday && total > 0 && changePercent != null;

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-slate-800">{periodTitle(from, to)}</h3>
          <CalendarRange className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-500">From</span>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-500">To</span>
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </label>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-room-dirty">
            {error}
          </p>
        )}

        <ul
          className={cn(
            "mt-4 space-y-2 border-b border-slate-100 pb-4 text-sm",
            loading && "opacity-50",
          )}
        >
          {breakdown.map((item) => (
            <li key={item.method} className="flex items-center justify-between gap-3">
              <span className="font-semibold text-slate-700">{item.label}</span>
              <span
                className={cn(
                  "text-base font-bold tabular-nums",
                  item.amount > 0 ? "text-slate-900" : "text-slate-400",
                )}
              >
                {formatPHP(item.amount)}
              </span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => setShowTransactions(true)}
          className={cn(
            "mt-4 flex w-full items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-3 text-left transition hover:bg-slate-100",
            loading && "pointer-events-none opacity-50",
          )}
        >
          <span className="text-sm font-bold text-slate-800">
            {from === to ? "Total for day" : "Total for period"}
          </span>
          <span className="text-2xl font-bold tabular-nums text-slate-900">{formatPHP(total)}</span>
        </button>

        {total === 0 && !loading ? (
          <p className="mt-2 text-sm font-medium text-slate-500">No payments in this period</p>
        ) : showComparison ? (
          <p
            className={cn(
              "mt-2 text-sm font-semibold",
              positive ? "text-room-vacant" : "text-room-dirty",
            )}
          >
            {positive ? "+" : ""}
            {changePercent.toFixed(1)}% vs yesterday
          </p>
        ) : isToday && total > 0 ? (
          <p className="mt-2 text-sm font-medium text-slate-500">First payment of the day</p>
        ) : null}

        <button
          type="button"
          onClick={() => setShowTransactions(true)}
          disabled={loading}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          <List className="h-4 w-4" />
          View transactions ({transactions.length})
        </button>
      </div>

      <RevenueTransactionsModal
        open={showTransactions}
        onClose={() => setShowTransactions(false)}
        summary={summary}
      />
    </>
  );
}
