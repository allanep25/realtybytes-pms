import { DashboardShell } from "@/components/layout/DashboardShell";
import { CalendarTimeline } from "@/components/calendar/CalendarTimeline";
import {
  getReservationTimeline,
  getTimelineRange,
  serializeTimeline,
} from "@/lib/reservations";
import { getRooms, toRoomGridItem } from "@/lib/rooms";

type PageProps = {
  searchParams: Promise<{ month?: string; week?: string }>;
};

export default async function CalendarPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const monthOffset = Number(params.month ?? params.week ?? 0) || 0;
  const { start, end } = getTimelineRange(monthOffset);

  const [timeline, roomList] = await Promise.all([
    getReservationTimeline(start, end),
    getRooms(),
  ]);

  const data = serializeTimeline(timeline, monthOffset);
  const rooms = roomList.map(toRoomGridItem);

  return (
    <DashboardShell title="Reservation Calendar">
      <CalendarTimeline data={data} rooms={rooms} bookable />
    </DashboardShell>
  );
}
