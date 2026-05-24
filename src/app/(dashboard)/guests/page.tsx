import { DashboardShell } from "@/components/layout/DashboardShell";
import { GuestList } from "@/components/guests/GuestList";
import { getGuests } from "@/lib/guests";

type PageProps = {
  searchParams: Promise<{ search?: string }>;
};

export default async function GuestsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const guests = await getGuests(params.search);

  return (
    <DashboardShell title="Guest Profiles">
      <GuestList guests={guests} initialSearch={params.search ?? ""} />
    </DashboardShell>
  );
}
