"use client";

import { AuthProvider } from "@/components/auth/AuthProvider";
import type { SessionUser } from "@/lib/auth-types";
import { useState } from "react";
import { PullToRefresh } from "./PullToRefresh";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

type AppShellProps = {
  title: string;
  hotelName?: string;
  user: SessionUser;
  children: React.ReactNode;
};

export function AppShell({ title, hotelName, user, children }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <AuthProvider user={user}>
      <PullToRefresh />
      <div className="min-h-screen bg-slate-50">
        <Sidebar
          hotelName={hotelName}
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />

        {mobileNavOpen && (
          <button
            type="button"
            aria-label="Close navigation menu"
            className="fixed inset-0 z-20 bg-black/40 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
        )}

        <div className="lg:pl-60">
          <TopBar title={title} onMenuClick={() => setMobileNavOpen(true)} />
          <main className="p-3 sm:p-4 xl:p-5">{children}</main>
        </div>
      </div>
    </AuthProvider>
  );
}
