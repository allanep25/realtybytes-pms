import { updateRoom } from "@/lib/rooms";
import type { RoomStatus, RoomType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const body = await request.json();
    const { status, type, baseRate } = body as {
      status?: RoomStatus;
      type?: RoomType;
      baseRate?: number;
    };

    if (baseRate != null && (typeof baseRate !== "number" || baseRate < 0)) {
      return NextResponse.json({ error: "Invalid base rate" }, { status: 400 });
    }

    const room = await updateRoom(id, { status, type, baseRate });
    revalidatePath("/");
    revalidatePath("/rooms");
    revalidatePath("/calendar");

    return NextResponse.json(room);
  } catch {
    return NextResponse.json({ error: "Failed to update room" }, { status: 500 });
  }
}
