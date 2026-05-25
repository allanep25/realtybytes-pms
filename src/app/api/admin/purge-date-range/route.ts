import { purgeStaysInDateRange } from "@/lib/purge-date-range";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMINISTRATOR") {
    return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    dryRun?: boolean;
    fromDate?: string;
    toDate?: string;
  };

  const fromDate = body.fromDate?.trim();
  const toDate = body.toDate?.trim();

  if (!fromDate || !toDate) {
    return NextResponse.json({ error: "fromDate and toDate are required (YYYY-MM-DD)" }, { status: 400 });
  }

  const dryRun = body.dryRun === true;

  try {
    const results = await purgeStaysInDateRange(fromDate, toDate, { dryRun });

    if (!dryRun) {
      revalidatePath("/");
      revalidatePath("/calendar");
      revalidatePath("/check-in");
      revalidatePath("/rooms");
      revalidatePath("/billing");
      revalidatePath("/guests");
      revalidatePath("/reports");
      revalidatePath("/receipts");
    }

    return NextResponse.json({ dryRun, count: results.length, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Purge failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
