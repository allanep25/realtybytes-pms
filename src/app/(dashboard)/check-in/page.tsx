import { DashboardShell } from "@/components/layout/DashboardShell";
import { CheckInOutTabs } from "@/components/check-in/CheckInOutTabs";
import { getActiveStays, getTodayReservedArrivals } from "@/lib/check-in-out";
import { Suspense } from "react";

export default async function CheckInPage() {
  const [activeStays, reservedArrivals] = await Promise.all([
    getActiveStays(),
    getTodayReservedArrivals(),
  ]);

  return (
    <DashboardShell title="Check-In / Check-Out">
      <Suspense fallback={<div className="text-sm text-slate-500">Loading check-in desk…</div>}>
        <CheckInOutTabs activeStays={activeStays} reservedArrivals={reservedArrivals} />
      </Suspense>
    </DashboardShell>
  );
}
