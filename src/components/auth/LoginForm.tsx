"use client";

import { DEMO_ACCOUNTS } from "@/lib/login";
import { Flower2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("admin@amarresidence.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  function fillDemo(accountEmail: string) {
    setEmail(accountEmail);
    setPassword("admin123");
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-sidebar p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-room-vacant/20 text-room-vacant">
            <Flower2 className="h-7 w-7" />
          </div>
          <div>
            <p className="text-lg font-semibold">Amar Residence</p>
            <p className="text-xs tracking-[0.2em] text-slate-400">HOTEL MANAGEMENT</p>
          </div>
        </div>
        <p className="max-w-sm text-slate-300">
          Sign in with your staff account to access the hotel management system.
        </p>
        <p className="text-xs text-slate-500">© Amar Residence</p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden text-center">
            <p className="text-xl font-bold text-slate-800">Amar Residence</p>
            <p className="text-sm text-slate-500">Staff Login</p>
          </div>

          <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-xl font-semibold text-slate-800">Welcome back</h1>
            <p className="mt-1 text-sm text-slate-500">Enter your credentials to continue</p>

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
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-4">
            <p className="text-xs font-medium uppercase text-slate-500">Demo accounts</p>
            <p className="mt-1 text-xs text-slate-400">Password for all: admin123</p>
            <ul className="mt-3 space-y-2">
              {DEMO_ACCOUNTS.map((a) => (
                <li key={a.email}>
                  <button
                    type="button"
                    onClick={() => fillDemo(a.email)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-800">{a.label}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{a.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
