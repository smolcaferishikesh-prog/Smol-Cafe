"use client";

import { useEffect } from "react";
import {
  getActiveStaffSessionAction,
  restoreStaffSessionAction,
  staffBackdoorLogoutAction,
} from "@/app/smol-backdoor/actions";

export const STAFF_SESSION_STORAGE_KEY = "smol_staff_session_12h";
export const STAFF_ROLE_STORAGE_PREFIX = "smol_staff_session_12h_";
export const STAFF_SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

export interface StoredStaffSession12h {
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

export function getRoleStorageKey(
  role: "kitchen" | "barista" | "cashier" | "admin"
): string {
  return `${STAFF_ROLE_STORAGE_PREFIX}${role}`;
}

export function saveRoleSessionToLocalStorage(
  session: StoredStaffSession12h
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      getRoleStorageKey(session.role),
      JSON.stringify(session)
    );
    localStorage.setItem(STAFF_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {}
}

export function clearRoleSessionFromLocalStorage(
  role?: "kitchen" | "barista" | "cashier" | "admin"
): void {
  if (typeof window === "undefined") return;
  try {
    if (role) {
      localStorage.removeItem(getRoleStorageKey(role));
      const raw = localStorage.getItem(STAFF_SESSION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredStaffSession12h;
        if (parsed?.role === role) {
          localStorage.removeItem(STAFF_SESSION_STORAGE_KEY);
        }
      }
      if (role === "admin") {
        sessionStorage.removeItem("smol_admin_auth");
      }
    } else {
      for (const r of ["admin", "cashier", "barista", "kitchen"] as const) {
        localStorage.removeItem(getRoleStorageKey(r));
      }
      localStorage.removeItem(STAFF_SESSION_STORAGE_KEY);
      sessionStorage.removeItem("smol_admin_auth");
    }
  } catch {}
}

export function getAllStoredRoleSessionsFromLocalStorage(): StoredStaffSession12h[] {
  if (typeof window === "undefined") return [];
  const now = Date.now();
  const list: StoredStaffSession12h[] = [];
  for (const r of ["admin", "cashier", "barista", "kitchen"] as const) {
    try {
      const raw = localStorage.getItem(getRoleStorageKey(r));
      if (!raw) continue;
      const parsed = JSON.parse(raw) as StoredStaffSession12h;
      if (
        parsed &&
        parsed.role === r &&
        parsed.issuedAt &&
        now - parsed.issuedAt < STAFF_SESSION_DURATION_MS &&
        (!parsed.expiresAt || now < parsed.expiresAt)
      ) {
        list.push(parsed);
      } else {
        localStorage.removeItem(getRoleStorageKey(r));
      }
    } catch {}
  }
  return list.sort((a, b) => b.issuedAt - a.issuedAt);
}

/**
 * Client-side hook that keeps each open role tab (`admin`, `cashier`, `barista`, `kitchen`)
 * independently authenticated for 12 hours without ever logging out or overwriting
 * any other role open at the same time in other tabs/windows.
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
        clearRoleSessionFromLocalStorage(stationRole);
        void staffBackdoorLogoutAction(stationRole);
        return;
      }
      // Schedule auto-logout strictly after 12 hours have elapsed for this role
      expiryTimer = setTimeout(() => {
        if (!isMounted) return;
        clearRoleSessionFromLocalStorage(stationRole);
        void staffBackdoorLogoutAction(stationRole);
      }, Math.min(remainingMs, 2147483647));
    };

    const syncSession = async () => {
      if (!isMounted) return;
      try {
        const now = Date.now();
        let stored: StoredStaffSession12h | null = null;

        try {
          const rawRole = localStorage.getItem(getRoleStorageKey(stationRole));
          if (rawRole) {
            stored = JSON.parse(rawRole) as StoredStaffSession12h;
          }
        } catch {}

        // If stored session for THIS role exists and has exceeded 12 hours -> log out only this role
        if (
          stored &&
          stored.issuedAt &&
          (now - stored.issuedAt >= STAFF_SESSION_DURATION_MS ||
            (stored.expiresAt && now >= stored.expiresAt))
        ) {
          clearRoleSessionFromLocalStorage(stationRole);
          await staffBackdoorLogoutAction(stationRole);
          return;
        }

        // Check server multi-role cookie state for this stationRole
        const serverSession = await getActiveStaffSessionAction(stationRole);
        if (!isMounted) return;

        const matchingServerEntry =
          serverSession.activeSessions?.find((s) => s.role === stationRole) ||
          serverSession.activeSessions?.find((s) => s.role === "admin");

        if (matchingServerEntry) {
          const issuedAt =
            stored?.issuedAt || matchingServerEntry.issuedAt || now;
          const expiresAt = issuedAt + STAFF_SESSION_DURATION_MS;

          if (now >= expiresAt) {
            clearRoleSessionFromLocalStorage(stationRole);
            await staffBackdoorLogoutAction(stationRole);
            return;
          }

          saveRoleSessionToLocalStorage({
            role: stationRole,
            redirectTo: ROLE_REDIRECT_MAP[stationRole],
            issuedAt,
            expiresAt,
          });
          scheduleExpiry(expiresAt);
          return;
        }

        // Ensure this stationRole is registered in the multi-role cookie without disturbing other roles
        const fallbackIssuedAt = stored?.issuedAt || now;
        if (now - fallbackIssuedAt < STAFF_SESSION_DURATION_MS) {
          const restored = await restoreStaffSessionAction(
            stationRole,
            fallbackIssuedAt
          );
          if (isMounted && restored.success) {
            const expiresAt =
              restored.expiresAt ||
              fallbackIssuedAt + STAFF_SESSION_DURATION_MS;
            saveRoleSessionToLocalStorage({
              role: stationRole,
              redirectTo: ROLE_REDIRECT_MAP[stationRole],
              issuedAt: fallbackIssuedAt,
              expiresAt,
            });
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
