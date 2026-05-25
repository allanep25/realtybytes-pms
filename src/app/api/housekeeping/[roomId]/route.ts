import { updateHousekeepingTask, assignHousekeepingTask } from "@/lib/housekeeping";
import type { HousekeepingStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ roomId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { roomId } = await context.params;

  try {
    const body = await request.json();

    if (body.assignOnly) {
      const task = await assignHousekeepingTask(roomId, body.assignedTo ?? null);
      revalidatePath("/housekeeping");
      revalidatePath("/rooms");
      revalidatePath("/");
      revalidatePath("/guard");
      return NextResponse.json(task);
    }

    const task = await updateHousekeepingTask(roomId, {
      status: body.status as HousekeepingStatus,
      assignedTo: body.assignedTo,
      notes: body.notes,
    });

    revalidatePath("/housekeeping");
    revalidatePath("/rooms");
    revalidatePath("/");
    revalidatePath("/guard");

    return NextResponse.json(task);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
