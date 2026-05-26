"use client";

import type { RevenueLedgerEntry, RevenueSummary } from "@/lib/revenue";
import { formatDate, formatPHP, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

type RevenueTransactionsModalProps = {
  open: boolean;
  onClose: () => void;
  summary: RevenueSummary | null;
};

function periodLabel(from: string, to: string) {
  if (from === to) return formatDate(from);
  return `${formatDate(from)} — ${formatDate(to)}`;
}

export function RevenueTransactionsModal({
  open,
  onClose,
  summary,
}: RevenueTransactionsModalProps) {
  if (!open || !summary) return null;

  const { transactions, from, to, total, totalDiscount } = summary;
  const paymentCount = transactions.filter((entry) => entry.kind === "payment").length;
  const discountCount = transactions.filter((entry) => entry.kind === "discount").length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-xl bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Payments &amp; discounts</h2>
            <p className="text-xs text-slate-400">
              {periodLabel(from, to)} · {paymentCount} payment{paymentCount === 1 ? "" : "s"}
              {discountCount > 0
                ? ` · ${discountCount} discount${discountCount === 1 ? "" : "s"}`
                : ""}{" "}
              · {formatPHP(total)}
              {totalDiscount > 0 ? ` · −${formatPHP(totalDiscount)} discounts` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto">
          {transactions.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400">
              No payments or discounts recorded for this period.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date / time</th>
                  <th className="px-4 py-3">Guest</th>
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3">Folio</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((entry) => (
                  <TransactionRow key={entry.id} entry={entry} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function TransactionRow({ entry }: { entry: RevenueLedgerEntry }) {
  const isDiscount = entry.kind === "discount";

  return (
    <tr
      className={cn(
        "border-t border-slate-100",
        isDiscount && "bg-amber-50/60",
      )}
    >
      <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">
        <span className="block">{formatDate(entry.recordedAt)}</span>
        <span className="text-xs text-slate-400">{formatTime(entry.recordedAt)}</span>
      </td>
      <td className="px-4 py-2.5 font-medium text-slate-800">{entry.guestName}</td>
      <td className="px-4 py-2.5 text-slate-600">{entry.roomNumber}</td>
      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{entry.folioNumber}</td>
      <td className="px-4 py-2.5">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            isDiscount
              ? "bg-amber-100 text-amber-900"
              : "bg-slate-100 text-slate-700",
          )}
        >
          {entry.methodLabel}
        </span>
      </td>
      <td className="px-4 py-2.5 text-xs text-slate-500">{entry.detail}</td>
      <td
        className={cn(
          "px-4 py-2.5 text-right font-medium tabular-nums",
          isDiscount ? "text-amber-900" : "text-slate-800",
        )}
      >
        {isDiscount ? `− ${formatPHP(entry.amount)}` : formatPHP(entry.amount)}
      </td>
    </tr>
  );
}
