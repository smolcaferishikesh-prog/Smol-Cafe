"use server";

import { redirect } from "next/navigation";
import { setStaffSessionCookie, clearStaffSessionCookie, requireStaffAuth } from "@/lib/auth/rbac";
import { broadcastSyncEvent } from "@/lib/sync-events";
import {
  type RoleCredential,
  type RoleCredentialsMap,
  DEFAULT_ROLE_CREDENTIALS,
  getStoredCredentials,
  persistCredentials,
  generateRoleCredentialToken,
} from "@/lib/auth/credentials";

export type { RoleCredential, RoleCredentialsMap };

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

  // If the admin updated admin credentials, refresh the admin's own current session cookie
  // so the active admin on this device doesn't get kicked out, while all OTHER sessions with the old signature fail!
  if (role === "admin") {
    const token = generateRoleCredentialToken("admin", creds.admin.pin, creds.admin.password);
    await setStaffSessionCookie("admin", token);
  }

  // Real-time broadcast: Invalidate active sessions across all devices/tabs immediately
  broadcastSyncEvent({
    type: "STAFF_CREDENTIALS_CHANGED",
    station: role === "admin" ? "ALL" : (role.toUpperCase() as any),
    metadata: {
      role,
      action: "CREDENTIALS_CHANGED",
      timestamp: Date.now(),
    },
  });

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

    if (role === "admin") {
      const token = generateRoleCredentialToken("admin", creds.admin.pin, creds.admin.password);
      await setStaffSessionCookie("admin", token);
    }

    broadcastSyncEvent({
      type: "STAFF_CREDENTIALS_CHANGED",
      station: (role.toUpperCase() as any),
      metadata: {
        role,
        action: "CREDENTIALS_RESET",
        timestamp: Date.now(),
      },
    });

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

    const token = generateRoleCredentialToken("admin", defaultCopy.admin.pin, defaultCopy.admin.password);
    await setStaffSessionCookie("admin", token);

    broadcastSyncEvent({
      type: "STAFF_CREDENTIALS_CHANGED",
      station: "ALL",
      metadata: {
        role: "all",
        action: "CREDENTIALS_RESET",
        timestamp: Date.now(),
      },
    });

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
    const token = generateRoleCredentialToken("kitchen", currentCred.pin);
    await setStaffSessionCookie("kitchen", token);
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
    const token = generateRoleCredentialToken("barista", currentCred.pin);
    await setStaffSessionCookie("barista", token);
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
    const token = generateRoleCredentialToken("cashier", currentCred.pin);
    await setStaffSessionCookie("cashier", token);
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
    const token = generateRoleCredentialToken("admin", currentCred.pin, currentCred.password);
    await setStaffSessionCookie("admin", token);
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
