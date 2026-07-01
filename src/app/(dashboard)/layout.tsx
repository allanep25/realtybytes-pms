import { getShellProps } from "@/lib/get-shell-props";

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await getShellProps();

  return children;
}
