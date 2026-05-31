"use client";

import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const TRIGGER_DISTANCE = 90;

export function PullToRefresh() {
  const router = useRouter();
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    function canStartPull(event: TouchEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return false;
      if (target.closest("input, textarea, select, button")) return false;
      return window.scrollY <= 0;
    }

    function handleTouchStart(event: TouchEvent) {
      if (event.touches.length !== 1 || !canStartPull(event)) {
        startY.current = null;
        pulling.current = false;
        return;
      }

      startY.current = event.touches[0].clientY;
      pulling.current = true;
    }

    function handleTouchMove(event: TouchEvent) {
      if (!pulling.current || startY.current == null || window.scrollY > 0) return;

      const delta = event.touches[0].clientY - startY.current;
      if (delta <= 0) {
        setDistance(0);
        return;
      }

      setDistance(Math.min(delta * 0.6, 120));
    }

    function handleTouchEnd() {
      if (!pulling.current) return;

      const shouldRefresh = distance >= TRIGGER_DISTANCE;
      startY.current = null;
      pulling.current = false;

      if (shouldRefresh) {
        setRefreshing(true);
        router.refresh();
        if ("vibrate" in navigator) navigator.vibrate(30);
        window.setTimeout(() => {
          setRefreshing(false);
          setDistance(0);
        }, 900);
        return;
      }

      setDistance(0);
    }

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [distance, router]);

  const visible = distance > 8 || refreshing;
  const ready = distance >= TRIGGER_DISTANCE;

  return (
    <div
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed left-1/2 top-3 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-lg transition",
        visible ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0",
      )}
      style={{ transform: `translate(-50%, ${visible ? Math.min(distance / 3, 28) : -24}px)` }}
    >
      <RefreshCw
        className={cn(
          "h-4 w-4 text-room-cleaning",
          (refreshing || ready) && "animate-spin",
        )}
      />
      <span>{refreshing ? "Refreshing..." : ready ? "Release to refresh" : "Pull to refresh"}</span>
    </div>
  );
}
