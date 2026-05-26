import { DashboardShell } from "@/components/layout/DashboardShell";
import { GuestList } from "@/components/guests/GuestList";
import { getGuestHistoryGroups } from "@/lib/guests";

type PageProps = {
  searchParams: Promise<{ search?: string }>;
};

export default async function GuestsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const groups = await getGuestHistoryGroups(params.search);

  return (
    <DashboardShell title="Guest Profiles">
      <GuestList groups={groups} initialSearch={params.search ?? ""} />
    </DashboardShell>
  );
}
