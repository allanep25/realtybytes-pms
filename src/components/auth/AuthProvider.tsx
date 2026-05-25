"use client";

import { IdleTimeout } from "@/components/auth/IdleTimeout";
import type { SessionUser } from "@/lib/auth-types";
import { createContext, useContext } from "react";

const AuthContext = createContext<SessionUser | null>(null);

export function AuthProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return (
    <AuthContext.Provider value={user}>
      <IdleTimeout />
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): SessionUser {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
