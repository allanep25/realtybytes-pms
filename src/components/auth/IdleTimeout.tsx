"use client";

import { signOut } from "@/components/auth/sign-out";
import { SESSION_IDLE_TIMEOUT_MS } from "@/lib/auth-types";
import { useEffect, useRef } from "react";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll", "click"] as const;
const ACTIVITY_THROTTLE_MS = 1000;

export function IdleTimeout() {
  const lastActivityRef = useRef(Date.now());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signingOutRef = useRef(false);

  useEffect(() => {
    function clearIdleTimeout() {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    async function logoutForIdle() {
      if (signingOutRef.current) return;
      signingOutRef.current = true;
      await signOut({ reason: "idle" });
    }

    function scheduleIdleTimeout() {
      clearIdleTimeout();
      const remaining = SESSION_IDLE_TIMEOUT_MS - (Date.now() - lastActivityRef.current);
      timeoutRef.current = setTimeout(logoutForIdle, Math.max(remaining, 0));
    }

    function recordActivity() {
      const now = Date.now();
      if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return;
      lastActivityRef.current = now;
      scheduleIdleTimeout();
    }

    function checkIdleOnVisible() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastActivityRef.current >= SESSION_IDLE_TIMEOUT_MS) {
        void logoutForIdle();
        return;
      }
      scheduleIdleTimeout();
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, recordActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", checkIdleOnVisible);

    scheduleIdleTimeout();

    return () => {
      clearIdleTimeout();
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, recordActivity);
      }
      document.removeEventListener("visibilitychange", checkIdleOnVisible);
    };
  }, []);

  return null;
}
