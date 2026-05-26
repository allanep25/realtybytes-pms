import { getSession } from "@/lib/auth";
import { markReservationNoShow } from "@/lib/check-in-out";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await context.params;
    const result = await markReservationNoShow(id, { employeeId: session.id });
    revalidatePath("/");
    revalidatePath("/calendar");
    revalidatePath("/check-in");
    revalidatePath("/rooms");
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "No-show update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
