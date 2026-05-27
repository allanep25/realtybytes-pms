"use client";

import {
  CHARGE_PRESETS,
  DISCOUNT_PRESETS,
  calcPresetDiscount,
  type FolioDetail,
  type FolioListItem,
} from "@/lib/billing";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants";
import { formatPHP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";

type BillingWorkspaceProps = {
  folios: FolioListItem[];
  initialFolioId?: string;
  initialFolio?: FolioDetail | null;
};

export function BillingWorkspace({
  folios,
  initialFolioId,
  initialFolio,
}: BillingWorkspaceProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(
    initialFolioId ?? folios[0]?.id ?? "",
  );
  const [folio, setFolio] = useState<FolioDetail | null>(initialFolio ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lineForm, setLineForm] = useState({
    description: "",
    quantity: "1",
    rate: "",
  });
  const [discount, setDiscount] = useState(
    initialFolio ? String(initialFolio.discount) : "",
  );
  const [paymentAmount, setPaymentAmount] = useState(
    initialFolio && initialFolio.balanceDue > 0 ? String(initialFolio.balanceDue) : "",
  );
  const [paymentMethod, setPaymentMethod] = useState(
    initialFolio?.paymentMethod ?? "CASH",
  );

  async function loadFolio(id: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/folios/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load folio");
      setFolio(data);
      setDiscount(String(data.discount));
      setPaymentMethod(data.paymentMethod ?? "CASH");
      setPaymentAmount(data.balanceDue > 0 ? String(data.balanceDue) : "");
      router.push(`/billing?folio=${folio?.folioNumber ?? id}`, { scroll: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  function selectFolio(id: string) {
    setSelectedId(id);
    loadFolio(id);
  }

  async function addLine(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/folios/${selectedId}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: lineForm.description,
          quantity: Number(lineForm.quantity),
          rate: Number(lineForm.rate),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add charge");
      setFolio(data);
      setLineForm({ description: "", quantity: "1", rate: "" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function removeLine(lineId: string) {
    if (!confirm("Remove this charge?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/folios/lines/${lineId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to remove");
      setFolio(data);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function applyDiscount(amount?: number) {
    if (!selectedId) return;
    const nextDiscount = amount ?? (Number(discount) || 0);
    setDiscount(String(nextDiscount));
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/folios/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discount: nextDiscount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setFolio(data);
      setDiscount(String(data.discount));
      setPaymentAmount(data.balanceDue > 0 ? String(data.balanceDue) : "");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  function applyDiscountPreset(preset: (typeof DISCOUNT_PRESETS)[0]) {
    if (!folio) return;
    void applyDiscount(calcPresetDiscount(folio.subtotal, preset));
  }

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;

    const amount = Number(paymentAmount) || 0;
    if (amount <= 0) {
      setError("Enter the payment amount to record");
      return;
    }
    if (!paymentMethod) {
      setError("Select a payment method");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/folios/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentAmount: amount,
          paymentMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setFolio(data);
      setPaymentAmount(data.balanceDue > 0 ? String(data.balanceDue) : "");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  function applyPreset(preset: (typeof CHARGE_PRESETS)[0]) {
    setLineForm({
      description: preset.description,
      quantity: "1",
      rate: String(preset.rate),
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <aside className="lg:col-span-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-800">Open Folios</h3>
        <p className="mb-3 text-xs text-slate-500">
          Active guest bills — checked-in stays and upcoming reservations with a balance.
        </p>
        <ul className="max-h-[520px] space-y-2 overflow-y-auto">
          {folios.length === 0 ? (
            <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
              <p className="font-medium text-slate-800">No open folios right now.</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Folios appear when you create a reservation, check in a guest, or have an upcoming
                booking. Use Check-In / Check-Out or Reservation Calendar to add guests first.
              </p>
            </li>
          ) : (
            folios.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => selectFolio(f.id)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2.5 text-left text-sm transition",
                    selectedId === f.id
                      ? "border-room-occupied bg-room-occupied/10"
                      : "border-slate-200 hover:bg-slate-50",
                  )}
                >
                  <span className="font-mono text-xs text-slate-500">{f.folioNumber}</span>
                  <span className="mt-0.5 block font-medium text-slate-800">{f.guestName}</span>
                  <span className="text-xs text-slate-500">
                    Room {f.roomNumber} · {formatPHP(f.balanceDue)} due
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </aside>

      <div className="lg:col-span-8">
        {loading && !folio && (
          <p className="text-sm text-slate-500">Loading folio…</p>
        )}

        {!folio && !loading && (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
            {folios.length === 0 ? (
              <div className="mx-auto max-w-md space-y-3 text-sm">
                <p className="font-medium text-slate-700">What belongs here</p>
                <p className="text-left text-xs leading-relaxed">
                  Each guest stay gets a <strong>folio</strong> (bill) with room charges, extras
                  (minibar, laundry), deposits, and payments. Select a folio on the left to record
                  payments (Cash, GCash, card), add charges, apply discounts, and see the balance
                  due at check-out.
                </p>
              </div>
            ) : (
              "Select a folio on the left to view charges and record payments."
            )}
          </div>
        )}

        {folio && (
          <div className="space-y-4">
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-room-dirty">
                {error}
              </p>
            )}

            <div className="rounded-xl border border-slate-200 bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-sm text-slate-500">Folio {folio.folioNumber}</p>
                  <h2 className="text-xl font-semibold text-slate-800">{folio.guestName}</h2>
                  <p className="text-sm text-slate-500">Room {folio.roomNumber}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {folio.reservationStatus.replace("_", " ")}
                </span>
              </div>

              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase text-slate-500">
                    <th className="pb-2">Description</th>
                    <th className="pb-2 text-right">Qty</th>
                    <th className="pb-2 text-right">Rate</th>
                    <th className="pb-2 text-right">Amount</th>
                    <th className="pb-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {folio.lines.map((line) => (
                    <tr key={line.id} className="border-b border-slate-50">
                      <td className="py-2">{line.description}</td>
                      <td className="py-2 text-right">{line.quantity}</td>
                      <td className="py-2 text-right">{formatPHP(line.rate)}</td>
                      <td className="py-2 text-right font-medium">{formatPHP(line.amount)}</td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          className="text-xs text-room-dirty hover:underline"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <form onSubmit={addLine} className="mt-4 border-t border-slate-100 pt-4">
                <p className="mb-2 text-xs font-medium text-slate-500">Add charge</p>
                <div className="mb-2 flex flex-wrap gap-1">
                  {CHARGE_PRESETS.map((p) => (
                    <button
                      key={p.description}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className="rounded border border-slate-200 px-2 py-0.5 text-xs hover:bg-slate-50"
                    >
                      {p.description}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-12 gap-2">
                  <input
                    required
                    placeholder="Description"
                    value={lineForm.description}
                    onChange={(e) =>
                      setLineForm((f) => ({ ...f, description: e.target.value }))
                    }
                    className="col-span-6 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    min={1}
                    value={lineForm.quantity}
                    onChange={(e) =>
                      setLineForm((f) => ({ ...f, quantity: e.target.value }))
                    }
                    className="col-span-2 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    required
                    placeholder="Rate"
                    value={lineForm.rate}
                    onChange={(e) => setLineForm((f) => ({ ...f, rate: e.target.value }))}
                    className="col-span-2 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="col-span-2 rounded-lg bg-sidebar text-sm font-medium text-white hover:bg-sidebar-hover disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </form>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-card p-5 shadow-sm">
                <h3 className="mb-3 font-semibold text-slate-800">Summary</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Subtotal</dt>
                    <dd>{formatPHP(folio.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between items-start gap-2">
                    <dt className="text-slate-500">Guest discount</dt>
                    <dd className="flex flex-col items-end gap-2">
                      <div className="flex flex-wrap justify-end gap-1">
                        {DISCOUNT_PRESETS.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => applyDiscountPreset(preset)}
                            disabled={loading || folio.subtotal <= 0}
                            className={cn(
                              "rounded border px-2 py-0.5 text-xs font-medium disabled:opacity-50",
                              preset.label.startsWith("Senior/PWD")
                                ? "border-room-vacant/40 bg-room-vacant/15 text-room-vacant hover:bg-room-vacant/25"
                                : "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100",
                            )}
                          >
                            {preset.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => void applyDiscount(0)}
                          disabled={loading || folio.discount <= 0}
                          className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Clear
                        </button>
                      </div>
                      <p className="max-w-[220px] text-right text-[10px] leading-snug text-slate-400">
                        Senior/PWD 20% — verify valid OSCA or PWD ID before applying.
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={folio.subtotal}
                          step={1}
                          value={discount}
                          onChange={(e) => setDiscount(e.target.value)}
                          className="w-24 rounded border border-slate-200 px-2 py-1 text-right text-sm"
                          aria-label="Discount amount in pesos"
                        />
                        <button
                          type="button"
                          onClick={() => void applyDiscount()}
                          disabled={loading}
                          className="text-xs text-room-occupied hover:underline"
                        >
                          Apply
                        </button>
                      </div>
                    </dd>
                  </div>
                  {folio.discount > 0 && (
                    <div className="flex justify-between text-room-vacant">
                      <dt className="text-slate-500">After discount</dt>
                      <dd className="font-medium">− {formatPHP(folio.discount)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold">
                    <dt>Total</dt>
                    <dd>{formatPHP(folio.total)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Paid</dt>
                    <dd>{formatPHP(folio.paid)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold">
                    <dt>Balance due</dt>
                    <dd
                      className={cn(
                        folio.balanceDue <= 0 ? "text-room-vacant" : "text-room-dirty",
                      )}
                    >
                      {formatPHP(folio.balanceDue)}
                    </dd>
                  </div>
                </dl>
              </div>

              <form
                onSubmit={recordPayment}
                className="rounded-xl border border-slate-200 bg-card p-5 shadow-sm"
              >
                <h3 className="mb-3 font-semibold text-slate-800">Payment</h3>
                <p className="mb-3 text-xs text-slate-500">
                  Choose the method first — the amount appears under that row on Today&apos;s Revenue.
                </p>
                <label className="mb-3 block text-sm">
                  <span className="text-slate-500">Payment method</span>
                  <select
                    value={paymentMethod}
                    onChange={(e) =>
                      setPaymentMethod(
                        e.target.value as "CASH" | "CARD" | "GCASH" | "BANK_TRANSFER",
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  >
                    {PAYMENT_METHOD_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mb-4 block text-sm">
                  <span className="text-slate-500">Amount</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <button
                  type="submit"
                  disabled={loading || folio.balanceDue <= 0}
                  className="w-full rounded-lg bg-room-vacant py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Record Payment
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
