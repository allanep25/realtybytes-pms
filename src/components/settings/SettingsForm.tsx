"use client";

import type { HotelSettingsData } from "@/lib/settings";
import { useRouter } from "next/navigation";
import { useState } from "react";

type SettingsFormProps = {
  settings: HotelSettingsData;
};

export function SettingsForm({ settings: initial }: SettingsFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: initial.name,
    tagline: initial.tagline,
    address: initial.address ?? "",
    phone: initial.phone ?? "",
    email: initial.email ?? "",
    taxRate: String(initial.taxRate),
    currencyCode: initial.currencyCode,
    receiptFooter: initial.receiptFooter ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          tagline: form.tagline,
          address: form.address || null,
          phone: form.phone || null,
          email: form.email || null,
          taxRate: Number(form.taxRate),
          currencyCode: form.currencyCode,
          receiptFooter: form.receiptFooter || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setMessage("Settings saved successfully.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const fieldClass =
    "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-room-occupied focus:outline-none focus:ring-1 focus:ring-room-occupied";

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {message && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-room-vacant">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-room-dirty">
          {error}
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-card p-5 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-800">Hotel Branding</h3>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="text-slate-500">Hotel Name</span>
            <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={fieldClass} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">Tagline</span>
            <input value={form.tagline} onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))} className={fieldClass} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">Address</span>
            <textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} rows={2} className={fieldClass} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-slate-500">Phone</span>
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={fieldClass} />
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">Email</span>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={fieldClass} />
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-card p-5 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-800">Billing & Receipts</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-slate-500">Tax Rate (decimal)</span>
              <input
                type="number"
                step={0.01}
                min={0}
                max={1}
                value={form.taxRate}
                onChange={(e) => setForm((f) => ({ ...f, taxRate: e.target.value }))}
                className={fieldClass}
              />
              <span className="mt-1 block text-xs text-slate-400">0.12 = 12% VAT</span>
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">Currency</span>
              <input value={form.currencyCode} onChange={(e) => setForm((f) => ({ ...f, currencyCode: e.target.value }))} className={fieldClass} />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-slate-500">Receipt Footer</span>
            <textarea
              value={form.receiptFooter}
              onChange={(e) => setForm((f) => ({ ...f, receiptFooter: e.target.value }))}
              rows={2}
              placeholder="Thank you for staying with us!"
              className={fieldClass}
            />
          </label>
        </div>
      </section>

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-room-vacant px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Settings"}
      </button>
    </form>
  );
}
