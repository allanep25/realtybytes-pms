"use client";

import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants";
import { hotelCalendarDate } from "@/lib/dates";
import {
  EXPENSE_CATEGORY_OPTIONS,
  type ExpenseItem,
  type ExpenseSummary,
} from "@/lib/expenses";
import { formatPHP, formatTime } from "@/lib/format";
import type { ExpenseCategory, PaymentMethod } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type ExpensesWorkspaceProps = {
  initialDate: string;
  initialSummary: ExpenseSummary;
};

const emptyForm = {
  amount: "",
  method: "CASH" as PaymentMethod,
  category: "SUPPLIES" as ExpenseCategory,
  description: "",
  vendor: "",
};

export function ExpensesWorkspace({ initialDate, initialSummary }: ExpensesWorkspaceProps) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [summary, setSummary] = useState(initialSummary);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadExpenses = useCallback(async (businessDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/expenses?date=${businessDate}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load expenses");
      setSummary(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (date === initialDate) {
      setSummary(initialSummary);
      return;
    }
    void loadExpenses(date);
  }, [date, initialDate, initialSummary, loadExpenses]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessDate: date,
          amount: Number(form.amount) || 0,
          method: form.method,
          category: form.category,
          description: form.description,
          vendor: form.vendor || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save expense");

      setSummary((current) => {
        const item = data as ExpenseItem;
        const totalsByMethod = {
          ...current.totalsByMethod,
          [item.method]: (current.totalsByMethod[item.method] ?? 0) + item.amount,
        };
        return {
          ...current,
          items: [item, ...current.items],
          total: current.total + item.amount,
          totalsByMethod,
        };
      });
      setForm(emptyForm);
      setMessage("Expense recorded. Today's available revenue has been updated.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save expense");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Record money pulled out from front desk collections for hotel purchases. These expenses are
        deducted from the available revenue and end-of-day expected cash for the selected date.
      </p>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-slate-200 bg-card p-4 shadow-sm xl:col-span-1"
        >
          <div>
            <h2 className="font-semibold text-slate-800">Add expense</h2>
            <p className="mt-1 text-xs text-slate-500">
              Use Cash for physical front desk pull-outs.
            </p>
          </div>

          <label className="block text-sm">
            <span className="text-slate-500">Business date</span>
            <input
              type="date"
              value={date}
              max={hotelCalendarDate()}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="text-slate-500">Amount *</span>
            <input
              required
              type="number"
              min={0}
              step={0.01}
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder="0.00"
            />
          </label>

          <label className="block text-sm">
            <span className="text-slate-500">Deduct from</span>
            <select
              value={form.method}
              onChange={(e) => setForm((f) => ({ ...f, method: e.target.value as PaymentMethod }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              {PAYMENT_METHOD_OPTIONS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-slate-500">Category</span>
            <select
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({ ...f, category: e.target.value as ExpenseCategory }))
              }
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              {EXPENSE_CATEGORY_OPTIONS.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-slate-500">Description *</span>
            <input
              required
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder="e.g. Cleaning supplies"
            />
          </label>

          <label className="block text-sm">
            <span className="text-slate-500">Vendor / paid to</span>
            <input
              value={form.vendor}
              onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Optional"
            />
          </label>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-room-dirty">
              {error}
            </p>
          )}
          {message && (
            <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-room-vacant">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-sidebar px-4 py-2.5 text-sm font-medium text-white hover:bg-sidebar-hover disabled:opacity-50"
          >
            {saving ? "Saving..." : "Record expense"}
          </button>
        </form>

        <div className="space-y-4 xl:col-span-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-card p-4 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Expenses for {date}</p>
              <p className="mt-1 text-2xl font-bold text-room-dirty">{formatPHP(summary.total)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-card p-4 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Cash pull-outs</p>
              <p className="mt-1 text-2xl font-bold text-slate-800">
                {formatPHP(summary.totalsByMethod.CASH ?? 0)}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-card shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="font-semibold text-slate-800">Expense list</h2>
              <p className="text-xs text-slate-500">Newest first</p>
            </div>
            {loading ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">Loading...</p>
            ) : summary.items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">
                No expenses recorded for this date.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Details</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.items.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                        {formatTime(item.spentAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-slate-800">{item.description}</p>
                        <p className="text-xs text-slate-500">
                          {item.categoryLabel}
                          {item.vendor ? ` · ${item.vendor}` : ""} · by {item.recordedByName}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {PAYMENT_METHOD_OPTIONS.find((method) => method.value === item.method)?.label ??
                          item.method}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-room-dirty">
                        - {formatPHP(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
