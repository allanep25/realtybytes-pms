import { addFolioLine } from "@/lib/billing";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const body = await request.json();
    const folio = await addFolioLine(id, {
      description: body.description,
      quantity: Number(body.quantity),
      rate: Number(body.rate),
    });

    revalidatePath("/billing");

    return NextResponse.json(folio);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to add charge";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
