"use client";

import { formatPHP } from "@/lib/format";
import type { ReportSummary, ReportType } from "@/lib/reports";
import { cn } from "@/lib/utils";
import { FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";

type ReportsGeneratorProps = {
  defaultFrom: string;
  defaultTo: string;
};

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: "DAILY_SALES", label: "Daily Sales Report" },
  { value: "OCCUPANCY", label: "Occupancy Report" },
  { value: "REVENUE_SUMMARY", label: "Revenue Summary" },
];

export function ReportsGenerator({ defaultFrom, defaultTo }: ReportsGeneratorProps) {
  const [type, setType] = useState<ReportType>("DAILY_SALES");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type, from, to });
      const res = await fetch(`/api/reports?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate");
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  function exportFile(format: "csv" | "pdf") {
    const params = new URLSearchParams({ type, from, to, format });
    window.open(`/api/reports/export?${params}`, "_blank");
  }

  function printPdf() {
    if (!report) return;
    const params = new URLSearchParams({ type, from, to, format: "html" });
    const w = window.open(`/api/reports/export?${params}`, "_blank");
    w?.addEventListener("load", () => w.print());
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-card p-4 shadow-sm">
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Report Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ReportType)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm min-w-[200px]"
          >
            {REPORT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">To</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="rounded-lg bg-sidebar px-5 py-2 text-sm font-medium text-white hover:bg-sidebar-hover disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate"}
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-room-dirty">
          {error}
        </p>
      )}

      {report && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Room Revenue" value={formatPHP(report.totalRevenue)} />
            <StatCard label="Collected" value={formatPHP(report.totalCollected)} />
            <StatCard label="Guest Stays" value={String(report.totalTransactions)} />
            <StatCard
              label="Occupancy Rate"
              value={`${report.occupancyRate.toFixed(2)}%`}
            />
            <StatCard label="Average Daily Rate" value={formatPHP(report.adr)} />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => exportFile("csv")}
              className="flex items-center gap-2 rounded-lg bg-room-vacant px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </button>
            <button
              type="button"
              onClick={printPdf}
              className="flex items-center gap-2 rounded-lg bg-room-dirty px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <FileText className="h-4 w-4" />
              Export PDF
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-card shadow-sm">
            <div className="border-b border-slate-100 px-5 py-3">
              <h3 className="font-semibold text-slate-800">{report.label}</h3>
              <p className="text-xs text-slate-500">
                {from} — {to}
              </p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Detail</th>
                  <th className="px-4 py-3">Info</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                      No data for this period.
                    </td>
                  </tr>
                ) : (
                  report.rows.map((row, i) => (
                    <tr key={i} className="border-t border-slate-50">
                      <td className="px-4 py-2.5">{row.label}</td>
                      <td className="px-4 py-2.5 text-slate-500">{row.value}</td>
                      <td className="px-4 py-2.5 text-right font-medium">
                        {row.amount != null ? formatPHP(row.amount) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-card p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold text-slate-800")}>{value}</p>
    </div>
  );
}
