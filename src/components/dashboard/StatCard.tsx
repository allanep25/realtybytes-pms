import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  count: number;
  subtitle?: string;
  variant: "occupied" | "vacant" | "reserved" | "dirty";
};

const variants = {
  occupied: "border-l-room-occupied",
  vacant: "border-l-room-vacant",
  reserved: "border-l-room-reserved",
  dirty: "border-l-room-dirty",
};

const countColors = {
  occupied: "text-room-occupied",
  vacant: "text-room-vacant",
  reserved: "text-room-reserved",
  dirty: "text-room-dirty",
};

export function StatCard({ label, count, subtitle, variant }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-card p-4 shadow-sm border-l-4",
        variants[variant],
      )}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cn("mt-0.5 text-2xl font-bold leading-tight", countColors[variant])}>{count}</p>
      {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
}
