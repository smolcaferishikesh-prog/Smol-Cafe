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
  var __SMOL_ROLE_CREDENTIALS_FETCHING__: boolean | undefined;
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

async function refreshCredentialsFromSupabaseInBackground(): Promise<void> {
  if (globalThis.__SMOL_ROLE_CREDENTIALS_FETCHING__) return;
  globalThis.__SMOL_ROLE_CREDENTIALS_FETCHING__ = true;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("budgets")
      .select("notes")
      .eq("category", "STAFF_RBAC")
      .eq("month", "CONFIG")
      .maybeSingle();

    if (!error && data?.notes) {
      const parsed = JSON.parse(data.notes);
      if (parsed && typeof parsed === "object") {
        const merged = mergeWithDefaults(parsed);
        globalThis.__SMOL_ROLE_CREDENTIALS__ = merged;
        try {
          const filePath = getCredentialsFilePath();
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), "utf-8");
        } catch {}
      }
    }
  } catch {
    // ignore background refresh notice
  } finally {
    globalThis.__SMOL_ROLE_CREDENTIALS_FETCHING__ = false;
  }
}

/**
 * Returns current role credentials with multi-tier persistence (0ms fast path):
 * 1. In-memory hot cache
 * 2. Local persistent file (data/staff-credentials.json)
 * 3. Default credentials fallback + non-blocking background Supabase sync
 */
export async function getStoredCredentials(): Promise<RoleCredentialsMap> {
  if (globalThis.__SMOL_ROLE_CREDENTIALS__) {
    return globalThis.__SMOL_ROLE_CREDENTIALS__;
  }

  // Tier 1: Fast local file read (< 1ms) so auth checks never block on cold DB calls
  try {
    const filePath = getCredentialsFilePath();
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(fileContent);
      if (parsed && typeof parsed === "object") {
        const merged = mergeWithDefaults(parsed);
        globalThis.__SMOL_ROLE_CREDENTIALS__ = merged;
        void refreshCredentialsFromSupabaseInBackground();
        return merged;
      }
    }
  } catch {
    // ignore local file error
  }

  // Tier 2: Immediate default credentials + non-blocking background DB sync
  globalThis.__SMOL_ROLE_CREDENTIALS__ = { ...DEFAULT_ROLE_CREDENTIALS };
  void refreshCredentialsFromSupabaseInBackground();
  return globalThis.__SMOL_ROLE_CREDENTIALS__;
}

export async function persistCredentials(creds: RoleCredentialsMap): Promise<void> {
  globalThis.__SMOL_ROLE_CREDENTIALS__ = creds;

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
