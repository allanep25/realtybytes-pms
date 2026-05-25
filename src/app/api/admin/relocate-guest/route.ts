import { relocateGuestToRoom } from "@/lib/room-relocation";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMINISTRATOR") {
    return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  }

  const body = (await request.json()) as {
    fromRoomNumber?: string;
    toRoomNumber?: string;
    maintenanceNote?: string;
    dryRun?: boolean;
  };

  const fromRoomNumber = body.fromRoomNumber?.trim();
  const toRoomNumber = body.toRoomNumber?.trim();

  if (!fromRoomNumber || !toRoomNumber) {
    return NextResponse.json({ error: "fromRoomNumber and toRoomNumber are required" }, { status: 400 });
  }

  try {
    const result = await relocateGuestToRoom({
      fromRoomNumber,
      toRoomNumber,
      maintenanceNote: body.maintenanceNote,
      dryRun: body.dryRun === true,
    });

    if (!body.dryRun) {
      revalidatePath("/");
      revalidatePath("/rooms");
      revalidatePath("/calendar");
      revalidatePath("/check-in");
      revalidatePath("/housekeeping");
      revalidatePath("/billing");
    }

    return NextResponse.json({ dryRun: body.dryRun === true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Relocation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
