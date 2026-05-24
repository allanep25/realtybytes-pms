import { AuthProvider } from "@/components/auth/AuthProvider";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import type { SessionUser } from "@/lib/auth-types";

type AppShellProps = {
  title: string;
  hotelName?: string;
  user: SessionUser;
  children: React.ReactNode;
};

export function AppShell({ title, hotelName, user, children }: AppShellProps) {
  return (
    <AuthProvider user={user}>
      <div className="min-h-screen">
        <Sidebar hotelName={hotelName} />
        <div className="pl-60">
          <TopBar title={title} />
          <main className="p-4 xl:p-5">{children}</main>
        </div>
      </div>
    </AuthProvider>
  );
}
