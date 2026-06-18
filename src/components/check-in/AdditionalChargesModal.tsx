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

type ChargeItem = {
  key: string;
  description: string;
  selected: boolean;
  quantity: number;
  rate: number;
};

const DEFAULT_ITEMS: ChargeItem[] = [
  { key: "extra-bed", description: "Extra Bed", selected: false, quantity: 1, rate: 500 },
  { key: "food", description: "Food", selected: false, quantity: 1, rate: 0 },
  { key: "late-checkout", description: "Late Checkout", selected: false, quantity: 1, rate: 500 },
];

export function AdditionalChargesModal({
  open,
  folioId,
  guestName,
  onClose,
  onSuccess,
}: AdditionalChargesModalProps) {
  const [items, setItems] = useState<ChargeItem[]>(DEFAULT_ITEMS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function update(key: string, patch: Partial<ChargeItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function resetAndClose() {
    setItems(DEFAULT_ITEMS);
    setError(null);
    onClose();
  }

  const selectedItems = items.filter((it) => it.selected);
  const total = selectedItems.reduce(
    (sum, it) => sum + Math.max(1, it.quantity) * Math.max(0, it.rate),
    0,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (selectedItems.length === 0) {
      setError("Select at least one charge to add.");
      return;
    }
    if (selectedItems.some((it) => it.rate <= 0)) {
      setError("Enter a price greater than 0 for each selected charge.");
      return;
    }

    setSaving(true);
    try {
      for (const it of selectedItems) {
        const res = await fetch(`/api/folios/${folioId}/lines`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: it.description,
            quantity: Math.max(1, it.quantity),
            rate: Math.max(0, it.rate),
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? `Failed to add ${it.description}`);
        }
      }
      onSuccess();
      resetAndClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add charges");
    } finally {
      setSaving(false);
    }
  }

  const numberClass =
    "w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-room-occupied focus:outline-none focus:ring-1 focus:ring-room-occupied disabled:bg-slate-50 disabled:text-slate-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
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
          Add charges to {guestName}&apos;s bill before check-out.
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
                <span className="text-sm font-medium text-slate-800">{it.description}</span>
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
          </ul>

          <div className="flex justify-between border-t border-slate-100 pt-3 text-sm font-semibold text-slate-800">
            <span>Total to add</span>
            <span>{formatPHP(total)}</span>
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
              disabled={saving || selectedItems.length === 0}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium text-white",
                "bg-room-occupied hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {saving ? "Adding…" : `Add to bill (${formatPHP(total)})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
