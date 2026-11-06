"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  STAFF_SESSION_COOKIE,
  STAFF_SESSION_DURATION_MS,
  setStaffSessionCookie,
  clearStaffSessionCookie,
  requireStaffAuth,
  parseStaffSessionCookieValue,
} from "@/lib/auth/rbac";
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
  issuedAt?: number;
  expiresAt?: number;
  message?: string;
}

const ROLE_DESTINATION_MAP: Record<string, string> = {
  kitchen: "/smol-backdoor/kitchen",
  chef: "/smol-backdoor/kitchen",
  barista: "/smol-backdoor/barista",
  cashier: "/smol-backdoor/cashier",
  admin: "/smol-backdoor/admin",
  super_admin: "/smol-backdoor/admin",
  authenticated: "/smol-backdoor/admin",
};

/**
 * Server Action: Checks if the current browser has an active (< 12h) staff session cookie.
 */
export async function getActiveStaffSessionAction(): Promise<{
  active: boolean;
  role?: "kitchen" | "barista" | "cashier" | "admin";
  redirectTo?: string;
  issuedAt?: number;
  expiresAt?: number;
}> {
  try {
    const cookieStore = await cookies();
    const rawCookie = cookieStore.get(STAFF_SESSION_COOKIE)?.value;
    const parsed = parseStaffSessionCookieValue(rawCookie);

    if (!parsed || parsed.isExpired) {
      return { active: false };
    }

    const normalizedRole: "kitchen" | "barista" | "cashier" | "admin" =
      parsed.role === "super_admin" || parsed.role === "authenticated"
        ? "admin"
        : parsed.role === "chef"
        ? "kitchen"
        : (parsed.role as "kitchen" | "barista" | "cashier" | "admin");

    const now = Date.now();
    const issuedAt = parsed.issuedAt || now;
    const expiresAt = parsed.expiresAt || issuedAt + STAFF_SESSION_DURATION_MS;

    return {
      active: true,
      role: normalizedRole,
      redirectTo: ROLE_DESTINATION_MAP[normalizedRole] || "/smol-backdoor/admin",
      issuedAt,
      expiresAt,
    };
  } catch {
    return { active: false };
  }
}

/**
 * Server Action: Restores/refreshes the HTTP-only staff session cookie if the client
 * holds a valid 12-hour session token that has not yet reached its 12-hour expiry.
 */
export async function restoreStaffSessionAction(
  role: "kitchen" | "barista" | "cashier" | "admin",
  issuedAt?: number
): Promise<{
  success: boolean;
  role?: "kitchen" | "barista" | "cashier" | "admin";
  redirectTo?: string;
  issuedAt?: number;
  expiresAt?: number;
}> {
  if (!["kitchen", "barista", "cashier", "admin"].includes(role)) {
    return { success: false };
  }

  const now = Date.now();
  const validIssuedAt =
    issuedAt && Number.isFinite(issuedAt) && issuedAt > 0 ? issuedAt : now;

  // Enforce strict 12-hour maximum lifetime from original login timestamp
  if (now - validIssuedAt >= STAFF_SESSION_DURATION_MS) {
    await clearStaffSessionCookie();
    return { success: false };
  }

  const sessionTiming = await setStaffSessionCookie(
    role,
    undefined,
    validIssuedAt
  );

  return {
    success: true,
    role,
    redirectTo: ROLE_DESTINATION_MAP[role],
    issuedAt: sessionTiming.issuedAt,
    expiresAt: sessionTiming.expiresAt,
  };
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
    return {
      success: false,
      message: auth.message || "Unauthorized: Only Admin can update credentials.",
    };
  }

  const cleanPin = newPin.trim();
  if (!cleanPin || cleanPin.length < 3) {
    return {
      success: false,
      message: "PIN must be at least 3-4 digits/characters.",
    };
  }

  const creds = await getStoredCredentials();
  if (!creds[role]) {
    return { success: false, message: "Invalid role specified." };
  }

  creds[role].pin = cleanPin;
  if (
    role === "admin" &&
    newPassword !== undefined &&
    newPassword.trim().length > 0
  ) {
    creds[role].password = newPassword.trim();
  }

  await persistCredentials(creds);

  if (role === "admin") {
    const token = generateRoleCredentialToken(
      "admin",
      creds.admin.pin,
      creds.admin.password
    );
    await setStaffSessionCookie("admin", token, auth.issuedAt);
  }

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
      const token = generateRoleCredentialToken(
        "admin",
        creds.admin.pin,
        creds.admin.password
      );
      await setStaffSessionCookie("admin", token, auth.issuedAt);
    }

    broadcastSyncEvent({
      type: "STAFF_CREDENTIALS_CHANGED",
      station: role.toUpperCase() as any,
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

    const token = generateRoleCredentialToken(
      "admin",
      defaultCopy.admin.pin,
      defaultCopy.admin.password
    );
    await setStaffSessionCookie("admin", token, auth.issuedAt);

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
 * Server Action: Validates role credentials and signs in staff to the backdoor portal
 * with a 12-hour persistent session.
 */
export async function staffBackdoorLoginAction(
  data: StaffLoginInput
): Promise<StaffLoginResult> {
  const { role, pin, password } = data;

  if (!pin || pin.trim().length === 0) {
    return {
      success: false,
      message: "PIN is required. Please enter your station PIN.",
    };
  }

  const creds = await getStoredCredentials();
  const currentCred = creds[role];

  if (!currentCred) {
    return { success: false, message: "Unknown staff role specified." };
  }

  const trimmedPin = pin.trim();

  // Kitchen Quick Passcode
  if (role === "kitchen") {
    if (trimmedPin !== currentCred.pin) {
      return {
        success: false,
        message: "Invalid Kitchen Station PIN. Please try again.",
      };
    }
    const token = generateRoleCredentialToken("kitchen", currentCred.pin);
    const { issuedAt, expiresAt } = await setStaffSessionCookie(
      "kitchen",
      token
    );
    return {
      success: true,
      role: "kitchen",
      redirectTo: "/smol-backdoor/kitchen",
      issuedAt,
      expiresAt,
      message: "Kitchen display station unlocked for 12 hours!",
    };
  }

  // Barista Quick Passcode
  if (role === "barista") {
    if (trimmedPin !== currentCred.pin) {
      return {
        success: false,
        message: "Invalid Barista Station PIN. Please try again.",
      };
    }
    const token = generateRoleCredentialToken("barista", currentCred.pin);
    const { issuedAt, expiresAt } = await setStaffSessionCookie(
      "barista",
      token
    );
    return {
      success: true,
      role: "barista",
      redirectTo: "/smol-backdoor/barista",
      issuedAt,
      expiresAt,
      message: "Barista brew desk unlocked for 12 hours!",
    };
  }

  // Cashier Quick Passcode
  if (role === "cashier") {
    if (trimmedPin !== currentCred.pin) {
      return {
        success: false,
        message: "Invalid Cashier Desk PIN. Please try again.",
      };
    }
    const token = generateRoleCredentialToken("cashier", currentCred.pin);
    const { issuedAt, expiresAt } = await setStaffSessionCookie(
      "cashier",
      token
    );
    return {
      success: true,
      role: "cashier",
      redirectTo: "/smol-backdoor/cashier",
      issuedAt,
      expiresAt,
      message: "Cashier & settlement desk unlocked for 12 hours!",
    };
  }

  // Admin Master Passcode
  if (role === "admin") {
    const pinMatches = trimmedPin === currentCred.pin;
    const passMatches = Boolean(
      password &&
        password.trim().length > 0 &&
        currentCred.password &&
        password.trim() === currentCred.password
    );

    if (!pinMatches && !passMatches) {
      return {
        success: false,
        message: "Invalid Admin PIN or master password. Please try again.",
      };
    }
    const token = generateRoleCredentialToken(
      "admin",
      currentCred.pin,
      currentCred.password
    );
    const { issuedAt, expiresAt } = await setStaffSessionCookie("admin", token);
    return {
      success: true,
      role: "admin",
      redirectTo: "/smol-backdoor/admin",
      issuedAt,
      expiresAt,
      message: "Admin Control Tower unlocked for 12 hours!",
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
