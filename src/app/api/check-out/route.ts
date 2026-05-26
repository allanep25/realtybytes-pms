import {
  getReservationBalanceDue,
  performCheckOut,
  type CheckOutInput,
} from "@/lib/check-in-out";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as CheckOutInput;

    const balanceDue = await getReservationBalanceDue(body.reservationId);
    if (balanceDue > 0.001) {
      return NextResponse.json(
        {
          error: `Collect the full balance of PHP ${balanceDue.toFixed(2)} before checking out this guest.`,
        },
        { status: 400 },
      );
    }

    const result = await performCheckOut(body, { employeeId: session.id });

    revalidatePath("/");
    revalidatePath("/rooms");
    revalidatePath("/calendar");
    revalidatePath("/check-in");
    revalidatePath("/housekeeping");
    revalidatePath("/billing");
    revalidatePath("/guard");

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Check-out failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
