import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/login";
import type { EmployeeRole, EmployeeStatus } from "@prisma/client";

export type EmployeeListItem = {
  id: string;
  name: string;
  email: string | null;
  role: EmployeeRole;
  status: EmployeeStatus;
};

export type CreateEmployeeInput = {
  name: string;
  email: string;
  role: EmployeeRole;
  password: string;
};

export type UpdateEmployeeInput = {
  name?: string;
  email?: string;
  role?: EmployeeRole;
  status?: EmployeeStatus;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validateEmail(email: string): string | null {
  if (!email) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address";
  return null;
}

function validatePassword(password: string): string | null {
  if (password.length < 6) return "Password must be at least 6 characters";
  return null;
}

function mapEmployee(row: {
  id: string;
  name: string;
  email: string | null;
  role: EmployeeRole;
  status: EmployeeStatus;
}): EmployeeListItem {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
  };
}

export async function getEmployees(): Promise<EmployeeListItem[]> {
  const rows = await prisma.employee.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return rows.map(mapEmployee);
}

export async function createEmployee(input: CreateEmployeeInput) {
  if (!input.name.trim()) throw new Error("Name is required");

  const email = normalizeEmail(input.email);
  const emailError = validateEmail(email);
  if (emailError) throw new Error(emailError);

  const passwordError = validatePassword(input.password);
  if (passwordError) throw new Error(passwordError);

  const existing = await prisma.employee.findUnique({ where: { email } });
  if (existing) throw new Error("An employee with this email already exists");

  const passwordHash = await hashPassword(input.password);

  const employee = await prisma.employee.create({
    data: {
      name: input.name.trim(),
      email,
      passwordHash,
      role: input.role,
      status: "ACTIVE",
    },
  });

  return mapEmployee(employee);
}

export async function updateEmployee(id: string, input: UpdateEmployeeInput) {
  if (input.name !== undefined && !input.name.trim()) {
    throw new Error("Name is required");
  }

  let email: string | undefined;
  if (input.email != null) {
    email = normalizeEmail(input.email);
    const emailError = validateEmail(email);
    if (emailError) throw new Error(emailError);

    const existing = await prisma.employee.findFirst({
      where: { email, NOT: { id } },
    });
    if (existing) throw new Error("An employee with this email already exists");
  }

  const employee = await prisma.employee.update({
    where: { id },
    data: {
      ...(input.name != null ? { name: input.name.trim() } : {}),
      ...(email != null ? { email } : {}),
      ...(input.role != null ? { role: input.role } : {}),
      ...(input.status != null ? { status: input.status } : {}),
    },
  });

  return mapEmployee(employee);
}

export async function getEmployeeById(id: string): Promise<EmployeeListItem> {
  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) throw new Error("Employee not found");

  return mapEmployee(employee);
}

export async function deleteEmployee(id: string, actingUserId: string): Promise<void> {
  if (id === actingUserId) {
    throw new Error("You cannot remove your own account");
  }

  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) throw new Error("Employee not found");

  if (employee.role === "ADMINISTRATOR" && employee.status === "ACTIVE") {
    const otherAdmins = await prisma.employee.count({
      where: {
        role: "ADMINISTRATOR",
        status: "ACTIVE",
        NOT: { id },
      },
    });
    if (otherAdmins === 0) {
      throw new Error("Cannot remove the last active administrator");
    }
  }

  await prisma.housekeepingTask.updateMany({
    where: { assignedTo: id },
    data: { assignedTo: null },
  });

  await prisma.employee.delete({ where: { id } });
}
