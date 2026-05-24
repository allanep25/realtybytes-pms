import { DashboardShell } from "@/components/layout/DashboardShell";
import { GuestProfileCard } from "@/components/guests/GuestProfileCard";
import { getGuestProfile } from "@/lib/guests";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function GuestDetailPage({ params }: PageProps) {
  const { id } = await params;
  const guest = await getGuestProfile(id);

  if (!guest) {
    notFound();
  }

  return (
    <DashboardShell title="Guest Profile">
      <GuestProfileCard guest={guest} />
    </DashboardShell>
  );
}
