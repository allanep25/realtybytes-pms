"use client";

import { GuestIdCapture } from "@/components/guests/GuestIdCapture";
import { formatDate, formatPHP } from "@/lib/format";
import type { ReservedArrival } from "@/lib/check-in-out";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ReservedArrivalsPanelProps = {
  arrivals: ReservedArrival[];
  /** Guard desk: payment optional; guest may settle at check-out. */
  variant?: "front-desk" | "guard";
};

const ID_TYPES = ["Passport", "Driver License", "National ID", "Other"];

export function ReservedArrivalsPanel({
  arrivals,
  variant = "front-desk",
}: ReservedArrivalsPanelProps) {
  const isGuard = variant === "guard";
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forms, setForms] = useState<
    Record<
      string,
      {
        contactNumber: string;
        idType: string;
        idNumber: string;
        idPhotoFileName: string;
        address: string;
        paymentAmount: string;
        paymentMethod: string;
      }
    >
  >({});

  function getForm(arrival: ReservedArrival) {
    return (
      forms[arrival.reservationId] ?? {
        contactNumber: arrival.contactNumber ?? "",
        idType: arrival.idType ?? "",
        idNumber: arrival.idNumber ?? "",
        idPhotoFileName: "",
        address: arrival.address ?? "",
        paymentAmount:
          !isGuard && arrival.balanceDue > 0 ? String(arrival.balanceDue) : "",
        paymentMethod: "CASH",
      }
    );
  }

  function updateForm(reservationId: string, patch: Partial<ReturnType<typeof getForm>>) {
    const arrival = arrivals.find((a) => a.reservationId === reservationId);
    if (!arrival) return;
    setForms((prev) => ({
      ...prev,
      [reservationId]: { ...getForm(arrival), ...patch },
    }));
  }

  async function checkIn(arrival: ReservedArrival) {
    const form = getForm(arrival);

    if (!form.idType.trim() && !arrival.idType?.trim()) {
      setError(`ID type is required for ${arrival.guestName} before check-in`);
      return;
    }

    setCheckingInId(arrival.reservationId);
    setError(null);

    try {
      const res = await fetch(`/api/reservations/${arrival.reservationId}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactNumber: form.contactNumber || undefined,
          idType: form.idType || undefined,
          idNumber: form.idNumber || undefined,
          idPhotoFileName: form.idPhotoFileName || undefined,
          address: form.address || undefined,
          paymentAmount: Number(form.paymentAmount) || undefined,
          paymentMethod: Number(form.paymentAmount) > 0 ? form.paymentMethod : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Check-in failed");
      setExpandedId(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setCheckingInId(null);
    }
  }

  if (arrivals.length === 0) {
    if (!isGuard) return null;
    return (
      <section className="rounded-xl border border-room-reserved/40 bg-amber-50/50 p-5 shadow-sm">
        <h3 className="font-semibold text-slate-800">Expected Arrivals Tonight</h3>
        <p className="mt-1 text-sm text-slate-500">No reserved guests arriving today.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-room-reserved/40 bg-amber-50/50 p-5 shadow-sm">
      <h3 className="font-semibold text-slate-800">
        {isGuard ? "Expected Arrivals Tonight" : "Expected Arrivals Today"}
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        {isGuard
          ? "Guests with an existing booking. Verify ID and admit. Payment is not required — record an amount only if the guest chooses to pay now."
          : "Collect ID for the guest named on the booking before check-in."}
      </p>

      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-room-dirty">
          {error}
        </p>
      )}

      <ul className="mt-4 divide-y divide-amber-100/80">
        {arrivals.map((a) => {
          const expanded = expandedId === a.reservationId;
          const form = getForm(a);
          return (
            <li key={a.reservationId} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-800">
                    {a.guestName}
                    {a.isVip && (
                      <span className="ml-2 rounded-full bg-room-occupied px-2 py-0.5 text-xs font-semibold text-white">
                        VIP
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-slate-500">
                    Room {a.roomNumber} · {a.roomDescription} · out {formatDate(a.checkOut)}
                  </p>
                  <p className="mt-1 text-sm">
                    <span className="text-slate-500">Total {formatPHP(a.total)}</span>
                    {a.paid > 0 && (
                      <span className="text-room-vacant"> · Deposit {formatPHP(a.paid)}</span>
                    )}
                    <span
                      className={cn(
                        a.balanceDue > 0 ? " font-semibold text-room-occupied" : " text-room-vacant",
                      )}
                    >
                      {" "}
                      · Balance {formatPHP(a.balanceDue)}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : a.reservationId)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {expanded ? "Hide" : "Check in guest"}
                </button>
              </div>

              {expanded && (
                <div className="mt-4 space-y-3 rounded-lg border border-amber-100 bg-white p-4">
                  <p className="text-sm font-medium text-slate-800">
                    ID for {a.guestName} *
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm">
                      <span className="text-slate-500">ID type *</span>
                      <select
                        required
                        value={form.idType}
                        onChange={(e) => updateForm(a.reservationId, { idType: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        <option value="">Select ID type…</option>
                        {ID_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm">
                      <span className="text-slate-500">ID number</span>
                      <input
                        value={form.idNumber}
                        onChange={(e) => updateForm(a.reservationId, { idNumber: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                  {!isGuard && (
                    <GuestIdCapture
                      guestName={a.guestName}
                      savedFileName={form.idPhotoFileName || null}
                      onSaved={(fileName) =>
                        updateForm(a.reservationId, { idPhotoFileName: fileName })
                      }
                      onClear={() => updateForm(a.reservationId, { idPhotoFileName: "" })}
                      disabled={checkingInId === a.reservationId}
                    />
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm sm:col-span-2">
                      <span className="text-slate-500">Contact</span>
                      <input
                        value={form.contactNumber}
                        onChange={(e) =>
                          updateForm(a.reservationId, { contactNumber: e.target.value })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-sm sm:col-span-2">
                      <span className="text-slate-500">Address</span>
                      <input
                        value={form.address}
                        onChange={(e) => updateForm(a.reservationId, { address: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                    </label>
                    {a.balanceDue > 0 && (
                      <>
                        <div className="sm:col-span-2">
                          <p className="text-sm text-slate-600">
                            Balance due:{" "}
                            <span className="font-semibold text-room-occupied">
                              {formatPHP(a.balanceDue)}
                            </span>
                            {isGuard && (
                              <span className="text-slate-500">
                                {" "}
                                — payment not required; leave blank if guest pays at check-out
                              </span>
                            )}
                          </p>
                        </div>
                        <label className="text-sm">
                          <span className="text-slate-500">
                            Amount guest pays now{isGuard ? " (optional)" : ""}
                          </span>
                          <input
                            type="number"
                            min="0"
                            max={a.balanceDue}
                            step="0.01"
                            value={form.paymentAmount}
                            onChange={(e) =>
                              updateForm(a.reservationId, { paymentAmount: e.target.value })
                            }
                            placeholder={isGuard ? "0 — pay at check-out" : undefined}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="text-sm">
                          <span className="text-slate-500">Payment method</span>
                          <select
                            value={form.paymentMethod}
                            onChange={(e) =>
                              updateForm(a.reservationId, { paymentMethod: e.target.value })
                            }
                            disabled={!form.paymentAmount || Number(form.paymentAmount) <= 0}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                          >
                            {PAYMENT_METHOD_OPTIONS.map((m) => (
                              <option key={m.value} value={m.value}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void checkIn(a)}
                    disabled={checkingInId === a.reservationId}
                    className="rounded-lg bg-room-vacant px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {checkingInId === a.reservationId ? "Checking in…" : "Complete check-in"}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
