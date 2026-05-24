import { performCheckInFromReservation } from "@/lib/check-in-out";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await performCheckInFromReservation(id);

    revalidatePath("/");
    revalidatePath("/rooms");
    revalidatePath("/calendar");
    revalidatePath("/check-in");
    revalidatePath("/billing");

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Check-in failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
