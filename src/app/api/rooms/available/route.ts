import { getAvailableRooms } from "@/lib/check-in-out";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const checkIn = searchParams.get("checkIn");
  const checkOut = searchParams.get("checkOut");

  if (!checkIn || !checkOut) {
    return NextResponse.json(
      { error: "checkIn and checkOut query params are required" },
      { status: 400 },
    );
  }

  try {
    const rooms = await getAvailableRooms(checkIn, checkOut);
    return NextResponse.json(rooms);
  } catch {
    return NextResponse.json({ error: "Failed to load rooms" }, { status: 500 });
  }
}
