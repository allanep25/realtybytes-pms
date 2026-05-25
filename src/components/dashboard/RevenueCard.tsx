import { formatPHP } from "@/lib/format";
import type { TodayRevenue } from "@/lib/reservations";
import { cn } from "@/lib/utils";

type RevenueCardProps = {
  revenue: TodayRevenue;
};

export function RevenueCard({ revenue }: RevenueCardProps) {
  const { today, changePercent, breakdown } = revenue;
  const positive = changePercent != null && changePercent >= 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">Today&apos;s Revenue</p>

      <ul className="mt-3 space-y-1.5 border-b border-slate-100 pb-3 text-sm">
        {breakdown.map((item) => (
          <li key={item.method} className="flex items-center justify-between gap-3">
            <span className="text-slate-600">{item.label}</span>
            <span
              className={cn(
                "font-medium tabular-nums",
                item.amount > 0 ? "text-slate-800" : "text-slate-400",
              )}
            >
              {formatPHP(item.amount)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-800">Total today</span>
        <span className="text-xl font-bold tabular-nums text-slate-900">{formatPHP(today)}</span>
      </div>

      {today === 0 ? (
        <p className="mt-2 text-sm text-slate-400">No payments yet today</p>
      ) : changePercent != null ? (
        <p
          className={cn(
            "mt-2 text-sm font-medium",
            positive ? "text-room-vacant" : "text-room-dirty",
          )}
        >
          {positive ? "+" : ""}
          {changePercent.toFixed(1)}% vs yesterday
        </p>
      ) : (
        <p className="mt-2 text-sm text-slate-400">First payment of the day</p>
      )}
    </div>
  );
}
