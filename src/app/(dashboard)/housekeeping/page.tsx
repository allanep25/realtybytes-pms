import { DashboardShell } from "@/components/layout/DashboardShell";
import { HousekeepingTable } from "@/components/housekeeping/HousekeepingTable";
import { getHousekeepingStaff, getHousekeepingTasks } from "@/lib/housekeeping";

export default async function HousekeepingPage() {
  const [tasks, staff] = await Promise.all([
    getHousekeepingTasks(),
    getHousekeepingStaff(),
  ]);

  return (
    <DashboardShell title="Housekeeping">
      <p className="mb-4 text-sm text-slate-500">
        Assign staff and update room cleaning status. Mark Clean sets vacant rooms ready for
        guests.
      </p>
      <HousekeepingTable tasks={tasks} staff={staff} />
    </DashboardShell>
  );
}
