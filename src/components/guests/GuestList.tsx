"use client";

import { cn } from "@/lib/utils";
import type { GuestListItem } from "@/lib/guests";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search, Star } from "lucide-react";

type GuestListProps = {
  guests: GuestListItem[];
  initialSearch?: string;
};

export function GuestList({ guests, initialSearch = "" }: GuestListProps) {
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {guests.length === 0 ? (
          <p className="col-span-full py-8 text-center text-slate-400">No guests found.</p>
        ) : (
          guests.map((guest) => (
            <Link
              key={guest.id}
              href={`/guests/${guest.id}`}
              className="rounded-xl border border-slate-200 bg-card p-4 shadow-sm transition hover:border-room-occupied/40 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800">{guest.fullName}</p>
                  {guest.contactNumber && (
                    <p className="mt-0.5 text-sm text-slate-500">{guest.contactNumber}</p>
                  )}
                </div>
                {guest.isVip && (
                  <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    <Star className="h-3 w-3 fill-current" />
                    VIP
                  </span>
                )}
              </div>
              <p className={cn("mt-2 text-xs text-slate-400")}>
                {guest.stayCount} stay{guest.stayCount !== 1 ? "s" : ""}
              </p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
