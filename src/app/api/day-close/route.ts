import { getSession } from "@/lib/auth";
import { getDayCloseSummary, saveDayClose, type SaveDayCloseInput } from "@/lib/day-close";
import { hotelCalendarDate } from "@/lib/dates";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? hotelCalendarDate();
  const summary = await getDayCloseSummary(date);
  return NextResponse.json(summary);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as SaveDayCloseInput;
    await saveDayClose(body, session.id);
    const summary = await getDayCloseSummary(body.businessDate);
    return NextResponse.json(summary);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save day close";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
