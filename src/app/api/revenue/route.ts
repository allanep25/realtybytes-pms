import { getSession } from "@/lib/auth";
import { canViewDashboardRevenue } from "@/lib/permissions";
import { getRevenueForPeriod } from "@/lib/revenue";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canViewDashboardRevenue(session.role)) {
    return NextResponse.json({ error: "Not allowed to view revenue" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to") ?? from;

  if (!from) {
    return NextResponse.json({ error: "from date is required" }, { status: 400 });
  }

  try {
    const summary = await getRevenueForPeriod(from, to ?? from);
    return NextResponse.json(summary);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load revenue";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
