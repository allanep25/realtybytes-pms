import { getShellProps } from "@/app/(dashboard)/layout";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { GuardTopBar } from "@/components/guard/GuardTopBar";

type GuardShellProps = {
  children: React.ReactNode;
};

export async function GuardShell({ children }: GuardShellProps) {
  const { user, hotelName } = await getShellProps();

  return (
    <AuthProvider user={user}>
      <div className="min-h-screen bg-slate-50">
        <GuardTopBar hotelName={hotelName} />
        <main className="mx-auto max-w-6xl p-4 sm:p-6">{children}</main>
      </div>
    </AuthProvider>
  );
}
