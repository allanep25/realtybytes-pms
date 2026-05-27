import { performCheckInFromReservation } from "@/lib/check-in-out";
import { getSession } from "@/lib/auth";
import { canWalkInCheckIn } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canWalkInCheckIn(session.role)) {
    return NextResponse.json({ error: "Not allowed to check in guests" }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await performCheckInFromReservation(
      { reservationId: id, ...body },
      { employeeId: session.id },
    );

    revalidatePath("/");
    revalidatePath("/rooms");
    revalidatePath("/calendar");
    revalidatePath("/check-in");
    revalidatePath("/billing");
    revalidatePath("/guard");
    revalidatePath("/guard");

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Check-in failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
