"use client";

import { RESERVATION_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { GuestHistoryGroup } from "@/lib/guests";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search, Star } from "lucide-react";

type GuestListProps = {
  groups: GuestHistoryGroup[];
  initialSearch?: string;
  canAdmin?: boolean;
};

export function GuestList({ groups, initialSearch = "", canAdmin = false }: GuestListProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    router.push(q ? `/guests?search=${encodeURIComponent(q)}` : "/guests");
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or ID…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-room-occupied focus:outline-none focus:ring-1 focus:ring-room-occupied"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-sidebar px-4 py-2 text-sm font-medium text-white hover:bg-sidebar-hover"
        >
          Search
        </button>
      </form>

      <p className="text-xs text-slate-500">
        Sorted by first stay date · repeat visits listed under each guest
      </p>

      <div className="space-y-3">
        {groups.length === 0 ? (
          <p className="py-8 text-center text-slate-400">No guests found.</p>
        ) : (
          groups.map((group) => (
            <article
              key={`${group.id}-${group.firstStayDate}`}
              className="rounded-xl border border-slate-200 bg-card shadow-sm"
            >
              <div className="border-b border-slate-100 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <Link
                    href={`/guests/${group.id}`}
                    className="min-w-0 flex-1 transition hover:opacity-80"
                  >
                    <p className="font-semibold text-slate-800">{group.fullName}</p>
                    {group.contactNumber && (
                      <p className="mt-0.5 text-sm text-slate-500">{group.contactNumber}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-400">
                      First stay {formatDate(group.firstStayDate)} · {group.stays.length} stay
                      {group.stays.length !== 1 ? "s" : ""}
                    </p>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    {canAdmin && (
                      <Link
                        href={`/guests/${group.id}?edit=1`}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </Link>
                    )}
                    {group.isVip && (
                      <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        <Star className="h-3 w-3 fill-current" />
                        VIP
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <ol className="divide-y divide-slate-50 px-4 py-2">
                {group.stays.map((stay, index) => (
                  <li
                    key={stay.reservationId}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                          index === 0
                            ? "bg-room-occupied/15 text-room-occupied"
                            : "bg-slate-100 text-slate-500",
                        )}
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800">
                          {formatDate(stay.checkIn)} – {formatDate(stay.checkOut)}
                        </p>
                        <p className="text-xs text-slate-500">
                          Room {stay.roomNumber} · {stay.nights} night
                          {stay.nights !== 1 ? "s" : ""}
                          {index === 0 ? " · First stay" : " · Return visit"}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {RESERVATION_STATUS_LABELS[stay.status] ?? stay.status}
                    </span>
                  </li>
                ))}
              </ol>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
