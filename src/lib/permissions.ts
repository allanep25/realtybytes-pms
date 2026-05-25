import type { EmployeeRole } from "@prisma/client";
import type { NavItem } from "@/lib/constants";

/** Routes each role may access (path prefixes). */
const ROLE_ROUTES: Record<EmployeeRole, string[]> = {
  ADMINISTRATOR: ["*"],
  FRONT_DESK: [
    "/",
    "/rooms",
    "/calendar",
    "/check-in",
    "/guests",
    "/billing",
    "/reports",
    "/receipts",
    "/employees",
  ],
  HOUSEKEEPING: ["/housekeeping", "/employees"],
};

/** Admin-only routes */
export const ADMIN_ONLY_ROUTES = ["/settings"];

export function isAdministrator(role: EmployeeRole): boolean {
  return role === "ADMINISTRATOR";
}

export function canAccessRoute(role: EmployeeRole, pathname: string): boolean {
  if (ADMIN_ONLY_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
    return role === "ADMINISTRATOR";
  }

  const allowed = ROLE_ROUTES[role];
  if (allowed.includes("*")) return true;

  return allowed.some(
    (route) => pathname === route || (route !== "/" && pathname.startsWith(route)),
  );
}

export function filterNavItems(role: EmployeeRole, items: NavItem[]): NavItem[] {
  return items.filter((item) => canAccessRoute(role, item.href));
}

export function roleLabel(role: EmployeeRole): string {
  switch (role) {
    case "ADMINISTRATOR":
      return "Administrator";
    case "FRONT_DESK":
      return "Front Desk";
    case "HOUSEKEEPING":
      return "Housekeeping";
    default:
      return role;
  }
}

export function defaultRouteForRole(role: EmployeeRole): string {
  if (role === "HOUSEKEEPING") return "/housekeeping";
  return "/";
}
