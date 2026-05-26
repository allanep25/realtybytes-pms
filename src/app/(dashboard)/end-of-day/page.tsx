import { DayCloseWorkspace } from "@/components/end-of-day/DayCloseWorkspace";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { getDayCloseSummary } from "@/lib/day-close";
import { hotelCalendarDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function EndOfDayPage() {
  const today = hotelCalendarDate();
  const summary = await getDayCloseSummary(today);

  return (
    <DashboardShell title="End of Day">
      <DayCloseWorkspace initialDate={today} initialSummary={summary} />
    </DashboardShell>
  );
}
