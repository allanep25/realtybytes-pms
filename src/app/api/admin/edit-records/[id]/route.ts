import {
  adminDeleteReservation,
  adminUpdateReservationRecord,
  getEditableReservation,
  type AdminUpdateRecordInput,
} from "@/lib/admin-edit";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session || session.role !== "ADMINISTRATOR") {
    return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  }

  const { id } = await context.params;
  const record = await getEditableReservation(id);

  if (!record) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  return NextResponse.json(record);
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session || session.role !== "ADMINISTRATOR") {
    return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const body = (await request.json()) as AdminUpdateRecordInput;
    const record = await adminUpdateReservationRecord(id, {
      ...body,
      paymentRecordedById: session.id,
    });

    revalidatePath("/");
    revalidatePath("/calendar");
    revalidatePath("/check-in");
    revalidatePath("/guests");
    revalidatePath("/billing");
    revalidatePath("/settings/edit-records");

    return NextResponse.json(record);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session || session.role !== "ADMINISTRATOR") {
    return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const result = await adminDeleteReservation(id);

    revalidatePath("/");
    revalidatePath("/calendar");
    revalidatePath("/check-in");
    revalidatePath("/guests");
    revalidatePath("/billing");
    revalidatePath("/settings/edit-records");
    revalidatePath("/lobby");

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
