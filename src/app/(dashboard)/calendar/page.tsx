import { CalendarMonthGrid } from "@/components/calendar/CalendarMonthGrid";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { getMonthCalendarGrid } from "@/lib/reservations";
import { getRooms, toRoomGridItem } from "@/lib/rooms";

type PageProps = {
  searchParams: Promise<{ month?: string; week?: string }>;
};

export default async function CalendarPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const monthOffset = Number(params.month ?? params.week ?? 0) || 0;

  const [grid, roomList] = await Promise.all([
    getMonthCalendarGrid(monthOffset),
    getRooms(),
  ]);

  const rooms = roomList.map(toRoomGridItem);

  return (
    <DashboardShell title="Reservation Calendar">
      <CalendarMonthGrid data={grid} rooms={rooms} bookable />
    </DashboardShell>
  );
}
