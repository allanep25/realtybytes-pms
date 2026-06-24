import {
  createSessionToken,
  setSessionCookie,
} from "@/lib/auth";
import { authenticateEmployee } from "@/lib/login";
import { defaultRouteForRole } from "@/lib/permissions";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "");
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await authenticateEmployee(email, password);
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = await createSessionToken(user);
    await setSessionCookie(token, user.role);

    return NextResponse.json({
      user,
      redirectTo: defaultRouteForRole(user.role),
    });
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

export async function GET() {
  const { getSession } = await import("@/lib/auth");
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({ user });
}
