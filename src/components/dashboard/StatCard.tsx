import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  count: number;
  subtitle?: string;
  variant: "occupied" | "vacant" | "reserved" | "dirty";
  onClick?: () => void;
  active?: boolean;
};

const variants = {
  occupied: "border-l-room-occupied",
  vacant: "border-l-room-vacant",
  reserved: "border-l-room-reserved",
  dirty: "border-l-room-cleaning",
};

const countColors = {
  occupied: "text-room-occupied",
  vacant: "text-room-vacant",
  reserved: "text-room-reserved",
  dirty: "text-room-cleaning",
};

export function StatCard({ label, count, subtitle, variant, onClick, active }: StatCardProps) {
  const Component = onClick ? "button" : "div";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-xl border border-slate-200 bg-card p-4 shadow-sm border-l-4 text-left",
        variants[variant],
        onClick &&
          "cursor-pointer transition hover:border-slate-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-room-occupied/50",
        active && "ring-2 ring-slate-400 ring-offset-1",
      )}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cn("mt-0.5 text-2xl font-bold leading-tight", countColors[variant])}>{count}</p>
      {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      {onClick && <p className="mt-1 text-[10px] text-slate-400">Click to view rooms</p>}
    </Component>
  );
}
