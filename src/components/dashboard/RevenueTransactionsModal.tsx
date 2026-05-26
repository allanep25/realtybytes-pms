"use client";

import type { PaymentTransaction, RevenueSummary } from "@/lib/revenue";
import { formatDate, formatPHP, formatTime } from "@/lib/format";
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-xl bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Payment transactions</h2>
            <p className="text-xs text-slate-400">
              {periodLabel(from, to)} · {transactions.length} payment
              {transactions.length === 1 ? "" : "s"} · {formatPHP(total)}
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
              No payments recorded for this period.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date / time</th>
                  <th className="px-4 py-3">Guest</th>
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3">Folio</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <TransactionRow key={transaction.id} transaction={transaction} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function TransactionRow({ transaction }: { transaction: PaymentTransaction }) {
  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">
        <span className="block">{formatDate(transaction.paidAt)}</span>
        <span className="text-xs text-slate-400">{formatTime(transaction.paidAt)}</span>
      </td>
      <td className="px-4 py-2.5 font-medium text-slate-800">{transaction.guestName}</td>
      <td className="px-4 py-2.5 text-slate-600">{transaction.roomNumber}</td>
      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{transaction.folioNumber}</td>
      <td className="px-4 py-2.5 text-slate-600">{transaction.methodLabel}</td>
      <td className="px-4 py-2.5 text-right font-medium tabular-nums text-slate-800">
        {formatPHP(transaction.amount)}
      </td>
    </tr>
  );
}
