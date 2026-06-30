import { deleteRoom, updateRoom } from "@/lib/rooms";
import { getSession } from "@/lib/auth";
import { isAdministrator } from "@/lib/permissions";
import type { RoomStatus, RoomType } from "@prisma/client";
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
    const { number, floor, description, maxPax, status, type, baseRate, breakfastRate } = body as {
      number?: string;
      floor?: number;
      description?: string;
      maxPax?: number;
      status?: RoomStatus;
      type?: RoomType;
      baseRate?: number;
      breakfastRate?: number | null;
    };

    if (number != null && (typeof number !== "string" || number.trim() === "")) {
      return NextResponse.json({ error: "Invalid room number" }, { status: 400 });
    }
    if (floor != null && (!Number.isFinite(floor) || floor < 1 || !Number.isInteger(floor))) {
      return NextResponse.json({ error: "Invalid floor" }, { status: 400 });
    }
    if (description != null && typeof description !== "string") {
      return NextResponse.json({ error: "Invalid description" }, { status: 400 });
    }
    if (maxPax != null && (!Number.isFinite(maxPax) || maxPax < 1 || !Number.isInteger(maxPax))) {
      return NextResponse.json({ error: "Invalid pax" }, { status: 400 });
    }
    if (baseRate != null && (!Number.isFinite(baseRate) || baseRate < 0)) {
      return NextResponse.json({ error: "Invalid base rate" }, { status: 400 });
    }
    if (breakfastRate != null && (!Number.isFinite(breakfastRate) || breakfastRate < 0)) {
      return NextResponse.json({ error: "Invalid breakfast rate" }, { status: 400 });
    }

    const room = await updateRoom(id, {
      number,
      floor,
      description,
      maxPax,
      status,
      type,
      baseRate,
      breakfastRate,
    });
    revalidatePath("/");
    revalidatePath("/rooms");
    revalidatePath("/calendar");

    return NextResponse.json(room);
  } catch (error) {
    const prismaError = error as { code?: string } | null;
    if (prismaError?.code === "P2002") {
      return NextResponse.json({ error: "Room number already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update room" }, { status: 500 });
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
    await deleteRoom(id);
    revalidatePath("/");
    revalidatePath("/rooms");
    revalidatePath("/calendar");
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
