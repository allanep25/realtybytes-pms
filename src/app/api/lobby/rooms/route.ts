import { getLobbyDisplayData, isValidLobbyDisplayKey } from "@/lib/lobby-display";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");

  if (!isValidLobbyDisplayKey(key)) {
    return NextResponse.json({ error: "Invalid display key" }, { status: 403 });
  }

  try {
    const data = await getLobbyDisplayData();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Could not load room status" }, { status: 500 });
  }
}
