import { getSession } from "@/lib/auth";
import { deleteEmployee, getEmployeeById, updateEmployee } from "@/lib/employees";
import { setEmployeePassword } from "@/lib/login";
import { isAdministrator } from "@/lib/permissions";
import type { EmployeeRole, EmployeeStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdministrator(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json();

    if (body.password != null) {
      await setEmployeePassword(id, String(body.password));
    }

    const hasProfileUpdate =
      body.name != null || body.email != null || body.role != null || body.status != null;

    const employee = hasProfileUpdate
      ? await updateEmployee(id, {
          name: body.name,
          email: body.email,
          role: body.role as EmployeeRole | undefined,
          status: body.status as EmployeeStatus | undefined,
        })
      : await getEmployeeById(id);

    revalidatePath("/employees");
    revalidatePath("/housekeeping");

    return NextResponse.json(employee);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdministrator(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    await deleteEmployee(id, session.id);
    revalidatePath("/employees");
    revalidatePath("/housekeeping");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
