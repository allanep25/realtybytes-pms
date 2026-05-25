"use client";

import { ChangePasswordModal } from "@/components/auth/ChangePasswordModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { getInitials } from "@/lib/auth-types";
import { roleLabel } from "@/lib/permissions";
import { ChevronDown, KeyRound, LogOut, Sparkles } from "lucide-react";
import { signOut } from "@/components/auth/sign-out";
import { useState } from "react";

type HousekeepingTopBarProps = {
  hotelName?: string;
};

export function HousekeepingTopBar({ hotelName }: HousekeepingTopBarProps) {
  const user = useAuth();
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await signOut();
  }

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 shrink-0 text-room-cleaning" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">Cleaning Queue</p>
                {hotelName && (
                  <p className="truncate text-xs text-slate-400">{hotelName}</p>
                )}
              </div>
            </div>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 text-sm hover:bg-slate-50"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar text-xs font-semibold text-white">
                {getInitials(user.name)}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block max-w-[120px] truncate font-medium text-slate-800">
                  {user.name}
                </span>
                <span className="block text-xs text-slate-400">{roleLabel(user.role)}</span>
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>

            {open && (
              <>
                <button
                  type="button"
                  aria-label="Close menu"
                  className="fixed inset-0 z-10"
                  onClick={() => setOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
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
      </header>

      <ChangePasswordModal
        open={showPassword}
        onClose={() => setShowPassword(false)}
        mode="self"
      />
    </>
  );
}
