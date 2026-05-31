import { ExpensesWorkspace } from "@/components/expenses/ExpensesWorkspace";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { hotelCalendarDate } from "@/lib/dates";
import { getExpensesForDate } from "@/lib/expenses";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const today = hotelCalendarDate();
  const summary = await getExpensesForDate(today);

  return (
    <DashboardShell title="Expenses">
      <ExpensesWorkspace initialDate={today} initialSummary={summary} />
    </DashboardShell>
  );
}
