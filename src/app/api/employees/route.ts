import { getEmployees, createEmployee } from "@/lib/employees";
import type { EmployeeRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function GET() {
  const employees = await getEmployees();
  return NextResponse.json(employees);
}

export async function POST(request: Request) {
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
