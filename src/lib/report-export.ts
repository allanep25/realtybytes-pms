import { formatPHP } from "@/lib/format";
import type { ReportSummary } from "@/lib/reports";

export function reportToCsv(report: ReportSummary): string {
  const lines: string[] = [
    report.label,
    `Period,${report.from.slice(0, 10)} to ${report.to.slice(0, 10)}`,
    "",
    "Metric,Value",
    ...(report.type === "EXPENSES"
      ? [
          `Total Expenses,${report.totalRevenue.toFixed(2)}`,
          `Expense Entries,${report.totalTransactions}`,
        ]
      : [
          `Room Revenue,${report.totalRevenue.toFixed(2)}`,
          `Collected,${report.totalCollected.toFixed(2)}`,
          `Guest Stays,${report.totalTransactions}`,
          `Occupancy Rate,${report.occupancyRate.toFixed(2)}%`,
          `ADR,${report.adr.toFixed(2)}`,
        ]),
    "",
    "Detail,Date,Amount",
  ];

  for (const row of report.rows) {
    lines.push(
      `"${row.label.replace(/"/g, '""')}","${row.value}",${row.amount != null ? row.amount.toFixed(2) : ""}`,
    );
  }

  return lines.join("\n");
}

export function reportToHtml(report: ReportSummary): string {
  const from = report.from.slice(0, 10);
  const to = report.to.slice(0, 10);

  const detailRows = report.rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.label)}</td><td>${escapeHtml(r.value)}</td><td style="text-align:right">${r.amount != null ? escapeHtml(formatPHP(r.amount)) : ""}</td></tr>`,
    )
    .join("");

  const statCards =
    report.type === "EXPENSES"
      ? `<div class="stat"><label>Total Expenses</label><value>${escapeHtml(formatPHP(report.totalRevenue))}</value></div>
    <div class="stat"><label>Expense Entries</label><value>${report.totalTransactions}</value></div>`
      : `<div class="stat"><label>Room Revenue</label><value>${escapeHtml(formatPHP(report.totalRevenue))}</value></div>
    <div class="stat"><label>Collected</label><value>${escapeHtml(formatPHP(report.totalCollected))}</value></div>
    <div class="stat"><label>Guest Stays</label><value>${report.totalTransactions}</value></div>
    <div class="stat"><label>Occupancy Rate</label><value>${report.occupancyRate.toFixed(2)}%</value></div>
    <div class="stat"><label>ADR</label><value>${escapeHtml(formatPHP(report.adr))}</value></div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(report.label)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; color: #1a233a; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .meta { color: #666; font-size: 12px; margin-bottom: 24px; }
    .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 24px; }
    .stat { border: 1px solid #ddd; padding: 12px; border-radius: 8px; }
    .stat label { display: block; font-size: 11px; color: #666; text-transform: uppercase; }
    .stat value { display: block; font-size: 18px; font-weight: bold; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border-bottom: 1px solid #eee; padding: 8px; text-align: left; }
    th { background: #f4f6f9; font-size: 11px; text-transform: uppercase; color: #666; }
  </style>
</head>
<body>
  <h1>Amar Residence — ${escapeHtml(report.label)}</h1>
  <p class="meta">Period: ${from} to ${to} · Generated ${new Date().toLocaleString("en-PH")}</p>
  <div class="stats">
    ${statCards}
  </div>
  <table>
    <thead><tr><th>Detail</th><th>Info</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${detailRows}</tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
