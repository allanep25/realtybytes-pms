import { getReportStaffOptions } from "@/lib/reports";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(await getReportStaffOptions());
}
