import { formatTime } from "@/lib/format";
import type { ActivityItem } from "@/lib/reservations";
import Link from "next/link";

type ActivityListProps = {
  title: string;
  items: ActivityItem[];
  viewAllHref?: string;
  emptyMessage?: string;
};

export function ActivityList({
  title,
  items,
  viewAllHref,
  emptyMessage = "None scheduled",
}: ActivityListProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">{title}</h3>
        {viewAllHref && items.length > 0 && (
          <Link href={viewAllHref} className="text-xs text-room-occupied hover:underline">
            View all
          </Link>
        )}
      </div>
      <ul className="mt-2 space-y-1.5 text-sm">
        {items.length === 0 ? (
          <li className="text-slate-400">{emptyMessage}</li>
        ) : (
          items.map((item, index) => (
            <li
              key={item.id}
              className={
                index < items.length - 1 ? "flex justify-between border-b border-slate-100 pb-2" : "flex justify-between"
              }
            >
              <span className="font-medium text-slate-800">{item.guestName}</span>
              <span className="text-slate-500">
                Rm {item.roomNumber} · {formatTime(item.time)}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
