import { getSession } from "@/lib/auth";
import { getHotelSettings } from "@/lib/settings";
import { redirect } from "next/navigation";

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return children;
}

export async function getShellProps() {
  const [session, settings] = await Promise.all([getSession(), getHotelSettings()]);
  if (!session) redirect("/login");
  return { user: session, hotelName: settings.name };
}
