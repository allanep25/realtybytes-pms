import { DashboardShell } from "@/components/layout/DashboardShell";
import { ActivityList } from "@/components/dashboard/ActivityList";
import { CalendarTimeline } from "@/components/calendar/CalendarTimeline";
import { RevenueCard } from "@/components/dashboard/RevenueCard";
import { DashboardStatCards } from "@/components/dashboard/DashboardStatCards";
import { RoomStatusGrid } from "@/components/dashboard/RoomStatusGrid";
import { getDashboardSummary } from "@/lib/dashboard-data";
import {
  getReservationTimeline,
  getTimelineRange,
  serializeTimeline,
  getTodayArrivals,
  getTodayDepartures,
  getTodayRevenue,
} from "@/lib/reservations";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const weekOffset = 0;
  const { start, end } = getTimelineRange(weekOffset);

  const [summary, timeline, revenue, arrivals, departures] = await Promise.all([
    getDashboardSummary(),
    getReservationTimeline(start, end),
    getTodayRevenue(),
    getTodayArrivals(),
    getTodayDepartures(),
  ]);

  return (
    <DashboardShell title="Dashboard">
      {!summary.fromDatabase && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Database not connected. Set <code className="text-xs">DATABASE_URL</code> and run{" "}
          <code className="text-xs">npm run db:deploy</code>.
        </p>
      )}

      {summary.fromDatabase && summary.total === 0 && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          No rooms loaded yet. Run <code className="text-xs">npm run db:seed</code> with{" "}
          <code className="text-xs">SEED_ADMIN_PASSWORD</code> set in your environment.
        </p>
      )}

      <DashboardStatCards
        occupied={summary.occupied}
        vacant={summary.vacant}
        reserved={summary.reserved}
        dirty={summary.dirty}
        total={summary.total}
        rooms={summary.rooms}
      />

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <RoomStatusGrid rooms={summary.rooms} bookable={summary.fromDatabase} />
          <CalendarTimeline
            data={serializeTimeline(timeline, weekOffset)}
            compact
            showNav={false}
            rooms={summary.rooms}
            bookable={summary.fromDatabase}
          />
        </div>

        <div className="space-y-3">
          <RevenueCard revenue={revenue} />
          <ActivityList
            title="Today's Arrivals"
            items={arrivals}
            viewAllHref="/check-in"
            emptyMessage="No arrivals today"
          />
          <ActivityList
            title="Today's Departures"
            items={departures}
            viewAllHref="/check-in"
            emptyMessage="No departures today"
          />
        </div>
      </div>
    </DashboardShell>
  );
}
