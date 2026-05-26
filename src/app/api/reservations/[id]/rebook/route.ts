import { getSession } from "@/lib/auth";
import { rebookReservation } from "@/lib/reservation-changes";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      checkIn?: string;
      checkOut?: string;
      reason?: string;
    };

    if (!body.checkIn || !body.checkOut) {
      return NextResponse.json({ error: "Check-in and check-out dates are required" }, { status: 400 });
    }

    const result = await rebookReservation(
      id,
      { employeeId: session.id },
      {
        checkIn: body.checkIn,
        checkOut: body.checkOut,
        reason: body.reason ?? "",
      },
    );

    revalidatePath("/");
    revalidatePath("/calendar");
    revalidatePath("/check-in");
    revalidatePath("/rooms");
    revalidatePath("/billing");
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Rebook failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
