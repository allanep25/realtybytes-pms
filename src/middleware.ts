import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-types";
import { verifySessionToken } from "@/lib/auth-jwt";
import { canAccessRoute, defaultRouteForRole } from "@/lib/permissions";

const PUBLIC_PATHS = ["/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (PUBLIC_PATHS.includes(pathname)) {
    if (session) {
      return NextResponse.redirect(
        new URL(defaultRouteForRole(session.role), request.url),
      );
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    if (pathname.startsWith("/api/auth/login")) {
      return NextResponse.next();
    }
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccessRoute(session.role, pathname)) {
    return NextResponse.redirect(new URL(defaultRouteForRole(session.role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
