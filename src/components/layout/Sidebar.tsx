"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { NAV_ITEMS } from "@/lib/constants";
import { filterNavItems } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Flower2, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarProps = {
  hotelName?: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export function Sidebar({
  hotelName = "Amar Residence",
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const user = useAuth();
  const items = filterNavItems(user.role, NAV_ITEMS);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-sidebar text-slate-200 transition-transform duration-200 ease-out",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-room-vacant/20 text-room-vacant">
            <Flower2 className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-white">{hotelName}</p>
            <p className="text-[10px] font-medium tracking-[0.2em] text-slate-400">HOTEL</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onMobileClose}
          className="rounded-lg p-1.5 text-slate-300 hover:bg-sidebar-hover hover:text-white lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {items.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onMobileClose}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-sidebar-active font-medium text-white"
                      : "text-slate-300 hover:bg-sidebar-hover hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
