"use client";

import { ChangePasswordModal } from "@/components/auth/ChangePasswordModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { getInitials } from "@/lib/auth-types";
import { roleLabel } from "@/lib/permissions";
import { Bell, ChevronDown, KeyRound, LogOut, Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type TopBarProps = {
  title: string;
  onMenuClick?: () => void;
};

export function TopBar({ title, onMenuClick }: TopBarProps) {
  const user = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="truncate text-base font-semibold text-slate-800 sm:text-lg">{title}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <button
          type="button"
          className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-room-dirty" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 py-1.5 pl-1.5 pr-2 sm:pr-3 hover:bg-slate-50"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar text-xs font-semibold text-white">
              {getInitials(user.name)}
            </span>
            <span className="hidden text-left text-sm sm:block">
              <span className="block font-medium text-slate-800">{user.name}</span>
              <span className="block text-xs text-slate-500">{roleLabel(user.role)}</span>
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden />
          </button>

          {open && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                <p className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
                  {user.email}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setShowPassword(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <KeyRound className="h-4 w-4" />
                  Change password
                </button>
                <button
                  type="button"
                  onClick={logout}
                  disabled={loggingOut}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <LogOut className="h-4 w-4" />
                  {loggingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <ChangePasswordModal
        open={showPassword}
        onClose={() => setShowPassword(false)}
        mode="self"
      />
    </header>
  );
}
