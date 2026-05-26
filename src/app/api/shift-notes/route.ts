import { getSession } from "@/lib/auth";
import { addShiftNote, getRecentShiftNotes } from "@/lib/shift-notes";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const notes = await getRecentShiftNotes();
  return NextResponse.json({ notes });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as { content?: string };
    const note = await addShiftNote(body.content ?? "", session.id);
    return NextResponse.json(note);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save note";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
