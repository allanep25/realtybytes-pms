"use client";

import { RESERVATION_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { GuestProfile } from "@/lib/guests";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Star } from "lucide-react";

const ID_TYPES = ["Passport", "Driver License", "National ID", "Other"];

type GuestProfileCardProps = {
  guest: GuestProfile;
  canEdit?: boolean;
};

export function GuestProfileCard({ guest: initial, canEdit = false }: GuestProfileCardProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [guest, setGuest] = useState(initial);
  const [form, setForm] = useState({
    fullName: initial.fullName,
    contactNumber: initial.contactNumber ?? "",
    idType: initial.idType ?? "Passport",
    idNumber: initial.idNumber ?? "",
    address: initial.address ?? "",
    isVip: initial.isVip,
    notes: initial.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveProfile() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/guests/${guest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          contactNumber: form.contactNumber || null,
          idType: form.idType || null,
          idNumber: form.idNumber || null,
          address: form.address || null,
          isVip: form.isVip,
          notes: form.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setGuest(data);
      setEditing(false);
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
    <div className="space-y-6">
      <Link
        href="/guests"
        className="inline-flex items-center gap-1 text-sm text-room-occupied hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to guests
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-card p-6 shadow-sm lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sidebar text-2xl font-bold text-white">
              {guest.fullName.charAt(0)}
            </div>
            <h2 className="mt-3 text-xl font-semibold text-slate-800">{guest.fullName}</h2>
            {guest.isVip && (
              <span className="mt-2 flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
                <Star className="h-4 w-4 fill-current" />
                VIP Guest
              </span>
            )}
            {!editing && canEdit && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="mt-4 text-sm text-room-occupied hover:underline"
              >
                Edit Profile
              </button>
            )}
            {!editing && !canEdit && (
              <p className="mt-4 text-xs text-slate-400">
                Profile edits are limited to administrators. Use Edit Records in Settings.
              </p>
            )}
          </div>

          {editing ? (
            <div className="mt-6 space-y-3 text-left">
              <label className="block text-sm">
                <span className="text-slate-500">Full Name</span>
                <input
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-500">Contact</span>
                <input
                  value={form.contactNumber}
                  onChange={(e) => setForm((f) => ({ ...f, contactNumber: e.target.value }))}
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-500">ID Type</span>
                <select
                  value={form.idType}
                  onChange={(e) => setForm((f) => ({ ...f, idType: e.target.value }))}
                  className={fieldClass}
                >
                  {ID_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-slate-500">ID Number</span>
                <input
                  value={form.idNumber}
                  onChange={(e) => setForm((f) => ({ ...f, idNumber: e.target.value }))}
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-500">Address</span>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  rows={2}
                  className={fieldClass}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isVip}
                  onChange={(e) => setForm((f) => ({ ...f, isVip: e.target.checked }))}
                />
                VIP Guest
              </label>
              <label className="block text-sm">
                <span className="text-slate-500">Notes</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className={fieldClass}
                  placeholder="e.g. Prefers quiet rooms"
                />
              </label>
              {error && <p className="text-sm text-room-dirty">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="flex-1 rounded-lg border border-slate-200 py-2 text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={saving}
                  className="flex-1 rounded-lg bg-room-vacant py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <dl className="mt-6 space-y-3 text-left text-sm">
              {guest.contactNumber && (
                <div>
                  <dt className="text-slate-500">Contact</dt>
                  <dd className="font-medium text-slate-800">{guest.contactNumber}</dd>
                </div>
              )}
              {guest.address && (
                <div>
                  <dt className="text-slate-500">Address</dt>
                  <dd className="text-slate-800">{guest.address}</dd>
                </div>
              )}
              {(guest.idType || guest.idNumber) && (
                <div>
                  <dt className="text-slate-500">ID</dt>
                  <dd className="text-slate-800">
                    {guest.idType}
                    {guest.idNumber ? ` — ${guest.idNumber}` : ""}
                  </dd>
                </div>
              )}
              {guest.notes && (
                <div>
                  <dt className="text-slate-500">Notes</dt>
                  <dd className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700">{guest.notes}</dd>
                </div>
              )}
            </dl>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-card p-6 shadow-sm lg:col-span-2">
          <h3 className="mb-4 font-semibold text-slate-800">Stay History</h3>
          {guest.stayHistory.length === 0 ? (
            <p className="text-sm text-slate-400">No stays recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase text-slate-500">
                    <th className="pb-2 pr-4">Check-in</th>
                    <th className="pb-2 pr-4">Check-out</th>
                    <th className="pb-2 pr-4">Room</th>
                    <th className="pb-2 pr-4">Nights</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {guest.stayHistory.map((stay) => (
                    <tr key={stay.id} className="border-b border-slate-50">
                      <td className="py-3 pr-4">{formatDate(stay.checkIn)}</td>
                      <td className="py-3 pr-4">{formatDate(stay.checkOut)}</td>
                      <td className="py-3 pr-4 font-medium">{stay.roomNumber}</td>
                      <td className="py-3 pr-4">{stay.nights}</td>
                      <td className="py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                          {RESERVATION_STATUS_LABELS[stay.status] ?? stay.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
