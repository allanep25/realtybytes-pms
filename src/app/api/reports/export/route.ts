import { reportToCsv, reportToHtml } from "@/lib/report-export";
import { generateReport, type ReportType } from "@/lib/reports";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = (searchParams.get("type") ?? "DAILY_SALES") as ReportType;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const format = searchParams.get("format") ?? "csv";

  if (!from || !to) {
    return NextResponse.json({ error: "from and to required" }, { status: 400 });
  }

  try {
    const report = await generateReport(type, from, to);
    const slug = `${type.toLowerCase()}_${from}_${to}`;

    if (format === "pdf" || format === "html") {
      const html = reportToHtml(report);
      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="${slug}.html"`,
        },
      });
    }

    const csv = "\uFEFF" + reportToCsv(report);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}.csv"`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
