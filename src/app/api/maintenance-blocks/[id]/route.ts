import { getSession } from "@/lib/auth";
import { cancelMaintenanceBlock } from "@/lib/check-in-out";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await context.params;
    const result = await cancelMaintenanceBlock(id);
    revalidatePath("/");
    revalidatePath("/calendar");
    revalidatePath("/rooms");
    revalidatePath("/housekeeping");
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to remove block";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
