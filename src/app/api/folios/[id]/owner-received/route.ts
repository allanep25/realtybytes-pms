import { setFolioOwnerReceived } from "@/lib/billing";
import { getSession } from "@/lib/auth";
import { isAdministrator } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdministrator(session.role)) {
    return NextResponse.json(
      { error: "Only an administrator can confirm money received from the front desk." },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const folio = await setFolioOwnerReceived(id, Boolean(body.received), session.id);
    if (!folio) {
      return NextResponse.json({ error: "Folio not found" }, { status: 404 });
    }

    revalidatePath("/");
    revalidatePath("/billing");

    return NextResponse.json(folio);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
