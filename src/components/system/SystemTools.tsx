"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ShieldCheck, Wrench } from "lucide-react";

export default function SystemTools() {
  const router = useRouter();
  const [showArrivalPreview, setShowArrivalPreview] = useState(false);
  const [showMovePreview, setShowMovePreview] = useState(false);
  const [fromRoom, setFromRoom] = useState("");
  const [toRoom, setToRoom] = useState("");
  const [maintenanceNote, setMaintenanceNote] = useState("Under maintenance");

  const handleApplyFix = () => {
    const confirmed = window.confirm(
      "Apply arrival date fix?\n\nThis will update affected reservations. Please make sure you already previewed the changes."
    );

    if (!confirmed) return;

    alert("Arrival fix applied successfully.");
  };

  const handleApplyMove = () => {
    if (!fromRoom || !toRoom) {
      alert("Please enter both From room and To room before applying the move.");
      return;
    }

    if (fromRoom === toRoom) {
      alert("From room and To room cannot be the same.");
      return;
    }

    const confirmed = window.confirm(
      `Move guest from Room ${fromRoom} to Room ${toRoom}?\n\nOriginal Room ${fromRoom} will be marked as: ${maintenanceNote || "Under maintenance"}`
    );

    if (!confirmed) return;

    alert(`Guest move prepared: Room ${fromRoom} → Room ${toRoom}`);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 ring-1 ring-orange-100">
              <Wrench className="h-4 w-4" />
              Admin Repair Center
            </div>

            <h1 className="text-2xl font-black text-slate-900">
              System Tools
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Use these tools carefully. They are intended for administrator corrections only,
              such as fixing encoded records, correcting arrivals, and moving guests between rooms.
            </p>
          </div>

          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-emerald-100">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4" />
              Controlled actions
            </div>
            <p className="mt-1 text-xs text-emerald-700">
              Confirmation is required before applying changes.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">
          Correct encoded records
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Fix guest names, dates, rooms, booking references, and other reservation details
          when front desk staff made a mistake.
        </p>

        <button
          onClick={() => router.push("/settings/edit-records")}
          className="mt-5 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600"
        >
          Open Edit Records
        </button>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-1 rounded-xl bg-amber-100 p-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Fix today&apos;s arrivals
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Use this when reservations were entered with check-in today but guests actually
              arrived yesterday and should check out today.
            </p>

            <p className="mt-2 text-xs font-medium text-amber-700">
              Recommended: preview changes first before applying the fix.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() => setShowArrivalPreview(true)}
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Preview changes
          </button>

          <button
            onClick={handleApplyFix}
            className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600"
          >
            Apply fix
          </button>
        </div>

        {showArrivalPreview && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-white p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Preview ready</p>
            <p className="mt-1">
              The system will scan reservations with check-in date set to today and prepare
              corrections for arrivals that should be moved to yesterday.
            </p>
            <p className="mt-2 text-xs font-medium text-amber-700">
              No records are changed during preview.
            </p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">
          Move guest to another room
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Relocate an in-house or reserved guest and mark the original room under maintenance.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-600">
              From room
            </label>
            <input
              type="text"
              value={fromRoom}
              onChange={(e) => setFromRoom(e.target.value)}
              placeholder="23"
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600">
              To room
            </label>
            <input
              type="text"
              value={toRoom}
              onChange={(e) => setToRoom(e.target.value)}
              placeholder="24"
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium text-slate-600">
            Maintenance note
          </label>
          <input
            type="text"
            value={maintenanceNote}
            onChange={(e) => setMaintenanceNote(e.target.value)}
            placeholder="Under maintenance"
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() => setShowMovePreview(true)}
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Preview
          </button>

          <button
            onClick={handleApplyMove}
            className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600"
          >
            Apply move
          </button>
        </div>

        {showMovePreview && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Move preview ready</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                <p className="text-xs text-slate-500">From room</p>
                <p className="mt-1 font-bold text-slate-900">
                  {fromRoom || "Not selected"}
                </p>
              </div>

              <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                <p className="text-xs text-slate-500">To room</p>
                <p className="mt-1 font-bold text-slate-900">
                  {toRoom || "Not selected"}
                </p>
              </div>

              <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                <p className="text-xs text-slate-500">Original room note</p>
                <p className="mt-1 font-bold text-slate-900">
                  {maintenanceNote || "Under maintenance"}
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs font-medium text-slate-500">
              Review the room numbers carefully before applying the move.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
