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

function validateNewPassword(password: string): string | null {
  if (password.length < 6) {
    return "Password must be at least 6 characters";
  }
  return null;
}

export async function changeEmployeePassword(
  employeeId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const passwordError = validateNewPassword(newPassword);
  if (passwordError) throw new Error(passwordError);

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee || !employee.passwordHash) {
    throw new Error("Account not found");
  }

  const valid = await compare(currentPassword, employee.passwordHash);
  if (!valid) {
    throw new Error("Current password is incorrect");
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.employee.update({
    where: { id: employeeId },
    data: { passwordHash },
  });
}

export async function setEmployeePassword(employeeId: string, newPassword: string): Promise<void> {
  const passwordError = validateNewPassword(newPassword);
  if (passwordError) throw new Error(passwordError);

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error("Employee not found");

  const passwordHash = await hashPassword(newPassword);
  await prisma.employee.update({
    where: { id: employeeId },
    data: { passwordHash },
  });
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
