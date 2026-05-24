"use client";

import { formatPHP } from "@/lib/format";
import type { ReceiptData } from "@/lib/receipts";
import { Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ReceiptFolioOption = {
  id: string;
  folioNumber: string;
  guestName: string;
  roomNumber: string;
  paid: number;
  paidAt: string | null;
};

type ReceiptPreviewProps = {
  folios: ReceiptFolioOption[];
  initialFolioId?: string;
  initialReceipt?: ReceiptData | null;
};

export function ReceiptPreview({
  folios,
  initialFolioId,
  initialReceipt,
}: ReceiptPreviewProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [folioId, setFolioId] = useState(initialFolioId ?? folios[0]?.id ?? "");
  const [receipt, setReceipt] = useState<ReceiptData | null>(initialReceipt ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!folioId) {
      setReceipt(null);
      return;
    }

    setLoading(true);
    fetch(`/api/receipts?folioId=${folioId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setReceipt)
      .finally(() => setLoading(false));
  }, [folioId]);

  function handlePrint() {
    window.print();
  }

  if (folios.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-400">
        No paid transactions yet. Complete a check-out or record a payment in Billing first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 no-print">
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Select transaction</span>
          <select
            value={folioId}
            onChange={(e) => setFolioId(e.target.value)}
            className="min-w-[280px] rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {folios.map((f) => (
              <option key={f.id} value={f.id}>
                {f.folioNumber} — {f.guestName} · Rm {f.roomNumber} ({formatPHP(f.paid)})
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={handlePrint}
          disabled={!receipt || loading}
          className="flex items-center gap-2 rounded-lg bg-sidebar px-4 py-2 text-sm font-medium text-white hover:bg-sidebar-hover disabled:opacity-50"
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading receipt…</p>}

      {receipt && (
        <div
          ref={printRef}
          id="receipt-print"
          className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:shadow-none print:border-0"
        >
          <div className="border-b border-dashed border-slate-300 pb-4 text-center">
            <p className="text-lg font-bold text-slate-800">{receipt.hotel.name}</p>
            <p className="text-xs tracking-[0.2em] text-slate-500">{receipt.hotel.tagline}</p>
            {receipt.hotel.address && (
              <p className="mt-2 text-xs text-slate-500">{receipt.hotel.address}</p>
            )}
            {receipt.hotel.phone && (
              <p className="text-xs text-slate-500">Tel: {receipt.hotel.phone}</p>
            )}
          </div>

          <div className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">OR #</span>
              <span className="font-mono font-medium">{receipt.orNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Date</span>
              <span>{receipt.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Guest</span>
              <span className="font-medium">{receipt.guestName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Room</span>
              <span>{receipt.roomNumber}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Stay</span>
              <span>
                {receipt.checkIn} — {receipt.checkOut}
              </span>
            </div>
          </div>

          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="pb-2 text-left">Description</th>
                <th className="pb-2 text-right">Qty</th>
                <th className="pb-2 text-right">Rate</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {receipt.lines.map((line, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2">{line.description}</td>
                  <td className="py-2 text-right">{line.quantity}</td>
                  <td className="py-2 text-right">{formatPHP(line.rate)}</td>
                  <td className="py-2 text-right">{formatPHP(line.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 space-y-1 border-t border-dashed border-slate-300 pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span>{formatPHP(receipt.subtotal)}</span>
            </div>
            {receipt.discount > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Discount</span>
                <span>-{formatPHP(receipt.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatPHP(receipt.total)}</span>
            </div>
            <div className="flex justify-between font-bold text-room-vacant">
              <span>Amount Paid</span>
              <span>{formatPHP(receipt.paid)}</span>
            </div>
            {receipt.paymentMethod && (
              <div className="flex justify-between text-xs text-slate-400">
                <span>Payment</span>
                <span>{receipt.paymentMethod.replace("_", " ")}</span>
              </div>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            {receipt.hotel.receiptFooter ??
              `Thank you for staying at ${receipt.hotel.name}!`}
          </p>
        </div>
      )}
    </div>
  );
}
