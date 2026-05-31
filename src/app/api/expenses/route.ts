import { getSession } from "@/lib/auth";
import { isAdministrator } from "@/lib/permissions";
import { createExpense, getExpensesForDate, type CreateExpenseInput } from "@/lib/expenses";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdministrator(session.role) && session.role !== "FRONT_DESK") {
    return NextResponse.json({ error: "Not allowed to view expenses" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "date query param is required" }, { status: 400 });
  }

  return NextResponse.json(await getExpensesForDate(date));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdministrator(session.role) && session.role !== "FRONT_DESK") {
    return NextResponse.json({ error: "Not allowed to record expenses" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as CreateExpenseInput;
    const expense = await createExpense(body, session.id);

    revalidatePath("/");
    revalidatePath("/expenses");
    revalidatePath("/end-of-day");
    revalidatePath("/reports");

    return NextResponse.json(expense);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to record expense";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
