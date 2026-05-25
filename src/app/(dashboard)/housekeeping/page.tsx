import { DashboardShell } from "@/components/layout/DashboardShell";
import { HousekeepingDesk } from "@/components/housekeeping/HousekeepingDesk";
import { HousekeepingShell } from "@/components/housekeeping/HousekeepingShell";
import { HousekeepingTable } from "@/components/housekeeping/HousekeepingTable";
import { getSession } from "@/lib/auth";
import {
  filterCleaningQueueTasks,
  getHousekeepingStaff,
  getHousekeepingTasks,
} from "@/lib/housekeeping";
import { isHousekeepingRole } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function HousekeepingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [tasks, staff] = await Promise.all([
    getHousekeepingTasks(),
    getHousekeepingStaff(),
  ]);

  if (isHousekeepingRole(session.role)) {
    const cleaningTasks = filterCleaningQueueTasks(tasks);

    return (
      <HousekeepingShell>
        <HousekeepingDesk tasks={cleaningTasks} currentUserId={session.id} />
      </HousekeepingShell>
    );
  }

  return (
    <DashboardShell title="Housekeeping">
      <p className="mb-4 text-sm text-slate-500">
        Assign staff and update room cleaning status. Mark Clean sets vacant rooms ready for
        guests. Housekeeping staff only see dirty and in-progress rooms on their Cleaning Queue
        view.
      </p>
      <HousekeepingTable tasks={tasks} staff={staff} />
    </DashboardShell>
  );
}
