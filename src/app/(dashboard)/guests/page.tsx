import { DashboardShell } from "@/components/layout/DashboardShell";
import { GuestList } from "@/components/guests/GuestList";
import { getSession } from "@/lib/auth";
import { getGuestHistoryGroups } from "@/lib/guests";
import { isAdministrator } from "@/lib/permissions";

type PageProps = {
  searchParams: Promise<{ search?: string }>;
};

export default async function GuestsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await getSession();
  const groups = await getGuestHistoryGroups(params.search);
  const canAdmin = session ? isAdministrator(session.role) : false;

  return (
    <DashboardShell title="Guest Profiles">
      {canAdmin && (
        <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
          Administrator: open a guest profile to <strong>edit</strong> details or{" "}
          <strong>delete</strong> the entry.
        </p>
      )}
      <GuestList groups={groups} initialSearch={params.search ?? ""} canAdmin={canAdmin} />
    </DashboardShell>
  );
}
