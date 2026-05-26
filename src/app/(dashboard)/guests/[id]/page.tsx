import { DashboardShell } from "@/components/layout/DashboardShell";
import { GuestProfileCard } from "@/components/guests/GuestProfileCard";
import { getSession } from "@/lib/auth";
import { getGuestProfile } from "@/lib/guests";
import { isAdministrator } from "@/lib/permissions";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
};

export default async function GuestDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { edit } = await searchParams;
  const [guest, session] = await Promise.all([getGuestProfile(id), getSession()]);

  if (!guest) {
    notFound();
  }

  const canEdit = session ? isAdministrator(session.role) : false;

  return (
    <DashboardShell title="Guest Profile">
      <GuestProfileCard
        guest={guest}
        canEdit={canEdit}
        startEditing={canEdit && edit === "1"}
      />
    </DashboardShell>
  );
}
