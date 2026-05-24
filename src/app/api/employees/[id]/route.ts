import { updateEmployee } from "@/lib/employees";
import type { EmployeeRole, EmployeeStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const body = await request.json();
    const employee = await updateEmployee(id, {
      name: body.name,
      role: body.role as EmployeeRole | undefined,
      status: body.status as EmployeeStatus | undefined,
    });

    revalidatePath("/employees");
    revalidatePath("/housekeeping");

    return NextResponse.json(employee);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
