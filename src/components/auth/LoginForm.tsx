"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedProfile, setSavedProfile] = useState<{
    propertyName?: string;
    tagline?: string;
    logo?: string;
  }>({});
  const signedOut = searchParams.get("signedOut") === "1";
  const idleTimeout = searchParams.get("reason") === "idle";

  useEffect(() => {
    setEmail("");
    setPassword("");
  }, []);

  useEffect(() => {
    const readProfile = () => {
      try {
        const parsed = JSON.parse(localStorage.getItem("propertyProfile") || "{}");
        setSavedProfile(parsed);
      } catch {
        setSavedProfile({});
      }
    };

    readProfile();
    window.addEventListener("propertyProfileUpdated", readProfile);
    return () => {
      window.removeEventListener("propertyProfileUpdated", readProfile);
    };
  }, []);

  const loginLogo = savedProfile.logo;
  const loginPropertyName = savedProfile.propertyName || "RealtyBytes PMS";
  const loginTagline = savedProfile.tagline || "Property Management System";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed");

      const from = searchParams.get("from");
      const dest =
        from && from !== "/login" ? from : (data.redirectTo as string);
      router.push(dest);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-sidebar px-12 py-14 text-white lg:flex">
        <div className="space-y-10">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-slate-200">
              {loginLogo ? (
                <img
                  src={loginLogo}
                  alt={loginPropertyName}
                  className="h-full w-full object-contain p-3"
                />
              ) : (
                <span className="text-2xl font-black text-emerald-700">RB</span>
              )}
            </div>

            <h1 className="text-2xl font-black text-slate-900">{loginPropertyName}</h1>

            <p className="mt-2 text-sm text-slate-500">{loginTagline}</p>
          </div>
          <div className="max-w-sm space-y-5">
            <div className="space-y-3">
              <p className="text-lg leading-7 text-slate-100">
                Professional Property Management Platform
              </p>
              <p className="text-base leading-7 text-slate-300">
                Streamline reservations, guest management, room availability,
                billing, and daily operations from one secure platform.
              </p>
              <p className="text-lg font-medium text-slate-200">
                Smart Property Management Made Simple
              </p>
            </div>
            <div className="space-y-1 text-xs leading-5 text-slate-400">
              <p>
                Powered by{" "}
                <span className="font-medium text-slate-400">
                  MarawiOnline Technologies
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-10 lg:px-10 lg:py-12">
        <div className="w-full max-w-lg">
          <div className="mb-10 flex flex-col items-center text-center lg:hidden">
            <div className="mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-slate-200">
              {loginLogo ? (
                <img
                  src={loginLogo}
                  alt={loginPropertyName}
                  className="h-full w-full object-contain p-3"
                />
              ) : (
                <span className="text-2xl font-black text-emerald-700">RB</span>
              )}
            </div>
            <p className="text-xl font-bold text-slate-800">{loginPropertyName}</p>
            <p className="text-sm text-slate-500">{loginTagline}</p>
          </div>

          <form
            onSubmit={handleSubmit}
            autoComplete="off"
            className="rounded-xl border border-slate-200 bg-white p-10 shadow-sm"
          >
            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-slate-800">Welcome Back</h1>
              <p className="text-sm text-slate-500">
                Sign in to access your RealtyBytes PMS account.
              </p>
              <p className="text-xs text-slate-400">
                For shared front desk computers, always sign out before leaving.
              </p>
            </div>

            {signedOut && (
              <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {idleTimeout
                  ? "Signed out automatically after 15 minutes of inactivity."
                  : "You have been signed out."}
              </p>
            )}

            {error && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-room-dirty">
                {error}
              </p>
            )}

            <label className="mt-6 block text-sm">
              <span className="text-slate-500">Email</span>
              <input
                type="email"
                required
                name="staff-email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 focus:border-room-occupied focus:outline-none focus:ring-1 focus:ring-room-occupied"
              />
            </label>

            <label className="mt-4 block text-sm">
              <span className="text-slate-500">Password</span>
              <input
                type="password"
                required
                name="staff-password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 focus:border-room-occupied focus:outline-none focus:ring-1 focus:ring-room-occupied"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-lg bg-sidebar py-2.5 text-sm font-medium text-white hover:bg-sidebar-hover disabled:opacity-50"
            >
              {loading ? "Signing inâ€¦" : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
