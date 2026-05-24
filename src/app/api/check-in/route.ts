import { performCheckIn, type CheckInInput } from "@/lib/check-in-out";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckInInput;
    const result = await performCheckIn(body);

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
