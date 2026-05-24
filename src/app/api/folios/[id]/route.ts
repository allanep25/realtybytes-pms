import { getFolioById, updateFolio } from "@/lib/billing";
import type { PaymentMethod } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const folio = await getFolioById(id);

  if (!folio) {
    return NextResponse.json({ error: "Folio not found" }, { status: 404 });
  }

  return NextResponse.json(folio);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const body = await request.json();
    const folio = await updateFolio(id, {
      discount: body.discount,
      paymentAmount: body.paymentAmount,
      paymentMethod: body.paymentMethod as PaymentMethod | undefined,
    });

    revalidatePath("/billing");
    revalidatePath("/");

    return NextResponse.json(folio);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
