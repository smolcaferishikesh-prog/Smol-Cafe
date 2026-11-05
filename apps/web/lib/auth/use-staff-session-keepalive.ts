"use client";

import { useEffect } from "react";
import {
  getActiveStaffSessionAction,
  restoreStaffSessionAction,
  staffBackdoorLogoutAction,
} from "@/app/smol-backdoor/actions";

export const STAFF_SESSION_STORAGE_KEY = "smol_staff_session_12h";
export const STAFF_SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

interface StoredStaffSession12h {
  role: "kitchen" | "barista" | "cashier" | "admin";
  redirectTo: string;
  issuedAt: number;
  expiresAt: number;
}

const ROLE_REDIRECT_MAP: Record<
  "kitchen" | "barista" | "cashier" | "admin",
  string
> = {
  kitchen: "/smol-backdoor/kitchen",
  barista: "/smol-backdoor/barista",
  cashier: "/smol-backdoor/cashier",
  admin: "/smol-backdoor/admin",
};

/**
 * Client-side hook that ensures any logged-in staff role (admin, cashier, barista, kitchen)
 * stays authenticated continuously for a full 12 hours without premature auto-logout
 * (even across tab sleep, backgrounding, or serverless cold starts), and only logs out
 * after 12 hours have elapsed or when the user explicitly clicks Logout.
 */
export function useStaffSessionKeepAlive(
  stationRole: "kitchen" | "barista" | "cashier" | "admin"
): void {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let isMounted = true;
    let expiryTimer: ReturnType<typeof setTimeout> | null = null;
    let keepAliveInterval: ReturnType<typeof setInterval> | null = null;

    const scheduleExpiry = (expiresAt: number) => {
      if (expiryTimer) clearTimeout(expiryTimer);
      const remainingMs = expiresAt - Date.now();
      if (remainingMs <= 0) {
        try {
          localStorage.removeItem(STAFF_SESSION_STORAGE_KEY);
          sessionStorage.removeItem("smol_admin_auth");
        } catch {}
        void staffBackdoorLogoutAction();
        return;
      }
      // Schedule auto-logout strictly after 12 hours have elapsed
      expiryTimer = setTimeout(() => {
        if (!isMounted) return;
        try {
          localStorage.removeItem(STAFF_SESSION_STORAGE_KEY);
          sessionStorage.removeItem("smol_admin_auth");
        } catch {}
        void staffBackdoorLogoutAction();
      }, Math.min(remainingMs, 2147483647));
    };

    const syncSession = async () => {
      if (!isMounted) return;
      try {
        const now = Date.now();
        let stored: StoredStaffSession12h | null = null;

        try {
          const raw = localStorage.getItem(STAFF_SESSION_STORAGE_KEY);
          if (raw) {
            stored = JSON.parse(raw) as StoredStaffSession12h;
          }
        } catch {}

        // If stored session exists and has exceeded 12 hours -> log out now
        if (
          stored &&
          stored.issuedAt &&
          (now - stored.issuedAt >= STAFF_SESSION_DURATION_MS ||
            (stored.expiresAt && now >= stored.expiresAt))
        ) {
          try {
            localStorage.removeItem(STAFF_SESSION_STORAGE_KEY);
            sessionStorage.removeItem("smol_admin_auth");
          } catch {}
          await staffBackdoorLogoutAction();
          return;
        }

        // Check server cookie state
        const serverSession = await getActiveStaffSessionAction();
        if (!isMounted) return;

        if (serverSession.active && serverSession.role) {
          const issuedAt =
            stored?.issuedAt || serverSession.issuedAt || now;
          const expiresAt = issuedAt + STAFF_SESSION_DURATION_MS;

          if (now >= expiresAt) {
            try {
              localStorage.removeItem(STAFF_SESSION_STORAGE_KEY);
              sessionStorage.removeItem("smol_admin_auth");
            } catch {}
            await staffBackdoorLogoutAction();
            return;
          }

          const updated: StoredStaffSession12h = {
            role: serverSession.role,
            redirectTo:
              serverSession.redirectTo ||
              ROLE_REDIRECT_MAP[serverSession.role],
            issuedAt,
            expiresAt,
          };
          try {
            localStorage.setItem(
              STAFF_SESSION_STORAGE_KEY,
              JSON.stringify(updated)
            );
          } catch {}
          scheduleExpiry(expiresAt);
          return;
        }

        // If cookie was dropped by browser sleep before 12 hours, restore it seamlessly
        const fallbackRole = stored?.role || stationRole;
        const fallbackIssuedAt = stored?.issuedAt || now;
        if (now - fallbackIssuedAt < STAFF_SESSION_DURATION_MS) {
          const restored = await restoreStaffSessionAction(
            fallbackRole,
            fallbackIssuedAt
          );
          if (isMounted && restored.success) {
            const expiresAt =
              restored.expiresAt ||
              fallbackIssuedAt + STAFF_SESSION_DURATION_MS;
            try {
              localStorage.setItem(
                STAFF_SESSION_STORAGE_KEY,
                JSON.stringify({
                  role: fallbackRole,
                  redirectTo:
                    restored.redirectTo || ROLE_REDIRECT_MAP[fallbackRole],
                  issuedAt: fallbackIssuedAt,
                  expiresAt,
                } satisfies StoredStaffSession12h)
              );
            } catch {}
            scheduleExpiry(expiresAt);
          }
        }
      } catch {
        // Ignore transient network errors during keep-alive so user is never logged out offline
      }
    };

    void syncSession();

    // Periodically verify/keep-alive every 5 minutes while within the 12-hour window
    keepAliveInterval = setInterval(() => {
      void syncSession();
    }, 5 * 60 * 1000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void syncSession();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      isMounted = false;
      if (expiryTimer) clearTimeout(expiryTimer);
      if (keepAliveInterval) clearInterval(keepAliveInterval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [stationRole]);
}
