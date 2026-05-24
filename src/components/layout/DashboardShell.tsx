import { getShellProps } from "@/app/(dashboard)/layout";
import { AppShell } from "./AppShell";

type DashboardShellProps = {
  title: string;
  children: React.ReactNode;
};

export async function DashboardShell({ title, children }: DashboardShellProps) {
  const { user, hotelName } = await getShellProps();
  return (
    <AppShell title={title} user={user} hotelName={hotelName}>
      {children}
    </AppShell>
  );
}
