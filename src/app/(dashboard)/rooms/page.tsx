import { DashboardShell } from "@/components/layout/DashboardShell";
import { RoomManagement } from "@/components/rooms/RoomManagement";
import { getSession } from "@/lib/auth";
import { isAdministrator } from "@/lib/permissions";
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
  const session = await getSession();
  const canManageRooms = session ? isAdministrator(session.role) : false;

  const rooms = await getRooms({
    status: params.status as RoomStatus | undefined,
    type: params.type as RoomType | undefined,
    floor: params.floor ? Number(params.floor) : undefined,
  });

  return (
    <DashboardShell title="Room Management">
      <p className="mb-4 text-sm text-slate-500">
        {rooms.length} room{rooms.length !== 1 ? "s" : ""} on floors 2 and 3.
        {canManageRooms
          ? " Use Add Room to create more rooms, Edit to update details, or Delete for unused rooms."
          : " Room details are read-only for your account."}
      </p>
      <RoomManagement
        rooms={rooms}
        initialStatus={params.status ?? ""}
        initialType={params.type ?? ""}
        initialFloor={params.floor ?? ""}
        canManageRooms={canManageRooms}
      />
    </DashboardShell>
  );
}
