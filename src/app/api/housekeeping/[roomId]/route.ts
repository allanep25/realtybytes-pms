import {
  assignHousekeepingTask,
  updateHousekeepingChecklist,
  updateHousekeepingTask,
} from "@/lib/housekeeping";
import { getSession } from "@/lib/auth";
import { isAdministrator, isHousekeepingRole } from "@/lib/permissions";
import type { HousekeepingStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ roomId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdministrator(session.role) && !isHousekeepingRole(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { roomId } = await context.params;

  try {
    const body = await request.json();

    if (body.checklistState !== undefined && body.status === undefined && !body.assignOnly) {
      const task = await updateHousekeepingChecklist(roomId, body.checklistState);
      revalidatePath("/housekeeping");
      revalidatePath("/rooms");
      revalidatePath("/");
      revalidatePath("/guard");
      revalidatePath("/check-in");
      revalidatePath("/calendar");
      return NextResponse.json(task);
    }

    if (body.assignOnly) {
      const task = await assignHousekeepingTask(roomId, body.assignedTo ?? null);
      revalidatePath("/housekeeping");
      revalidatePath("/rooms");
      revalidatePath("/");
      revalidatePath("/guard");
      revalidatePath("/check-in");
      revalidatePath("/calendar");
      return NextResponse.json(task);
    }

    const task = await updateHousekeepingTask(roomId, {
      status: body.status as HousekeepingStatus,
      assignedTo: body.assignedTo,
      notes: body.notes,
      checklistState: body.checklistState,
    });

    revalidatePath("/housekeeping");
    revalidatePath("/rooms");
    revalidatePath("/");
    revalidatePath("/guard");
    revalidatePath("/check-in");
    revalidatePath("/calendar");

    return NextResponse.json(task);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
