import { getSession } from "@/lib/auth";
import { getHotelSettings, updateHotelSettings } from "@/lib/settings";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMINISTRATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await getHotelSettings();
  return NextResponse.json(settings);
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMINISTRATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const settings = await updateHotelSettings(body);

    revalidatePath("/settings");
    revalidatePath("/receipts");

    return NextResponse.json(settings);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
