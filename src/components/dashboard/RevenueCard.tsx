import { formatPHP } from "@/lib/format";
import type { TodayRevenue } from "@/lib/reservations";
import { cn } from "@/lib/utils";

type RevenueCardProps = {
  revenue: TodayRevenue;
};

export function RevenueCard({ revenue }: RevenueCardProps) {
  const { today, changePercent } = revenue;
  const positive = changePercent != null && changePercent >= 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">Today&apos;s Revenue</p>
      <p className="mt-0.5 text-xl font-bold text-slate-800">{formatPHP(today)}</p>
      {changePercent != null ? (
        <p
          className={cn(
            "mt-1 text-sm font-medium",
            positive ? "text-room-vacant" : "text-room-dirty",
          )}
        >
          {positive ? "+" : ""}
          {changePercent.toFixed(1)}% vs yesterday
        </p>
      ) : (
        <p className="mt-1 text-sm text-slate-400">No payments yesterday</p>
      )}
    </div>
  );
}
