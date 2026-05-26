import { getSession } from "@/lib/auth";
import { createMaintenanceBlock, type MaintenanceBlockInput } from "@/lib/check-in-out";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as MaintenanceBlockInput;
    const result = await createMaintenanceBlock(body, { employeeId: session.id });
    revalidatePath("/");
    revalidatePath("/calendar");
    revalidatePath("/rooms");
    revalidatePath("/housekeeping");
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to block room";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
