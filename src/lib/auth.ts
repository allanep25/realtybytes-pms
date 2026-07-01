import { SESSION_COOKIE, type SessionUser } from "@/lib/auth-types";
import { verifySessionToken } from "@/lib/auth-jwt";
import { cookies } from "next/headers";

export { SESSION_COOKIE, type SessionUser } from "@/lib/auth-types";
export { createSessionToken, verifySessionToken } from "@/lib/auth-jwt";

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  return getSession();
}

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function setSessionCookie(token: string, role?: import("@prisma/client").EmployeeRole) {
  const cookieStore = await cookies();
  const maxAge = role === "ADMINISTRATOR" ? 60 * 60 * 24 * 30 : 60 * 60 * 8;
  cookieStore.set(SESSION_COOKIE, token, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
    expires: new Date(0),
  });
}

export function getExpiredSessionCookieOptions() {
  return {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
    expires: new Date(0),
  };
}
