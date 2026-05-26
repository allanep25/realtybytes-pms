import { listTodayEditableReservations, searchEditableReservations } from "@/lib/admin-edit";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMINISTRATOR") {
    return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const scope = searchParams.get("scope");

  const results = query
    ? await searchEditableReservations(query)
    : scope === "today" || !query
      ? await listTodayEditableReservations()
      : [];
  return NextResponse.json({ results });
}
