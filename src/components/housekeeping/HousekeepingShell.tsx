import { getShellProps } from "@/lib/get-shell-props";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { HousekeepingTopBar } from "@/components/housekeeping/HousekeepingTopBar";

type HousekeepingShellProps = {
  children: React.ReactNode;
};

export async function HousekeepingShell({ children }: HousekeepingShellProps) {
  const { user, hotelName } = await getShellProps();

  return (
    <AuthProvider user={user}>
      <div className="min-h-screen bg-slate-50">
        <HousekeepingTopBar hotelName={hotelName} />
        <main className="mx-auto max-w-6xl p-4 sm:p-6">{children}</main>
      </div>
    </AuthProvider>
  );
}
