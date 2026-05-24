import { DashboardShell } from "@/components/layout/DashboardShell";
import { RoomManagement } from "@/components/rooms/RoomManagement";
import { getRooms } from "@/lib/rooms";
import type { RoomStatus, RoomType } from "@prisma/client";

type PageProps = {
  searchParams: Promise<{
    status?: string;
    type?: string;
    floor?: string;
  }>;
};

export default async function RoomsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const rooms = await getRooms({
    status: params.status as RoomStatus | undefined,
    type: params.type as RoomType | undefined,
    floor: params.floor ? Number(params.floor) : undefined,
  });

  return (
    <DashboardShell title="Room Management">
      <p className="mb-4 text-sm text-slate-500">
        {rooms.length} room{rooms.length !== 1 ? "s" : ""} — floors 2 (21–28) and 3 (31–38).
        Click Edit to update status, type, or rate.
      </p>
      <RoomManagement
        rooms={rooms}
        initialStatus={params.status ?? ""}
        initialType={params.type ?? ""}
        initialFloor={params.floor ?? ""}
      />
    </DashboardShell>
  );
}
