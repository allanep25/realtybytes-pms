import { performCheckOut, type CheckOutInput } from "@/lib/check-in-out";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckOutInput;
    const result = await performCheckOut(body);

    revalidatePath("/");
    revalidatePath("/rooms");
    revalidatePath("/calendar");
    revalidatePath("/check-in");
    revalidatePath("/housekeeping");
    revalidatePath("/billing");

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Check-out failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
