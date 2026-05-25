"use client";

import { HOUSEKEEPING_STATUS_LABELS, ROOM_STATUS_LABELS } from "@/lib/constants";
import type { HousekeepingTaskItem } from "@/lib/housekeeping";
import { cn, compareRoomNumbers } from "@/lib/utils";
import type { HousekeepingStatus } from "@prisma/client";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_BADGE: Record<string, string> = {
  DIRTY: "bg-room-cleaning text-white",
  CLEANING: "bg-room-cleaning text-white",
};

const TASK_GRID_CLASS = "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3";

type HousekeepingDeskProps = {
  tasks: HousekeepingTaskItem[];
  currentUserId: string;
};

function matchesSearch(task: HousekeepingTaskItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    task.roomNumber.toLowerCase().includes(q) ||
    (task.notes?.toLowerCase().includes(q) ?? false) ||
    (task.assignedName?.toLowerCase().includes(q) ?? false)
  );
}

function TaskCard({
  task,
  currentUserId,
  onUpdate,
  loading,
}: {
  task: HousekeepingTaskItem;
  currentUserId: string;
  onUpdate: (
    roomId: string,
    status: HousekeepingStatus,
    options?: { assignedTo?: string | null; notes?: string | null },
  ) => Promise<void>;
  loading: boolean;
}) {
  const isDirty = task.status === "DIRTY";

  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-slate-900">Room {task.roomNumber}</p>
          <p className="mt-1 text-sm text-slate-500">
            {ROOM_STATUS_LABELS[task.roomStatus] ?? task.roomStatus}
          </p>
        </div>
        <span
          className={cn(
            "rounded-lg px-3 py-2 text-xs font-semibold",
            STATUS_BADGE[task.status],
          )}
        >
          {HOUSEKEEPING_STATUS_LABELS[task.status]}
        </span>
      </div>

      {task.notes && (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{task.notes}</p>
      )}

      {task.assignedName && (
        <p className="mt-2 text-xs text-slate-500">
          Assigned to <span className="font-medium text-slate-700">{task.assignedName}</span>
        </p>
      )}

      <div className="mt-auto space-y-2 pt-4">
        {isDirty && (
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              onUpdate(task.roomId, "CLEANING", {
                assignedTo: currentUserId,
                notes: task.notes ?? "Cleaning in progress",
              })
            }
            className="w-full rounded-lg bg-room-cleaning py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Updating…" : "Start cleaning"}
          </button>
        )}

        <button
          type="button"
          disabled={loading}
          onClick={() => onUpdate(task.roomId, "CLEAN", { assignedTo: null, notes: null })}
          className="w-full rounded-lg bg-room-vacant py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Updating…" : "Mark vacant — ready for guests"}
        </button>
      </div>
    </article>
  );
}

export function HousekeepingDesk({ tasks, currentUserId }: HousekeepingDeskProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      tasks
        .filter((task) => matchesSearch(task, search))
        .sort((a, b) => compareRoomNumbers(a.roomNumber, b.roomNumber)),
    [tasks, search],
  );

  const dirtyTasks = useMemo(
    () => filtered.filter((task) => task.status === "DIRTY"),
    [filtered],
  );

  const cleaningTasks = useMemo(
    () => filtered.filter((task) => task.status === "CLEANING"),
    [filtered],
  );

  async function handleUpdate(
    roomId: string,
    status: HousekeepingStatus,
    options?: { assignedTo?: string | null; notes?: string | null },
  ) {
    setLoadingId(roomId);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/housekeeping/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          assignedTo: options?.assignedTo,
          notes: options?.notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");

      setSuccess(
        status === "CLEAN"
          ? `Room ${data.roomNumber} is now vacant — ready for new guests.`
          : `Room ${data.roomNumber} marked as cleaning.`,
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-slate-800">Rooms waiting to be cleaned</p>
        <p className="mt-1 text-sm text-slate-500">
          When finished, tap <strong>Mark vacant — ready for guests</strong>. Front desk will see
          the room as vacant on the dashboard and can assign new guests.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-room-dirty">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-room-vacant">
          {success}
        </p>
      )}

      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search room number…"
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm shadow-sm focus:border-room-cleaning focus:outline-none focus:ring-1 focus:ring-room-cleaning"
        />
      </label>

      {tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-medium text-slate-700">All caught up</p>
          <p className="mt-1 text-sm text-slate-500">No rooms need cleaning right now.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-600">No rooms match your search.</p>
        </div>
      ) : (
        <>
          {dirtyTasks.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Needs cleaning ({dirtyTasks.length})
              </h2>
              <div className={TASK_GRID_CLASS}>
                {dirtyTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    currentUserId={currentUserId}
                    onUpdate={handleUpdate}
                    loading={loadingId === task.roomId}
                  />
                ))}
              </div>
            </section>
          )}

          {cleaningTasks.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Cleaning in progress ({cleaningTasks.length})
              </h2>
              <div className={TASK_GRID_CLASS}>
                {cleaningTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    currentUserId={currentUserId}
                    onUpdate={handleUpdate}
                    loading={loadingId === task.roomId}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
