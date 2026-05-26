import { performCheckIn, type CheckInInput } from "@/lib/check-in-out";
import { getSession } from "@/lib/auth";
import { canWalkInCheckIn } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canWalkInCheckIn(session.role)) {
    return NextResponse.json({ error: "Not allowed to check in guests" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as CheckInInput;
    const result = await performCheckIn(body, { employeeId: session.id });

    revalidatePath("/");
    revalidatePath("/rooms");
    revalidatePath("/calendar");
    revalidatePath("/check-in");
    revalidatePath("/billing");
    revalidatePath("/guard");

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Check-in failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
