import type { RoomGridItem } from "@/components/dashboard/RoomStatusGrid";

/** Room is dirty or actively being cleaned — not ready for walk-in / today check-in. */
export function roomNeedsCleaningBeforeUse(room: {
  status: RoomGridItem["status"];
  housekeepingStatus?: RoomGridItem["housekeepingStatus"];
}): boolean {
  return (
    room.status === "DIRTY" ||
    room.housekeepingStatus === "DIRTY" ||
    room.housekeepingStatus === "CLEANING"
  );
}
