import { backdateTodayArrivalsToCheckout } from "@/lib/backdate-arrivals";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMINISTRATOR") {
    return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { dryRun?: boolean };
  const dryRun = body.dryRun === true;

  try {
    const results = await backdateTodayArrivalsToCheckout({ dryRun });

    if (!dryRun) {
      revalidatePath("/");
      revalidatePath("/calendar");
      revalidatePath("/check-in");
      revalidatePath("/rooms");
      revalidatePath("/billing");
    }

    return NextResponse.json({ dryRun, count: results.length, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Backdate failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
