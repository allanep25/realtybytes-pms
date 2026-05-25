import type { EmployeeRole } from "@prisma/client";

export const SESSION_COOKIE = "amar_session";
export const SESSION_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: EmployeeRole;
};

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
