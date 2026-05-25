"use client";

import {
  EMPLOYEE_ROLE_LABELS,
  HOUSEKEEPING_STATUS_LABELS,
  ROOM_STATUS_LABELS,
} from "@/lib/constants";
import type { HousekeepingTaskItem } from "@/lib/housekeeping";
import { cn } from "@/lib/utils";
import type { HousekeepingStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type HousekeepingTableProps = {
  tasks: HousekeepingTaskItem[];
  staff: { id: string; name: string }[];
};

const STATUS_BADGE: Record<string, string> = {
  CLEAN: "bg-room-vacant text-white",
  DIRTY: "bg-room-reserved text-slate-900",
  CLEANING: "bg-room-occupied text-white",
  OUT_OF_ORDER: "bg-room-dirty text-white",
};

export function HousekeepingTable({ tasks, staff }: HousekeepingTableProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(roomId: string, status: HousekeepingStatus, notes?: string) {
    setLoadingId(roomId);
    setError(null);
    try {
      const res = await fetch(`/api/housekeeping/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes: notes ?? null }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Update failed");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setLoadingId(null);
    }
  }

  async function assignStaff(roomId: string, employeeId: string) {
    setLoadingId(roomId);
    setError(null);
    try {
      const res = await fetch(`/api/housekeeping/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignOnly: true,
          assignedTo: employeeId || null,
        }),
      });
      if (!res.ok) throw new Error("Assign failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assign failed");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-room-dirty">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Room Status</th>
              <th className="px-4 py-3">HK Status</th>
              <th className="px-4 py-3">Assigned To</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-4 py-3 font-semibold text-slate-800">{task.roomNumber}</td>
                <td className="px-4 py-3 text-slate-600">
                  {ROOM_STATUS_LABELS[task.roomStatus] ?? task.roomStatus}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                      STATUS_BADGE[task.status],
                    )}
                  >
                    {HOUSEKEEPING_STATUS_LABELS[task.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={task.assignedTo ?? ""}
                    onChange={(e) => assignStaff(task.roomId, e.target.value)}
                    disabled={loadingId === task.roomId}
                    className="rounded border border-slate-200 px-2 py-1 text-xs"
                  >
                    <option value="">Unassigned</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="max-w-[160px] truncate px-4 py-3 text-slate-500">
                  {task.notes ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      disabled={loadingId === task.roomId}
                      onClick={() => setStatus(task.roomId, "CLEAN")}
                      className="rounded bg-room-vacant px-2 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Mark Clean
                    </button>
                    <button
                      type="button"
                      disabled={loadingId === task.roomId}
                      onClick={() =>
                        setStatus(task.roomId, "DIRTY", "Marked dirty by housekeeping")
                      }
                      className="rounded bg-room-reserved px-2 py-1 text-xs font-medium text-slate-900 hover:opacity-90 disabled:opacity-50"
                    >
                      Mark Dirty
                    </button>
                    <button
                      type="button"
                      disabled={loadingId === task.roomId}
                      onClick={() =>
                        setStatus(task.roomId, "OUT_OF_ORDER", "Out of order — maintenance")
                      }
                      className="rounded bg-room-dirty px-2 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Out of Order
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
