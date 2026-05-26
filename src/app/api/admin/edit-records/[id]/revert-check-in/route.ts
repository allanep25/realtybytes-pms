import { adminRevertCheckIn } from "@/lib/admin-edit";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session || session.role !== "ADMINISTRATOR") {
    return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const result = await adminRevertCheckIn(id);

    revalidatePath("/");
    revalidatePath("/calendar");
    revalidatePath("/check-in");
    revalidatePath("/guests");
    revalidatePath("/billing");
    revalidatePath("/lobby");

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Revert failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
