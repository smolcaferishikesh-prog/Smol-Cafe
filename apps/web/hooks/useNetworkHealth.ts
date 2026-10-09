"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface NetworkHealthState {
  isOnline: boolean;
  isBackendReachable: boolean;
  isDegraded: boolean;
  lastCheckedAt: Date | null;
  checkHealth: () => Promise<void>;
}

// Global cached state & timestamp to avoid duplicate concurrent pings across components
let globalLastCheckTime = 0;
let globalIsOnline = true;
let globalIsBackendReachable = true;

/**
 * Hook to detect client offline status and backend outage for graceful degradation
 * Throttled to prevent unnecessary continuous API pings.
 */
export function useNetworkHealth(): NetworkHealthState {
  const [isOnline, setIsOnline] = useState<boolean>(globalIsOnline);
  const [isBackendReachable, setIsBackendReachable] = useState<boolean>(globalIsBackendReachable);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const isCheckingRef = useRef(false);

  const checkHealth = useCallback(async (force = false) => {
    const now = Date.now();
    const navOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (!navOnline) {
      globalIsOnline = false;
      globalIsBackendReachable = false;
      setIsOnline(false);
      setIsBackendReachable(false);
      setLastCheckedAt(new Date());
      return;
    }

    // Throttle: Skip if checked within last 30 seconds unless forced or currently offline
    if (!force && now - globalLastCheckTime < 30000 && globalIsBackendReachable && globalIsOnline) {
      return;
    }

    if (isCheckingRef.current) return;
    isCheckingRef.current = true;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch("/api/health", {
        method: "GET",
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeoutId);

      globalLastCheckTime = Date.now();

      if (res.ok) {
        globalIsOnline = true;
        globalIsBackendReachable = true;
        setIsOnline(true);
        setIsBackendReachable(true);
      } else {
        const navOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
        globalIsOnline = navOnline;
        globalIsBackendReachable = true;
        setIsOnline(navOnline);
        setIsBackendReachable(true);
      }
      setLastCheckedAt(new Date());
    } catch {
      globalLastCheckTime = Date.now();
      const navOnline = typeof navigator !== "undefined" ? navigator.onLine : false;
      globalIsOnline = navOnline;
      globalIsBackendReachable = false;
      setIsOnline(navOnline);
      setIsBackendReachable(false);
      setLastCheckedAt(new Date());
    } finally {
      isCheckingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      globalIsOnline = true;
      setIsOnline(true);
      checkHealth(true);
    };

    const handleOffline = () => {
      globalIsOnline = false;
      globalIsBackendReachable = false;
      setIsOnline(false);
      setIsBackendReachable(false);
    };

    const handleFocus = () => {
      // Lazy check on focus only if window was unfocused for a long time (> 60s)
      if (Date.now() - globalLastCheckTime > 60000) {
        checkHealth();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", handleFocus);

    // Initial check (throttled) and calm 60s background health probe
    checkHealth();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        checkHealth();
      }
    }, 60000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
  }, [checkHealth]);

  return {
    isOnline,
    isBackendReachable,
    isDegraded: !isOnline || !isBackendReachable,
    lastCheckedAt,
    checkHealth: () => checkHealth(true),
  };
}
