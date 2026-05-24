import { SESSION_COOKIE, type SessionUser } from "@/lib/auth-types";
import { verifySessionToken, createSessionToken } from "@/lib/auth-jwt";
import { cookies } from "next/headers";

export { SESSION_COOKIE, type SessionUser } from "@/lib/auth-types";
export { createSessionToken, verifySessionToken } from "@/lib/auth-jwt";

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
