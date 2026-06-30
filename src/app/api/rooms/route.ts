import { createRoom } from "@/lib/rooms";
import { getSession } from "@/lib/auth";
import { normalizeHousekeepingChecklist } from "@/lib/housekeeping-checklist";
import { isAdministrator } from "@/lib/permissions";
import type { RoomStatus, RoomType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

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
    const {
      number,
      floor,
      description,
      maxPax,
      status,
      type,
      baseRate,
      breakfastRate,
      housekeepingChecklist,
    } = body as {
      number?: string;
      floor?: number;
      description?: string;
      maxPax?: number;
      status?: RoomStatus;
      type?: RoomType;
      baseRate?: number;
      breakfastRate?: number | null;
      housekeepingChecklist?: unknown;
    };

    if (typeof number !== "string" || number.trim() === "") {
      return NextResponse.json({ error: "Room number is required" }, { status: 400 });
    }
    if (floor == null || !Number.isFinite(floor) || floor < 1 || !Number.isInteger(floor)) {
      return NextResponse.json({ error: "Invalid floor" }, { status: 400 });
    }
    if (maxPax == null || !Number.isFinite(maxPax) || maxPax < 1 || !Number.isInteger(maxPax)) {
      return NextResponse.json({ error: "Invalid pax" }, { status: 400 });
    }
    if (baseRate == null || !Number.isFinite(baseRate) || baseRate < 0) {
      return NextResponse.json({ error: "Invalid base rate" }, { status: 400 });
    }
    if (breakfastRate != null && (!Number.isFinite(breakfastRate) || breakfastRate < 0)) {
      return NextResponse.json({ error: "Invalid breakfast rate" }, { status: 400 });
    }

    const room = await createRoom({
      number: number.trim(),
      floor,
      description: typeof description === "string" ? description : "",
      maxPax,
      status,
      type,
      baseRate,
      breakfastRate,
      housekeepingChecklist: normalizeHousekeepingChecklist(housekeepingChecklist),
    });

    revalidatePath("/");
    revalidatePath("/rooms");
    revalidatePath("/calendar");

    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    const prismaError = error as { code?: string } | null;
    if (prismaError?.code === "P2002") {
      return NextResponse.json({ error: "Room number already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create room" }, { status: 500 });
  }
}
