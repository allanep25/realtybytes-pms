"use client";

import type { RevenueLedgerEntry, RevenueSummary } from "@/lib/revenue";
import { formatDate, formatPHP, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useState } from "react";

type RevenueTransactionsModalProps = {
  open: boolean;
  onClose: () => void;
  summary: RevenueSummary | null;
  canConfirmReceipt?: boolean;
  onReceiptChange?: () => void;
};

function periodLabel(from: string, to: string) {
  if (from === to) return formatDate(from);
  return `${formatDate(from)} — ${formatDate(to)}`;
}

export function RevenueTransactionsModal({
  open,
  onClose,
  summary,
  canConfirmReceipt = false,
  onReceiptChange,
}: RevenueTransactionsModalProps) {
  if (!open || !summary) return null;

  const { transactions, from, to, total, grossTotal, expensesTotal } = summary;
  const paymentCount = transactions.filter((entry) => entry.kind === "payment").length;
  const discountCount = transactions.filter((entry) => entry.kind === "discount").length;
  const expenseCount = transactions.filter((entry) => entry.kind === "expense").length;

  // Show the "money received" control only once per guest folio (the first
  // payment row for that folio); later split-payment rows just show the status.
  const folioFirstRow = new Set<string>();

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
            <h2 className="text-sm font-semibold text-slate-800">Money collected</h2>
            <p className="text-xs text-slate-400">
              {periodLabel(from, to)} · {paymentCount} payment{paymentCount === 1 ? "" : "s"} ·{" "}
              {expensesTotal > 0 ? `${formatPHP(grossTotal)} collected · ${formatPHP(total)} available` : `${formatPHP(total)} collected`}
              {expenseCount > 0
                ? ` · ${expenseCount} expense${expenseCount === 1 ? "" : "s"}`
                : ""}
              {discountCount > 0
                ? ` · ${discountCount} discount${discountCount === 1 ? "" : "s"} on paid stays`
                : ""}
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
              No money collected for this period.
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
                  <th className="px-4 py-3 text-center">Received by owner</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((entry) => {
                  let showControl = false;
                  if (entry.kind === "payment" && entry.folioId) {
                    if (!folioFirstRow.has(entry.folioId)) {
                      folioFirstRow.add(entry.folioId);
                      showControl = true;
                    }
                  }
                  return (
                    <TransactionRow
                      key={entry.id}
                      entry={entry}
                      canConfirmReceipt={canConfirmReceipt}
                      showControl={showControl}
                      onReceiptChange={onReceiptChange}
                    />
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function TransactionRow({
  entry,
  canConfirmReceipt,
  showControl,
  onReceiptChange,
}: {
  entry: RevenueLedgerEntry;
  canConfirmReceipt: boolean;
  showControl: boolean;
  onReceiptChange?: () => void;
}) {
  const isDiscount = entry.kind === "discount";
  const isExpense = entry.kind === "expense";

  return (
    <tr
      className={cn(
        "border-t border-slate-100",
        isDiscount && "bg-amber-50/60",
        isExpense && "bg-red-50/50",
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
              : isExpense
                ? "bg-red-100 text-room-dirty"
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
          isDiscount ? "text-amber-900" : isExpense ? "text-room-dirty" : "text-slate-800",
        )}
      >
        {isDiscount || isExpense ? `− ${formatPHP(entry.amount)}` : formatPHP(entry.amount)}
      </td>
      <td className="px-4 py-2.5 text-center">
        {entry.kind === "payment" && entry.folioId ? (
          <ReceiptControl
            folioId={entry.folioId}
            received={Boolean(entry.ownerReceivedAt)}
            receivedByName={entry.ownerReceivedByName ?? null}
            canConfirmReceipt={canConfirmReceipt}
            interactive={showControl}
            onReceiptChange={onReceiptChange}
          />
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </td>
    </tr>
  );
}

function ReceiptControl({
  folioId,
  received,
  receivedByName,
  canConfirmReceipt,
  interactive,
  onReceiptChange,
}: {
  folioId: string;
  received: boolean;
  receivedByName: string | null;
  canConfirmReceipt: boolean;
  interactive: boolean;
  onReceiptChange?: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function toggle() {
    setPending(true);
    setError(false);
    try {
      const res = await fetch(`/api/folios/${folioId}/owner-received`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ received: !received }),
      });
      if (!res.ok) throw new Error("Failed");
      onReceiptChange?.();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  if (received) {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-room-vacant/15 px-2 py-0.5 text-xs font-semibold text-room-vacant">
          <Check className="h-3 w-3" /> Received
        </span>
        {receivedByName && (
          <span className="text-[10px] text-slate-400">by {receivedByName}</span>
        )}
        {canConfirmReceipt && interactive && (
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            className="text-[10px] text-slate-400 underline hover:text-slate-600 disabled:opacity-50"
          >
            Undo
          </button>
        )}
      </div>
    );
  }

  if (!canConfirmReceipt) {
    return <span className="text-xs text-slate-300">Not yet</span>;
  }

  if (!interactive) {
    return <span className="text-xs text-slate-300">Not yet</span>;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={cn(
        "rounded-lg border px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50",
        error
          ? "border-red-300 bg-red-50 text-room-dirty"
          : "border-room-vacant/40 bg-room-vacant/10 text-room-vacant hover:bg-room-vacant/20",
      )}
    >
      {pending ? "Saving…" : error ? "Retry" : "Mark received"}
    </button>
  );
}
