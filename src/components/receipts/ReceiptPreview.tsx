"use client";

import { formatPHP } from "@/lib/format";
import type { ReceiptData } from "@/lib/receipts";
import { Printer, Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ReceiptFolioOption = {
  id: string;
  folioNumber: string;
  guestName: string;
  roomNumber: string;
  total: number;
  paid: number;
  balanceDue: number;
  paidAt: string | null;
  reservationStatus: string;
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
  const savedProfile =
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("propertyProfile") || "{}")
      : {};
  const receiptPropertyName = savedProfile.propertyName || receipt?.hotel?.name || "RealtyBytes PMS";
  const receiptAddress = savedProfile.address || receipt?.hotel?.address || "";
  const receiptPhone = savedProfile.phone || receipt?.hotel?.phone || "";
  const receiptEmail = savedProfile.email || receipt?.hotel?.email || "";
  const receiptWebsite = savedProfile.website || "";
  const receiptFooter =
    savedProfile.receiptFooter ||
    receipt?.hotel?.receiptFooter ||
    "Thank you for staying with us!";

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

  function handleEmail() {
    if (!receipt) return;
    const subject = encodeURIComponent(`Receipt ${receipt.orNumber} — ${receipt.guestName}`);
    const body = encodeURIComponent(
      [
        receiptPropertyName,
        receiptAddress,
        receiptPhone ? `Phone: ${receiptPhone}` : "",
        receiptEmail ? `Email: ${receiptEmail}` : "",
        receiptWebsite ? `Website: ${receiptWebsite}` : "",
        "",
        `Receipt: ${receipt.orNumber}`,
        `Guest: ${receipt.guestName}`,
        `Room: ${receipt.roomNumber}`,
        `Total: ${formatPHP(receipt.total)}`,
        `Paid: ${formatPHP(receipt.paid)}`,
        receipt.paid < receipt.total ? `Balance: ${formatPHP(receipt.total - receipt.paid)}` : "",
        "",
        receiptFooter,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  if (folios.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
        <p className="font-medium text-slate-700">No guest folios to print yet.</p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed">
          Folios are created when you check in a guest or make a reservation. After recording a
          payment in Billing, print an official receipt here. You can also print a folio summary
          before payment is collected.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 no-print">
        Select a guest folio to preview and print. Amount paid shows on the receipt; record payments
        in Billing first for an official paid receipt.
      </p>
      <div className="flex flex-wrap items-end gap-3 no-print">
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Select folio</span>
          <select
            value={folioId}
            onChange={(e) => setFolioId(e.target.value)}
            className="min-w-[280px] rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {folios.map((f) => (
              <option key={f.id} value={f.id}>
                {f.folioNumber} — {f.guestName} · Rm {f.roomNumber}
                {f.paid > 0
                  ? ` · Paid ${formatPHP(f.paid)}`
                  : ` · Balance ${formatPHP(f.balanceDue)}`}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={handleEmail}
          disabled={!receipt || loading}
          className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Mail className="h-4 w-4" />
          Email receipt
        </button>
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
            <p className="text-lg font-bold text-slate-800">{receiptPropertyName}</p>
            <p className="text-xs tracking-[0.2em] text-slate-500">
              {savedProfile.tagline || receipt.hotel.tagline}
            </p>
            {receiptAddress && <p className="mt-2 text-xs text-slate-500">{receiptAddress}</p>}
            {receiptPhone && <p className="text-xs text-slate-500">Phone: {receiptPhone}</p>}
            {receiptEmail && <p className="text-xs text-slate-500">Email: {receiptEmail}</p>}
            {receiptWebsite && <p className="text-xs text-slate-500">{receiptWebsite}</p>}
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
            {receipt.paid < receipt.total && (
              <div className="flex justify-between font-semibold text-room-occupied">
                <span>Balance Due</span>
                <span>{formatPHP(receipt.total - receipt.paid)}</span>
              </div>
            )}
            {receipt.paymentMethod && (
              <div className="flex justify-between text-xs text-slate-400">
                <span>Payment</span>
                <span>{receipt.paymentMethod.replace("_", " ")}</span>
              </div>
            )}
            {receipt.staffLines.map((line) => (
              <p key={line} className="text-xs text-slate-500">
                {line}
              </p>
            ))}
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            {receiptFooter}
          </p>
        </div>
      )}
    </div>
  );
}
