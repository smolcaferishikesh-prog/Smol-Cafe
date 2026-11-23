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
  errorCode?: "MISSING_PIN" | "UNKNOWN_ROLE" | "INVALID_PIN" | "SERVICE_ERROR";
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
    const masked: RoleCredentialsMap = {
      admin: { ...DEFAULT_ROLE_CREDENTIALS.admin, pin: "****", password: undefined },
      cashier: { ...DEFAULT_ROLE_CREDENTIALS.cashier, pin: "****" },
      kitchen: { ...DEFAULT_ROLE_CREDENTIALS.kitchen, pin: "****" },
      barista: { ...DEFAULT_ROLE_CREDENTIALS.barista, pin: "****" },
    };
    return { success: false, credentials: masked, message: "Unauthorized." };
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
    return {
      success: false,
      errorCode: "MISSING_PIN",
      message: "PIN is required. Please enter your station PIN.",
    };
  }

  const trimmedPin = pin.trim();
  const trimmedPass = password?.trim() || "";

  const matchesRole = (cred: RoleCredential | undefined): boolean => {
    if (!cred) return false;
    if (trimmedPin === cred.pin) return true;
    if (role === "admin" && trimmedPass.length > 0 && cred.password && trimmedPass === cred.password) {
      return true;
    }
    return false;
  };

  try {
    let creds = await getStoredCredentials();
    let currentCred = creds[role];

    if (!currentCred) {
      return {
        success: false,
        errorCode: "UNKNOWN_ROLE",
        message: "Unknown staff role specified.",
      };
    }

    // If cached credential did not match, force one fresh Supabase read before rejecting (prevents stale-cache false rejections)
    if (!matchesRole(currentCred)) {
      creds = await getStoredCredentials({ forceRefresh: true });
      currentCred = creds[role];
    }

    if (!matchesRole(currentCred)) {
      const invalidMessages: Record<StaffLoginInput["role"], string> = {
        kitchen: "Invalid Kitchen Station PIN. Please try again.",
        barista: "Invalid Barista Station PIN. Please try again.",
        cashier: "Invalid Cashier Desk PIN. Please try again.",
        admin: "Invalid Admin PIN or master password. Please try again.",
      };
      return {
        success: false,
        errorCode: "INVALID_PIN",
        message: invalidMessages[role],
      };
    }

    const token =
      role === "admin"
        ? generateRoleCredentialToken("admin", currentCred.pin, currentCred.password)
        : generateRoleCredentialToken(role, currentCred.pin);

    await setStaffSessionCookie(role, token);

    const redirectMap: Record<StaffLoginInput["role"], { redirectTo: string; message: string }> = {
      kitchen: { redirectTo: "/smol-backdoor/kitchen", message: "Kitchen display station unlocked!" },
      barista: { redirectTo: "/smol-backdoor/barista", message: "Barista brew desk unlocked!" },
      cashier: { redirectTo: "/smol-backdoor/cashier", message: "Cashier & settlement desk unlocked!" },
      admin: { redirectTo: "/smol-backdoor/admin", message: "Admin Control Tower unlocked!" },
    };

    return {
      success: true,
      role,
      redirectTo: redirectMap[role].redirectTo,
      message: redirectMap[role].message,
    };
  } catch (err) {
    console.error("Staff login service error:", err);
    return {
      success: false,
      errorCode: "SERVICE_ERROR",
      message: "Authentication service temporarily unavailable. Please retry in a moment.",
    };
  }
}

/**
 * Server Action: Signs out staff and redirects to backdoor login
 */
export async function staffBackdoorLogoutAction(): Promise<void> {
  await clearStaffSessionCookie();
  redirect("/smol-backdoor");
}
