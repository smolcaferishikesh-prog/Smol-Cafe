import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastSyncEvent } from "@/lib/sync-events";

export interface RoleCredential {
  role: "admin" | "cashier" | "kitchen" | "barista";
  roleName: string;
  portal: string;
  pin: string;
  password?: string;
  permissions: string;
  status: string;
}

export interface RoleCredentialsMap {
  admin: RoleCredential;
  cashier: RoleCredential;
  kitchen: RoleCredential;
  barista: RoleCredential;
}

export const DEFAULT_ROLE_CREDENTIALS: RoleCredentialsMap = {
  admin: {
    role: "admin",
    roleName: "Super Admin (Owner)",
    portal: "/admin",
    pin: "9227",
    password: "smol2026",
    permissions: "Full Control, Budgets, Logs",
    status: "Active",
  },
  cashier: {
    role: "cashier",
    roleName: "Cashier / Counter Staff",
    portal: "/cashier",
    pin: "8112",
    permissions: "Order Verification, Cash Settlement",
    status: "Active",
  },
  kitchen: {
    role: "kitchen",
    roleName: "Kitchen Display (Chef/Cooks)",
    portal: "/kitchen",
    pin: "6175",
    permissions: "Order Queue, Food Prep Status",
    status: "Active",
  },
  barista: {
    role: "barista",
    roleName: "Barista Desk (Espresso & Brew)",
    portal: "/smol-backdoor/barista",
    pin: "1234",
    permissions: "Beverage Queue, Shot Timer, Brew Status",
    status: "Active",
  },
};

declare global {
  var __SMOL_ROLE_CREDENTIALS__: RoleCredentialsMap | undefined;
  var __SMOL_ROLE_CREDENTIALS_HYDRATED_AT__: number | undefined;
  var __SMOL_ROLE_CREDENTIALS_PROMISE__: Promise<RoleCredentialsMap | null> | undefined;
}

function getCredentialsFilePath(): string {
  const cwd = process.cwd();
  if (cwd.endsWith("apps/web")) {
    return path.join(cwd, "data", "staff-credentials.json");
  }
  return path.join(cwd, "apps/web/data/staff-credentials.json");
}

export function mergeWithDefaults(saved: Partial<RoleCredentialsMap>): RoleCredentialsMap {
  return {
    admin: {
      ...DEFAULT_ROLE_CREDENTIALS.admin,
      ...(saved.admin || {}),
      role: "admin",
      portal: "/admin",
      permissions: "Full Control, Budgets, Logs",
      status: "Active",
    },
    cashier: {
      ...DEFAULT_ROLE_CREDENTIALS.cashier,
      ...(saved.cashier || {}),
      role: "cashier",
      portal: "/cashier",
      permissions: "Order Verification, Cash Settlement",
      status: "Active",
    },
    kitchen: {
      ...DEFAULT_ROLE_CREDENTIALS.kitchen,
      ...(saved.kitchen || {}),
      role: "kitchen",
      portal: "/kitchen",
      permissions: "Order Queue, Food Prep Status",
      status: "Active",
    },
    barista: {
      ...DEFAULT_ROLE_CREDENTIALS.barista,
      ...(saved.barista || {}),
      role: "barista",
      portal: "/smol-backdoor/barista",
      permissions: "Beverage Queue, Shot Timer, Brew Status",
      status: "Active",
    },
  };
}

/**
 * Deterministic cryptographic session token signature based on current role PIN and password.
 * Whenever PIN or password is changed, this token changes, immediately invalidating old sessions.
 */
export function generateRoleCredentialToken(
  role: string,
  pin: string,
  password?: string
): string {
  const secret = process.env.SESSION_SECRET || "smol_staff_secret_key_2026";
  return crypto
    .createHmac("sha256", secret)
    .update(`${role}:${pin}:${password || ""}`)
    .digest("hex")
    .slice(0, 16);
}

const CREDENTIALS_CACHE_TTL_MS = 30_000;

async function fetchCredentialsFromSupabase(): Promise<RoleCredentialsMap | null> {
  if (globalThis.__SMOL_ROLE_CREDENTIALS_PROMISE__) {
    return globalThis.__SMOL_ROLE_CREDENTIALS_PROMISE__;
  }

  const promise = (async (): Promise<RoleCredentialsMap | null> => {
    try {
      const supabase = createAdminClient();
      const queryPromise = supabase
        .from("budgets")
        .select("notes")
        .eq("category", "STAFF_RBAC")
        .eq("month", "CONFIG")
        .maybeSingle();

      const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error("Credentials DB fetch timeout") }), 3500)
      );

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (!error && data?.notes) {
        const parsed = JSON.parse(data.notes);
        if (parsed && typeof parsed === "object") {
          const merged = mergeWithDefaults(parsed);
          globalThis.__SMOL_ROLE_CREDENTIALS__ = merged;
          globalThis.__SMOL_ROLE_CREDENTIALS_HYDRATED_AT__ = Date.now();
          try {
            const filePath = getCredentialsFilePath();
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), "utf-8");
          } catch {}
          return merged;
        }
      }
      return null;
    } catch {
      return null;
    } finally {
      globalThis.__SMOL_ROLE_CREDENTIALS_PROMISE__ = undefined;
    }
  })();

  globalThis.__SMOL_ROLE_CREDENTIALS_PROMISE__ = promise;
  return promise;
}

/**
 * Returns current role credentials reliably across serverless cold starts:
 * 1. Fresh in-memory cache (if hydrated from Supabase within TTL and not force-refreshed)
 * 2. Authoritative Supabase fetch (awaited on cold start so updated PINs are never rejected)
 * 3. Local persistent file fallback (data/staff-credentials.json)
 * 4. Default credentials fallback
 */
export async function getStoredCredentials(options?: { forceRefresh?: boolean }): Promise<RoleCredentialsMap> {
  const forceRefresh = Boolean(options?.forceRefresh);
  const now = Date.now();
  const isCacheFresh =
    Boolean(globalThis.__SMOL_ROLE_CREDENTIALS__) &&
    Boolean(globalThis.__SMOL_ROLE_CREDENTIALS_HYDRATED_AT__) &&
    now - (globalThis.__SMOL_ROLE_CREDENTIALS_HYDRATED_AT__ || 0) < CREDENTIALS_CACHE_TTL_MS;

  if (!forceRefresh && isCacheFresh && globalThis.__SMOL_ROLE_CREDENTIALS__) {
    return globalThis.__SMOL_ROLE_CREDENTIALS__;
  }

  // Always await authoritative Supabase state on cold start or explicit refresh (fixes SMOL-014)
  const dbCreds = await fetchCredentialsFromSupabase();
  if (dbCreds) {
    return dbCreds;
  }

  // Fallback 1: Existing in-memory cache if DB was temporarily unreachable
  if (globalThis.__SMOL_ROLE_CREDENTIALS__) {
    return globalThis.__SMOL_ROLE_CREDENTIALS__;
  }

  // Fallback 2: Local persistent file
  try {
    const filePath = getCredentialsFilePath();
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(fileContent);
      if (parsed && typeof parsed === "object") {
        const merged = mergeWithDefaults(parsed);
        globalThis.__SMOL_ROLE_CREDENTIALS__ = merged;
        return merged;
      }
    }
  } catch {
    // ignore local file error
  }

  // Fallback 3: Default credentials (do NOT mark hydrated so next call retries Supabase)
  const defaults = mergeWithDefaults({});
  globalThis.__SMOL_ROLE_CREDENTIALS__ = defaults;
  return defaults;
}

export async function persistCredentials(creds: RoleCredentialsMap): Promise<void> {
  globalThis.__SMOL_ROLE_CREDENTIALS__ = creds;
  globalThis.__SMOL_ROLE_CREDENTIALS_HYDRATED_AT__ = Date.now();

  // 1. Persist to local filesystem
  try {
    const filePath = getCredentialsFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(creds, null, 2), "utf-8");
  } catch (fsErr) {
    console.warn("Failed to write credentials to local file:", fsErr);
  }

  // 2. Persist to Supabase PostgreSQL database
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("budgets").upsert(
      {
        category: "STAFF_RBAC",
        month: "CONFIG",
        budgeted_amount_paise: 0,
        notes: JSON.stringify(creds),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "category,month" }
    );
    if (error) {
      console.error("Failed to upsert credentials in Supabase:", error.message);
    }
  } catch (dbErr) {
    console.error("Failed to persist credentials in Supabase:", dbErr);
  }

  // 3. Realtime broadcast for live propagation across tabs
  try {
    void broadcastSyncEvent({
      type: "SETTINGS_UPDATED",
      timestamp: Date.now(),
    });
  } catch {
    // Ignore broadcast failure on server
  }
}
