import { DashboardShell } from "@/components/layout/DashboardShell";
import { CheckInOutTabs } from "@/components/check-in/CheckInOutTabs";
import { getActiveStays, getTodayReservedArrivals } from "@/lib/check-in-out";

export default async function CheckInPage() {
  const [activeStays, reservedArrivals] = await Promise.all([
    getActiveStays(),
    getTodayReservedArrivals(),
  ]);

  return (
    <DashboardShell title="Check-In / Check-Out">
      <CheckInOutTabs activeStays={activeStays} reservedArrivals={reservedArrivals} />
    </DashboardShell>
  );
}
