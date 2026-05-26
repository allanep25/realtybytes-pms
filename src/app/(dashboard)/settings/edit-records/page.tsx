import { EditRecordsWorkspace } from "@/components/admin/EditRecordsWorkspace";
import { DashboardShell } from "@/components/layout/DashboardShell";
import Link from "next/link";

export default function EditRecordsPage() {
  return (
    <DashboardShell title="Edit Records">
      <p className="mb-2 text-sm text-slate-500">
        Administrator only — correct guest or reservation details when front desk encoding mistakes
        are found.
      </p>
      <Link href="/settings" className="mb-6 inline-block text-sm text-room-occupied hover:underline">
        ← Back to Settings
      </Link>
      <EditRecordsWorkspace />
    </DashboardShell>
  );
}
