"use server";

import { redirect } from "next/navigation";
import { setStaffSessionCookie, clearStaffSessionCookie } from "@/lib/auth/rbac";

export interface StaffLoginInput {
  role: "kitchen" | "barista" | "cashier" | "admin";
  pin?: string;
  password?: string;
}

export interface StaffLoginResult {
  success: boolean;
  role?: string;
  redirectTo?: string;
  message?: string;
}

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

const DEFAULT_ROLE_CREDENTIALS: RoleCredentialsMap = {
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

import fs from "fs";
import path from "path";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffAuth } from "@/lib/auth/rbac";
import { broadcastSyncEvent } from "@/lib/sync-events";

declare global {
  var __SMOL_ROLE_CREDENTIALS__: RoleCredentialsMap | undefined;
}

const CREDENTIALS_FILE_PATH = path.join(process.cwd(), "data", "staff-credentials.json");

function mergeWithDefaults(saved: Partial<RoleCredentialsMap>): RoleCredentialsMap {
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
 * Returns current role credentials with multi-tier persistence:
 * 1. In-memory hot cache
 * 2. Supabase PostgreSQL database (budgets table: category='STAFF_RBAC', month='CONFIG')
 * 3. Local persistent file (data/staff-credentials.json)
 * 4. Default credentials fallback
 */
export async function getStoredCredentials(): Promise<RoleCredentialsMap> {
  if (globalThis.__SMOL_ROLE_CREDENTIALS__) {
    return globalThis.__SMOL_ROLE_CREDENTIALS__;
  }

  // Tier 1: Supabase Database
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("budgets")
      .select("notes")
      .eq("category", "STAFF_RBAC")
      .eq("month", "CONFIG")
      .maybeSingle();

    if (!error && data?.notes) {
      try {
        const parsed = JSON.parse(data.notes);
        if (parsed && typeof parsed === "object") {
          const merged = mergeWithDefaults(parsed);
          globalThis.__SMOL_ROLE_CREDENTIALS__ = merged;
          // Synchronize local file cache
          try {
            const dir = path.dirname(CREDENTIALS_FILE_PATH);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(CREDENTIALS_FILE_PATH, JSON.stringify(merged, null, 2), "utf-8");
          } catch {
            // Ignore disk cache write failure
          }
          return merged;
        }
      } catch (parseErr) {
        console.error("Failed to parse stored credentials from Supabase:", parseErr);
      }
    }
  } catch (dbErr) {
    console.warn("Could not load credentials from Supabase:", dbErr);
  }

  // Tier 2: Persistent Local File
  try {
    if (fs.existsSync(CREDENTIALS_FILE_PATH)) {
      const fileContent = fs.readFileSync(CREDENTIALS_FILE_PATH, "utf-8");
      const parsed = JSON.parse(fileContent);
      if (parsed && typeof parsed === "object") {
        const merged = mergeWithDefaults(parsed);
        globalThis.__SMOL_ROLE_CREDENTIALS__ = merged;
        return merged;
      }
    }
  } catch (fsErr) {
    console.warn("Could not read credentials from local file:", fsErr);
  }

  // Tier 3: Default Credentials
  globalThis.__SMOL_ROLE_CREDENTIALS__ = { ...DEFAULT_ROLE_CREDENTIALS };
  return globalThis.__SMOL_ROLE_CREDENTIALS__;
}

async function persistCredentials(creds: RoleCredentialsMap): Promise<void> {
  globalThis.__SMOL_ROLE_CREDENTIALS__ = creds;

  // 1. Persist to local filesystem
  try {
    const dir = path.dirname(CREDENTIALS_FILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CREDENTIALS_FILE_PATH, JSON.stringify(creds, null, 2), "utf-8");
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
    broadcastSyncEvent({
      type: "SETTINGS_UPDATED",
      timestamp: Date.now(),
    });
  } catch {
    // Ignore broadcast failure on server
  }
}

/**
 * Server Action: Returns role info for UI display.
 * If revealPinsForAdmin is true and requester is an authenticated Admin, actual PINs are returned.
 * Otherwise, PIN values are masked with "****".
 */
export async function getRoleCredentialsAction(
  revealPinsForAdmin: boolean = false
): Promise<{
  success: boolean;
  credentials: RoleCredentialsMap;
}> {
  const creds = await getStoredCredentials();

  if (revealPinsForAdmin) {
    const auth = await requireStaffAuth(["admin", "super_admin"]);
    if (auth.authorized) {
      return { success: true, credentials: creds };
    }
  }

  // Mask PINs for public/unauthenticated views
  const sanitized: RoleCredentialsMap = {
    admin: { ...creds.admin, pin: "****", password: undefined },
    cashier: { ...creds.cashier, pin: "****" },
    kitchen: { ...creds.kitchen, pin: "****" },
    barista: { ...creds.barista, pin: "****" },
  };
  return { success: true, credentials: sanitized };
}

/**
 * Server Action: Updates the quick PIN and/or master password for a specific role.
 * Persists permanently until changed again by Admin.
 */
export async function updateRoleCredentialAction(
  role: "admin" | "cashier" | "kitchen" | "barista",
  newPin: string,
  newPassword?: string
): Promise<{
  success: boolean;
  credentials?: RoleCredentialsMap;
  message: string;
}> {
  const auth = await requireStaffAuth(["admin", "super_admin"]);
  if (!auth.authorized) {
    return { success: false, message: auth.message || "Unauthorized: Only Admin can update credentials." };
  }

  const cleanPin = newPin.trim();
  if (!cleanPin || cleanPin.length < 3) {
    return { success: false, message: "PIN must be at least 3-4 digits/characters." };
  }

  const creds = await getStoredCredentials();
  if (!creds[role]) {
    return { success: false, message: "Invalid role specified." };
  }

  creds[role].pin = cleanPin;
  if (role === "admin" && newPassword !== undefined && newPassword.trim().length > 0) {
    creds[role].password = newPassword.trim();
  }

  await persistCredentials(creds);

  return {
    success: true,
    credentials: creds,
    message: `${creds[role].roleName} PIN updated successfully to: ${cleanPin}`,
  };
}

/**
 * Server Action: Resets role credentials to factory defaults.
 */
export async function resetRoleCredentialAction(
  role?: "admin" | "cashier" | "kitchen" | "barista"
): Promise<{
  success: boolean;
  credentials: RoleCredentialsMap;
  message: string;
}> {
  const auth = await requireStaffAuth(["admin", "super_admin"]);
  if (!auth.authorized) {
    const current = await getStoredCredentials();
    return { success: false, credentials: current, message: "Unauthorized." };
  }

  const creds = await getStoredCredentials();
  if (role) {
    creds[role] = { ...DEFAULT_ROLE_CREDENTIALS[role] };
    await persistCredentials(creds);
    return {
      success: true,
      credentials: creds,
      message: `${DEFAULT_ROLE_CREDENTIALS[role].roleName} reset to default PIN (${DEFAULT_ROLE_CREDENTIALS[role].pin}).`,
    };
  } else {
    const defaultCopy = {
      admin: { ...DEFAULT_ROLE_CREDENTIALS.admin },
      cashier: { ...DEFAULT_ROLE_CREDENTIALS.cashier },
      kitchen: { ...DEFAULT_ROLE_CREDENTIALS.kitchen },
      barista: { ...DEFAULT_ROLE_CREDENTIALS.barista },
    };
    await persistCredentials(defaultCopy);
    return {
      success: true,
      credentials: defaultCopy,
      message: "All staff role credentials reset to default PINs.",
    };
  }
}

/**
 * Server Action: Validates role credentials and signs in staff to the backdoor portal.
 * Strictly verifies against the active stored credentials without hardcoded backdoor bypasses.
 */
export async function staffBackdoorLoginAction(
  data: StaffLoginInput
): Promise<StaffLoginResult> {
  const { role, pin, password } = data;

  if (!pin || pin.trim().length === 0) {
    return { success: false, message: "PIN is required. Please enter your station PIN." };
  }

  const creds = await getStoredCredentials();
  const currentCred = creds[role];

  if (!currentCred) {
    return { success: false, message: "Unknown staff role specified." };
  }

  const trimmedPin = pin.trim();

  // Kitchen Quick Passcode - STRICT check against active PIN
  if (role === "kitchen") {
    if (trimmedPin !== currentCred.pin) {
      return { success: false, message: "Invalid Kitchen Station PIN. Please try again." };
    }
    await setStaffSessionCookie("kitchen");
    return {
      success: true,
      role: "kitchen",
      redirectTo: "/smol-backdoor/kitchen",
      message: "Kitchen display station unlocked!",
    };
  }

  // Barista Quick Passcode - STRICT check against active PIN
  if (role === "barista") {
    if (trimmedPin !== currentCred.pin) {
      return { success: false, message: "Invalid Barista Station PIN. Please try again." };
    }
    await setStaffSessionCookie("barista");
    return {
      success: true,
      role: "barista",
      redirectTo: "/smol-backdoor/barista",
      message: "Barista brew desk unlocked!",
    };
  }

  // Cashier Quick Passcode - STRICT check against active PIN
  if (role === "cashier") {
    if (trimmedPin !== currentCred.pin) {
      return { success: false, message: "Invalid Cashier Desk PIN. Please try again." };
    }
    await setStaffSessionCookie("cashier");
    return {
      success: true,
      role: "cashier",
      redirectTo: "/smol-backdoor/cashier",
      message: "Cashier & settlement desk unlocked!",
    };
  }

  // Admin Master Passcode — STRICT check against active Admin PIN or master password
  if (role === "admin") {
    const pinMatches = trimmedPin === currentCred.pin;
    const passMatches = Boolean(
      password &&
      password.trim().length > 0 &&
      currentCred.password &&
      password.trim() === currentCred.password
    );

    if (!pinMatches && !passMatches) {
      return { success: false, message: "Invalid Admin PIN or master password. Please try again." };
    }
    await setStaffSessionCookie("admin");
    return {
      success: true,
      role: "admin",
      redirectTo: "/smol-backdoor/admin",
      message: "Admin Control Tower unlocked!",
    };
  }

  return { success: false, message: "Unknown staff role specified." };
}

/**
 * Server Action: Signs out staff and redirects to backdoor login
 */
export async function staffBackdoorLogoutAction(): Promise<void> {
  await clearStaffSessionCookie();
  redirect("/smol-backdoor");
}
