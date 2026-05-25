import { getSession } from "@/lib/auth";
import { changeEmployeePassword } from "@/lib/login";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "All password fields are required" }, { status: 400 });
    }

    await changeEmployeePassword(session.id, currentPassword, newPassword);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Password change failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
