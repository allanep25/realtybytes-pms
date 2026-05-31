import { generateReport, type ReportType } from "@/lib/reports";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = (searchParams.get("type") ?? "DAILY_SALES") as ReportType;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const staffId = searchParams.get("staffId");

  if (!from || !to) {
    return NextResponse.json(
      { error: "from and to query params are required" },
      { status: 400 },
    );
  }

  try {
    const report = await generateReport(type, from, to, { staffId });
    return NextResponse.json(report);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to generate report";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
