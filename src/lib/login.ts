import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth-types";
import { compare } from "bcryptjs";
import type { EmployeeRole } from "@prisma/client";

export async function authenticateEmployee(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const employee = await prisma.employee.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  if (!employee || employee.status !== "ACTIVE" || !employee.passwordHash) {
    return null;
  }

  const valid = await compare(password, employee.passwordHash);
  if (!valid) return null;

  return {
    id: employee.id,
    name: employee.name,
    email: employee.email!,
    role: employee.role,
  };
}

export async function hashPassword(password: string): Promise<string> {
  const { hash } = await import("bcryptjs");
  return hash(password, 10);
}

export type LoginAccount = {
  email: string;
  role: EmployeeRole;
  label: string;
};

export const DEMO_ACCOUNTS: LoginAccount[] = [
  { email: "admin@amarresidence.com", role: "ADMINISTRATOR", label: "Administrator" },
  { email: "frontdesk@amarresidence.com", role: "FRONT_DESK", label: "Front Desk" },
  { email: "housekeeping@amarresidence.com", role: "HOUSEKEEPING", label: "Housekeeping" },
];
