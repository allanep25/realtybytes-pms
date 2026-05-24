import { removeFolioLine } from "@/lib/billing";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ lineId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const { lineId } = await context.params;

  try {
    const folio = await removeFolioLine(lineId);
    revalidatePath("/billing");
    return NextResponse.json(folio);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to remove line";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
