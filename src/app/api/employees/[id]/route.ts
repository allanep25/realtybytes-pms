import { getSession } from "@/lib/auth";
import { setEmployeePassword } from "@/lib/login";
import { updateEmployee } from "@/lib/employees";
import type { EmployeeRole, EmployeeStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json();

    if (body.password != null) {
      if (session.role !== "ADMINISTRATOR") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      await setEmployeePassword(id, String(body.password));
    }

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
