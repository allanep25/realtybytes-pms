import {
  changeInHouseRoom,
  getInHouseRoomChangeOptions,
} from "@/lib/in-house-room-change";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    return NextResponse.json(await getInHouseRoomChangeOptions(id));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load room options";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as { roomId?: string };
  const roomId = body.roomId?.trim();

  if (!roomId) {
    return NextResponse.json({ error: "roomId is required" }, { status: 400 });
  }

  try {
    const result = await changeInHouseRoom(id, roomId);

    revalidatePath("/");
    revalidatePath("/rooms");
    revalidatePath("/calendar");
    revalidatePath("/check-in");
    revalidatePath("/housekeeping");
    revalidatePath("/billing");
    revalidatePath("/guard");

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Room change failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
