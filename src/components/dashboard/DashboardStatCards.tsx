"use client";

import type { DashboardStatFilter } from "@/lib/dashboard-data";
import { percent, roomMatchesDashboardFilter } from "@/lib/dashboard-data";
import type { RoomGridItem } from "@/components/dashboard/RoomStatusGrid";
import { RoomStatModal } from "@/components/dashboard/RoomStatModal";
import { StatCard } from "@/components/dashboard/StatCard";
import { useState } from "react";

type DashboardStatCardsProps = {
  occupied: number;
  vacant: number;
  reserved: number;
  dirty: number;
  total: number;
  rooms: RoomGridItem[];
};

const FILTER_LABELS: Record<DashboardStatFilter, string> = {
  occupied: "Occupied Rooms",
  vacant: "Vacant Rooms",
  reserved: "Reserved Rooms",
  dirty: "Dirty Rooms",
};

export function DashboardStatCards({
  occupied,
  vacant,
  reserved,
  dirty,
  total,
  rooms,
}: DashboardStatCardsProps) {
  const [filter, setFilter] = useState<DashboardStatFilter | null>(null);

  const filteredRooms = filter ? rooms.filter((room) => roomMatchesDashboardFilter(room, filter)) : [];

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Occupied Rooms"
          count={occupied}
          subtitle={percent(occupied, total)}
          variant="occupied"
          onClick={() => setFilter("occupied")}
          active={filter === "occupied"}
        />
        <StatCard
          label="Vacant Rooms"
          count={vacant}
          subtitle={percent(vacant, total)}
          variant="vacant"
          onClick={() => setFilter("vacant")}
          active={filter === "vacant"}
        />
        <StatCard
          label="Reserved Rooms"
          count={reserved}
          subtitle={percent(reserved, total)}
          variant="reserved"
          onClick={() => setFilter("reserved")}
          active={filter === "reserved"}
        />
        <StatCard
          label="Dirty Rooms"
          count={dirty}
          subtitle="Needs Cleaning"
          variant="dirty"
          onClick={() => setFilter("dirty")}
          active={filter === "dirty"}
        />
      </div>

      <RoomStatModal
        open={filter !== null}
        onClose={() => setFilter(null)}
        title={filter ? FILTER_LABELS[filter] : ""}
        rooms={filteredRooms}
        filter={filter}
      />
    </>
  );
}
