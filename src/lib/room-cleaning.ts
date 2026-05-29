import type { RoomGridItem } from "@/components/dashboard/RoomStatusGrid";

/** Matches the blue “needs cleaning” color on the dashboard room grid. */
export function roomGridShowsCleaningColor(room: {
  status: RoomGridItem["status"];
  housekeepingStatus?: RoomGridItem["housekeepingStatus"];
}): boolean {
  if (room.status === "OUT_OF_ORDER" || room.housekeepingStatus === "OUT_OF_ORDER") {
    return false;
  }
  return (
    room.status === "DIRTY" ||
    room.housekeepingStatus === "DIRTY" ||
    room.housekeepingStatus === "CLEANING"
  );
}
