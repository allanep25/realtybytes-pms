import { prisma } from "@/lib/db";
import type { EmployeeRole, EmployeeStatus } from "@prisma/client";

export type EmployeeListItem = {
  id: string;
  name: string;
  role: EmployeeRole;
  status: EmployeeStatus;
};

export type CreateEmployeeInput = {
  name: string;
  role: EmployeeRole;
};

export type UpdateEmployeeInput = {
  name?: string;
  role?: EmployeeRole;
  status?: EmployeeStatus;
};

export async function getEmployees(): Promise<EmployeeListItem[]> {
  const rows = await prisma.employee.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return rows.map((e) => ({
    id: e.id,
    name: e.name,
    role: e.role,
    status: e.status,
  }));
}

export async function createEmployee(input: CreateEmployeeInput) {
  if (!input.name.trim()) throw new Error("Name is required");

  const employee = await prisma.employee.create({
    data: {
      name: input.name.trim(),
      role: input.role,
      status: "ACTIVE",
    },
  });

  return {
    id: employee.id,
    name: employee.name,
    role: employee.role,
    status: employee.status,
  };
}

export async function updateEmployee(id: string, input: UpdateEmployeeInput) {
  if (input.name !== undefined && !input.name.trim()) {
    throw new Error("Name is required");
  }

  const employee = await prisma.employee.update({
    where: { id },
    data: {
      ...(input.name != null ? { name: input.name.trim() } : {}),
      ...(input.role != null ? { role: input.role } : {}),
      ...(input.status != null ? { status: input.status } : {}),
    },
  });

  return {
    id: employee.id,
    name: employee.name,
    role: employee.role,
    status: employee.status,
  };
}

export async function getEmployeeById(id: string): Promise<EmployeeListItem> {
  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) throw new Error("Employee not found");

  return {
    id: employee.id,
    name: employee.name,
    role: employee.role,
    status: employee.status,
  };
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
