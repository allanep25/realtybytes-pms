import type { CheckoutAlert } from "@/lib/checkout-alerts";
import { cn } from "@/lib/utils";
import { AlertTriangle, Sparkles } from "lucide-react";
import Link from "next/link";

type CheckoutAlertsBannerProps = {
  alerts: CheckoutAlert[];
};

function groupAlerts(alerts: CheckoutAlert[]) {
  const departures = alerts.filter((a) => a.type === "departure_pending");
  const cleaning = alerts.filter((a) => a.type === "needs_cleaning");
  return { departures, cleaning };
}

export function CheckoutAlertsBanner({ alerts }: CheckoutAlertsBannerProps) {
  if (alerts.length === 0) return null;

  const { departures, cleaning } = groupAlerts(alerts);

  return (
    <div className="mb-4 rounded-xl border border-slate-200 border-l-4 border-l-amber-500 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <h3 className="font-semibold text-slate-800">Front desk alerts</h3>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            {alerts.length}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
          {departures.length > 0 && (
            <Link href="/check-in?tab=check-out" className="text-slate-600 hover:text-room-occupied hover:underline">
              Open check-out →
            </Link>
          )}
          {cleaning.length > 0 && (
            <Link href="/housekeeping" className="text-slate-600 hover:text-room-cleaning hover:underline">
              Open housekeeping →
            </Link>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {departures.map((alert) => (
          <span
            key={alert.id}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-sm text-amber-950"
          >
            <span className="font-semibold">Rm {alert.roomNumber}</span>
            <span className="text-amber-800/80">·</span>
            <span className="truncate">{alert.message.replace(/^Room \d+ · /, "")}</span>
          </span>
        ))}
        {cleaning.map((alert) => (
          <span
            key={alert.id}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-sm text-sky-950",
            )}
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-room-cleaning" />
            <span className="font-semibold">Rm {alert.roomNumber}</span>
            <span className="text-sky-800/80">·</span>
            <span>needs cleaning</span>
          </span>
        ))}
      </div>
    </div>
  );
}
