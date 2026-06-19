"use client";

import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants";
import { formatPHP } from "@/lib/format";
import type { KeycardReconResult, KeycardRowStatus } from "@/lib/keycard";
import type { ReportSummary, ReportType } from "@/lib/reports";
import { cn } from "@/lib/utils";
import { FileSpreadsheet, FileText } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type UiReportType = ReportType | "KEYCARD";

type ReportsGeneratorProps = {
  defaultFrom: string;
  defaultTo: string;
};

const PAYMENT_METHOD_FILTER_TYPES: ReportType[] = ["DAILY_SALES", "STAFF_TRANSACTIONS"];

const REPORT_TYPES: { value: UiReportType; label: string }[] = [
  { value: "DAILY_SALES", label: "Daily Sales Report" },
  { value: "STAFF_TRANSACTIONS", label: "Staff Transactions" },
  { value: "EXPENSES", label: "Expenses Report" },
  { value: "KEYCARD", label: "Keycard Reconciliation" },
  { value: "WEEKLY_SUMMARY", label: "Weekly Owner Summary" },
  { value: "OCCUPANCY", label: "Occupancy Report" },
  { value: "REVENUE_SUMMARY", label: "Revenue Summary" },
  { value: "FINANCIAL", label: "Financial Statement" },
];

const KEYCARD_STATUS_STYLES: Record<KeycardRowStatus, string> = {
  MATCHED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  KEYCARD_NO_BOOKING: "bg-red-50 text-room-dirty border-red-200",
  BOOKING_NO_KEYCARD: "bg-amber-50 text-amber-700 border-amber-200",
};

const KEYCARD_STATUS_LABELS: Record<KeycardRowStatus, string> = {
  MATCHED: "Matched",
  KEYCARD_NO_BOOKING: "Keycard, no booking",
  BOOKING_NO_KEYCARD: "Booking, no keycard",
};

type StaffOption = {
  id: string;
  name: string;
  role: string;
};

export function ReportsGenerator({ defaultFrom, defaultTo }: ReportsGeneratorProps) {
  const [type, setType] = useState<UiReportType>("DAILY_SALES");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [staffId, setStaffId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [keycardFile, setKeycardFile] = useState<File | null>(null);
  const [keycardResult, setKeycardResult] = useState<KeycardReconResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isKeycard = type === "KEYCARD";
  const supportsPaymentFilter =
    type !== "KEYCARD" && PAYMENT_METHOD_FILTER_TYPES.includes(type);
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    if (type === "KEYCARD") {
      setReport(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type, from, to });
      if (type === "STAFF_TRANSACTIONS" && staffId) {
        params.set("staffId", staffId);
      }
      if (PAYMENT_METHOD_FILTER_TYPES.includes(type) && paymentMethod) {
        params.set("paymentMethod", paymentMethod);
      }
      const res = await fetch(`/api/reports?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate");
      setReport({
        ...data,
        totalCollected: data.totalCollected ?? 0,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [type, from, to, staffId, paymentMethod]);

  useEffect(() => {
    void generate();
  }, [generate]);

  const runKeycard = useCallback(async () => {
    if (!keycardFile) {
      setError("Choose a keycard report file (.xlsx or .csv) first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", keycardFile);
      body.set("from", from);
      body.set("to", to);
      const res = await fetch("/api/reports/keycard", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to reconcile keycards");
      setKeycardResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setKeycardResult(null);
    } finally {
      setLoading(false);
    }
  }, [keycardFile, from, to]);

  useEffect(() => {
    fetch("/api/reports/staff")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: StaffOption[]) => setStaffOptions(data))
      .catch(() => setStaffOptions([]));
  }, []);

  function exportKeycardCsv() {
    if (!keycardResult) return;
    const header = ["Room No.", "Check-in", "Departure", "Status", "Guest", "Notes"];
    const lines = keycardResult.rows.map((row) =>
      [
        row.room,
        row.checkIn,
        row.departure,
        KEYCARD_STATUS_LABELS[row.status],
        row.guest,
        row.note,
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = "\uFEFF" + [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `keycard_reconciliation_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportFile(format: "csv" | "pdf") {
    const params = new URLSearchParams({ type, from, to, format });
    if (type === "STAFF_TRANSACTIONS" && staffId) {
      params.set("staffId", staffId);
    }
    if (type !== "KEYCARD" && PAYMENT_METHOD_FILTER_TYPES.includes(type) && paymentMethod) {
      params.set("paymentMethod", paymentMethod);
    }
    window.open(`/api/reports/export?${params}`, "_blank");
  }

  function printPdf() {
    if (!report) return;
    const params = new URLSearchParams({ type, from, to, format: "html" });
    if (type === "STAFF_TRANSACTIONS" && staffId) {
      params.set("staffId", staffId);
    }
    if (type !== "KEYCARD" && PAYMENT_METHOD_FILTER_TYPES.includes(type) && paymentMethod) {
      params.set("paymentMethod", paymentMethod);
    }
    const w = window.open(`/api/reports/export?${params}`, "_blank");
    w?.addEventListener("load", () => w.print());
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Daily Sales lists every guest stay in the date range with room charges, paid amount (and
        mode of payment), and balance. The Expenses Report lists all expenses recorded in the
        selected date range. Collected shows payments actually received — record payments in
        Billing or at check-out.
      </p>
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-card p-4 shadow-sm">
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Report Type</span>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as UiReportType);
              setError(null);
            }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm min-w-[200px]"
          >
            {REPORT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        {type === "STAFF_TRANSACTIONS" && (
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">Staff account</span>
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm min-w-[220px]"
            >
              <option value="">All staff</option>
              {staffOptions.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name} — {staff.role.replace("_", " ")}
                </option>
              ))}
            </select>
          </label>
        )}
        {supportsPaymentFilter && (
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">Mode of payment</span>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm min-w-[180px]"
            >
              <option value="">All methods</option>
              {PAYMENT_METHOD_OPTIONS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {isKeycard && (
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">Keycard report file</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setKeycardFile(e.target.files?.[0] ?? null)}
              className="block w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm"
            />
          </label>
        )}
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
          onClick={() => void (isKeycard ? runKeycard() : generate())}
          disabled={loading || (isKeycard && !keycardFile)}
          className="rounded-lg bg-sidebar px-5 py-2 text-sm font-medium text-white hover:bg-sidebar-hover disabled:opacity-50"
        >
          {loading ? "Working…" : isKeycard ? "Reconcile" : "Generate"}
        </button>
      </div>

      {isKeycard && (
        <p className="text-sm text-slate-600">
          Upload your keycard software&apos;s report (.xlsx or .csv). Each issued card is matched
          to recorded bookings for that room and date range so you can spot rooms used without a
          booking, or bookings with no card issued. The file should include <strong>Room No.</strong>,
          <strong> Check in Time</strong>, and <strong>Departure Time</strong> columns.
        </p>
      )}

      {isKeycard && keycardResult && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Keycards Issued" value={String(keycardResult.totalCards)} />
            <StatCard label="Matched" value={String(keycardResult.matched)} />
            <StatCard label="Keycard, no booking" value={String(keycardResult.keycardNoBooking)} />
            <StatCard label="Booking, no keycard" value={String(keycardResult.bookingNoKeycard)} />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={exportKeycardCsv}
              className="flex items-center gap-2 rounded-lg bg-room-vacant px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-card shadow-sm">
            <div className="border-b border-slate-100 px-5 py-3">
              <h3 className="font-semibold text-slate-800">Keycard Reconciliation</h3>
              <p className="text-xs text-slate-500">
                {from} — {to}
              </p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Room No.</th>
                  <th className="px-4 py-3">Check-in</th>
                  <th className="px-4 py-3">Departure</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Guest</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {keycardResult.rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No keycard rows or bookings found for this date range.
                    </td>
                  </tr>
                ) : (
                  keycardResult.rows.map((row, i) => (
                    <tr key={i} className="border-t border-slate-50">
                      <td className="px-4 py-2.5 font-medium">{row.room}</td>
                      <td className="px-4 py-2.5 text-slate-500">{row.checkIn || "—"}</td>
                      <td className="px-4 py-2.5 text-slate-500">{row.departure || "—"}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            "inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium",
                            KEYCARD_STATUS_STYLES[row.status],
                          )}
                        >
                          {KEYCARD_STATUS_LABELS[row.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{row.guest || "—"}</td>
                      <td className="px-4 py-2.5 text-slate-500">{row.note}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-room-dirty">
          {error}
        </p>
      )}

      {report && (
        <>
          {report.type === "STAFF_TRANSACTIONS" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <StatCard label="Transactions" value={String(report.totalTransactions)} />
              <StatCard label="Collected by selected staff" value={formatPHP(report.totalCollected)} />
            </div>
          ) : report.type === "EXPENSES" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <StatCard label="Total Expenses" value={formatPHP(report.totalRevenue)} />
              <StatCard label="Expense Entries" value={String(report.totalTransactions)} />
            </div>
          ) : report.type === "FINANCIAL" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="Total Revenue" value={formatPHP(report.totalRevenue)} />
              <StatCard label="Total Expenses" value={formatPHP(report.totalExpenses ?? 0)} />
              <StatCard label="Net Income" value={formatPHP(report.netIncome ?? 0)} />
            </div>
          ) : (
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
          )}

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
                      No records in this date range. Widen the From/To dates or choose another
                      staff member.
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
