"use client";

import type { ActiveStay, ReservedArrival } from "@/lib/check-in-out";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { CheckInForm } from "./CheckInForm";
import { CheckOutForm } from "./CheckOutForm";
import { ReservedArrivalsPanel } from "./ReservedArrivalsPanel";

type Tab = "check-in" | "check-out";

type CheckInOutTabsProps = {
  activeStays: ActiveStay[];
  reservedArrivals: ReservedArrival[];
};

export function CheckInOutTabs({ activeStays, reservedArrivals }: CheckInOutTabsProps) {
  const [tab, setTab] = useState<Tab>("check-in");

  return (
    <div>
      <div className="mb-6 flex gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setTab("check-in")}
          className={cn(
            "flex-1 rounded-md px-4 py-2 text-sm font-medium transition",
            tab === "check-in"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          Check-In
        </button>
        <button
          type="button"
          onClick={() => setTab("check-out")}
          className={cn(
            "flex-1 rounded-md px-4 py-2 text-sm font-medium transition",
            tab === "check-out"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          Check-Out
          {activeStays.length > 0 && (
            <span className="ml-1.5 rounded-full bg-room-occupied px-1.5 py-0.5 text-xs text-white">
              {activeStays.length}
            </span>
          )}
        </button>
      </div>

      {tab === "check-in" ? (
        <div className="space-y-6">
          <ReservedArrivalsPanel arrivals={reservedArrivals} />
          <CheckInForm />
        </div>
      ) : (
        <CheckOutForm activeStays={activeStays} />
      )}
    </div>
  );
}
