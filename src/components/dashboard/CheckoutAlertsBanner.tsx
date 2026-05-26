import type { CheckoutAlert } from "@/lib/checkout-alerts";
import { cn } from "@/lib/utils";
import { AlertTriangle, Sparkles } from "lucide-react";
import Link from "next/link";

type CheckoutAlertsBannerProps = {
  alerts: CheckoutAlert[];
};

export function CheckoutAlertsBanner({ alerts }: CheckoutAlertsBannerProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-amber-900">Front desk alerts</h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {alerts.map((alert) => (
              <li key={alert.id} className="flex items-center gap-2 text-amber-900">
                {alert.type === "needs_cleaning" ? (
                  <Sparkles className="h-4 w-4 shrink-0 text-room-cleaning" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                )}
                <span>{alert.message}</span>
              </li>
            ))}
          </ul>
          <Link href="/housekeeping" className="mt-3 inline-block text-sm font-medium text-room-occupied hover:underline">
            Open housekeeping →
          </Link>
        </div>
      </div>
    </div>
  );
}
