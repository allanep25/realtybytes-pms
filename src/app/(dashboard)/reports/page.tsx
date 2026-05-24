import { DashboardShell } from "@/components/layout/DashboardShell";
import { ReportsGenerator } from "@/components/reports/ReportsGenerator";
import { defaultReportRange } from "@/lib/reports";

export default function ReportsPage() {
  const { from, to } = defaultReportRange();

  return (
    <DashboardShell title="Reports">
      <ReportsGenerator defaultFrom={from} defaultTo={to} />
    </DashboardShell>
  );
}
