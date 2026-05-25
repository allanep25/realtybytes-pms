import { DashboardShell } from "@/components/layout/DashboardShell";
import { ActivityList } from "@/components/dashboard/ActivityList";
import { CalendarTimeline } from "@/components/calendar/CalendarTimeline";
import { RevenueCard } from "@/components/dashboard/RevenueCard";
import { RoomStatusGrid } from "@/components/dashboard/RoomStatusGrid";
import { StatCard } from "@/components/dashboard/StatCard";
import { getDashboardSummary, percent } from "@/lib/dashboard-data";
import {
  getReservationTimeline,
  getTimelineRange,
  serializeTimeline,
  getTodayArrivals,
  getTodayDepartures,
  getTodayRevenue,
} from "@/lib/reservations";

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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Occupied Rooms"
          count={summary.occupied}
          subtitle={percent(summary.occupied, summary.total)}
          variant="occupied"
        />
        <StatCard
          label="Vacant Rooms"
          count={summary.vacant}
          subtitle={percent(summary.vacant, summary.total)}
          variant="vacant"
        />
        <StatCard
          label="Reserved Rooms"
          count={summary.reserved}
          subtitle={percent(summary.reserved, summary.total)}
          variant="reserved"
        />
        <StatCard
          label="Dirty Rooms"
          count={summary.dirty}
          subtitle="Needs Cleaning"
          variant="dirty"
        />
      </div>

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
