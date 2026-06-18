"use client";

import { formatPHP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useState } from "react";

type AdditionalChargesModalProps = {
  open: boolean;
  folioId: string;
  guestName: string;
  onClose: () => void;
  onSuccess: () => void;
};

type QtyItem = {
  key: string;
  description: string;
  hint?: string;
  selected: boolean;
  quantity: number;
  rate: number;
  qtyLabel: string;
};

const DEFAULT_QTY_ITEMS: QtyItem[] = [
  { key: "extra-bed", description: "Extra Bed", selected: false, quantity: 1, rate: 500, qtyLabel: "Qty" },
  { key: "food", description: "Food and drinks", selected: false, quantity: 1, rate: 0, qtyLabel: "Qty" },
  {
    key: "late-checkout",
    description: "Late Checkout",
    hint: "₱150 / hour",
    selected: false,
    quantity: 1,
    rate: 150,
    qtyLabel: "Hours",
  },
  {
    key: "early-checkin",
    description: "Early Check-in",
    hint: "₱150 / hour",
    selected: false,
    quantity: 1,
    rate: 150,
    qtyLabel: "Hours",
  },
];

export function AdditionalChargesModal({
  open,
  folioId,
  guestName,
  onClose,
  onSuccess,
}: AdditionalChargesModalProps) {
  const [items, setItems] = useState<QtyItem[]>(DEFAULT_QTY_ITEMS);
  const [penaltyOn, setPenaltyOn] = useState(false);
  const [penaltyDesc, setPenaltyDesc] = useState("");
  const [penaltyAmount, setPenaltyAmount] = useState(0);
  const [discountOn, setDiscountOn] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function update(key: string, patch: Partial<QtyItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function reset() {
    setItems(DEFAULT_QTY_ITEMS);
    setPenaltyOn(false);
    setPenaltyDesc("");
    setPenaltyAmount(0);
    setDiscountOn(false);
    setDiscountAmount(0);
    setError(null);
  }

  function resetAndClose() {
    reset();
    onClose();
  }

  const selectedItems = items.filter((it) => it.selected);
  const chargesTotal =
    selectedItems.reduce((sum, it) => sum + Math.max(1, it.quantity) * Math.max(0, it.rate), 0) +
    (penaltyOn ? Math.max(0, penaltyAmount) : 0);
  const netTotal = chargesTotal - (discountOn ? Math.max(0, discountAmount) : 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const hasCharge = selectedItems.length > 0 || (penaltyOn && penaltyAmount > 0);
    const hasDiscount = discountOn && discountAmount > 0;
    if (!hasCharge && !hasDiscount) {
      setError("Select at least one charge or a discount to apply.");
      return;
    }
    if (selectedItems.some((it) => it.rate <= 0)) {
      setError("Enter a price greater than 0 for each selected charge.");
      return;
    }
    if (penaltyOn && penaltyAmount <= 0) {
      setError("Enter an amount for the penalty/other charge.");
      return;
    }

    setSaving(true);
    try {
      for (const it of selectedItems) {
        await postLine(it.description, Math.max(1, it.quantity), Math.max(0, it.rate));
      }
      if (penaltyOn && penaltyAmount > 0) {
        await postLine(penaltyDesc.trim() || "Penalty and others", 1, Math.max(0, penaltyAmount));
      }
      if (hasDiscount) {
        const current = await fetchFolioDiscount(folioId);
        const res = await fetch(`/api/folios/${folioId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ discount: current + Math.max(0, discountAmount) }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to apply discount");
        }
      }
      onSuccess();
      resetAndClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update bill");
    } finally {
      setSaving(false);
    }
  }

  async function postLine(description: string, quantity: number, rate: number) {
    const res = await fetch(`/api/folios/${folioId}/lines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, quantity, rate }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? `Failed to add ${description}`);
    }
  }

  const numberClass =
    "w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-room-occupied focus:outline-none focus:ring-1 focus:ring-room-occupied disabled:bg-slate-50 disabled:text-slate-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">Additional Charges</h3>
          <button
            type="button"
            onClick={resetAndClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Adjust {guestName}&apos;s bill before check-out.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-room-dirty">
              {error}
            </p>
          )}

          <div className="grid grid-cols-[auto_1fr_4rem_6rem] items-center gap-2 px-1 text-xs font-medium uppercase text-slate-400">
            <span />
            <span>Item</span>
            <span className="text-center">Qty</span>
            <span className="text-right">Price</span>
          </div>

          <ul className="space-y-2">
            {items.map((it) => (
              <li
                key={it.key}
                className={cn(
                  "grid grid-cols-[auto_1fr_4rem_6rem] items-center gap-2 rounded-lg border px-3 py-2",
                  it.selected ? "border-room-occupied bg-room-occupied/5" : "border-slate-100",
                )}
              >
                <input
                  type="checkbox"
                  checked={it.selected}
                  onChange={(e) => update(it.key, { selected: e.target.checked })}
                  className="h-4 w-4 accent-room-occupied"
                  aria-label={`Add ${it.description}`}
                />
                <div>
                  <span className="text-sm font-medium text-slate-800">{it.description}</span>
                  {it.hint && <span className="block text-xs text-slate-400">{it.hint}</span>}
                  <span className="block text-[10px] uppercase text-slate-300">{it.qtyLabel}</span>
                </div>
                <input
                  type="number"
                  min={1}
                  value={it.quantity}
                  disabled={!it.selected}
                  onChange={(e) => update(it.key, { quantity: Number(e.target.value) })}
                  className={cn(numberClass, "text-center")}
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={it.rate}
                  disabled={!it.selected}
                  onChange={(e) => update(it.key, { rate: Number(e.target.value) })}
                  className={cn(numberClass, "text-right")}
                />
              </li>
            ))}

            <li
              className={cn(
                "rounded-lg border px-3 py-2",
                penaltyOn ? "border-room-occupied bg-room-occupied/5" : "border-slate-100",
              )}
            >
              <div className="grid grid-cols-[auto_1fr_6rem] items-center gap-2">
                <input
                  type="checkbox"
                  checked={penaltyOn}
                  onChange={(e) => setPenaltyOn(e.target.checked)}
                  className="h-4 w-4 accent-room-occupied"
                  aria-label="Add penalty and others"
                />
                <span className="text-sm font-medium text-slate-800">Penalty and others</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={penaltyAmount}
                  disabled={!penaltyOn}
                  onChange={(e) => setPenaltyAmount(Number(e.target.value))}
                  className={cn(numberClass, "text-right")}
                  placeholder="Amount"
                />
              </div>
              {penaltyOn && (
                <input
                  type="text"
                  value={penaltyDesc}
                  onChange={(e) => setPenaltyDesc(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-room-occupied focus:outline-none focus:ring-1 focus:ring-room-occupied"
                  placeholder="Describe the penalty / other charge"
                />
              )}
            </li>

            <li
              className={cn(
                "grid grid-cols-[auto_1fr_6rem] items-center gap-2 rounded-lg border px-3 py-2",
                discountOn ? "border-room-vacant bg-room-vacant/5" : "border-slate-100",
              )}
            >
              <input
                type="checkbox"
                checked={discountOn}
                onChange={(e) => setDiscountOn(e.target.checked)}
                className="h-4 w-4 accent-room-vacant"
                aria-label="Apply discount and adjustment"
              />
              <div>
                <span className="text-sm font-medium text-slate-800">Discount and adjustment</span>
                <span className="block text-xs text-slate-400">Deducted from total</span>
              </div>
              <input
                type="number"
                min={0}
                step="0.01"
                value={discountAmount}
                disabled={!discountOn}
                onChange={(e) => setDiscountAmount(Number(e.target.value))}
                className={cn(numberClass, "text-right")}
                placeholder="Amount"
              />
            </li>
          </ul>

          <div className="space-y-1 border-t border-slate-100 pt-3 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Charges</span>
              <span>{formatPHP(chargesTotal)}</span>
            </div>
            {discountOn && discountAmount > 0 && (
              <div className="flex justify-between text-room-vacant">
                <span>Discount</span>
                <span>− {formatPHP(Math.max(0, discountAmount))}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-slate-800">
              <span>Net change to bill</span>
              <span>{formatPHP(netTotal)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={resetAndClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium text-white",
                "bg-room-occupied hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {saving ? "Updating…" : "Apply to bill"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

async function fetchFolioDiscount(folioId: string): Promise<number> {
  const res = await fetch(`/api/folios/${folioId}`);
  if (!res.ok) return 0;
  const folio = await res.json();
  return Number(folio?.discount ?? 0);
}
