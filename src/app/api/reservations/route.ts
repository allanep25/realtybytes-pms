import { createReservation, type CreateReservationInput } from "@/lib/check-in-out";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as CreateReservationInput;
    const result = await createReservation(body, { employeeId: session.id });

    revalidatePath("/");
    revalidatePath("/rooms");
    revalidatePath("/calendar");
    revalidatePath("/check-in");
    revalidatePath("/guests");

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Reservation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
