import { getEmployeeById, getEmployees, createEmployee } from "@/lib/employees";
import { getSession } from "@/lib/auth";
import { isAdministrator } from "@/lib/permissions";
import type { EmployeeRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isAdministrator(session.role)) {
    const employees = await getEmployees();
    return NextResponse.json(employees);
  }

  const employee = await getEmployeeById(session.id);
  return NextResponse.json([employee]);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdministrator(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const employee = await createEmployee({
      name: body.name,
      role: body.role as EmployeeRole,
    });

    revalidatePath("/employees");
    revalidatePath("/housekeeping");

    return NextResponse.json(employee);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create employee";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
