"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  type CanonicalStaffRole,
  STAFF_SESSION_DURATION_MS,
  setStaffSessionCookie,
  clearStaffSessionCookie,
  requireStaffAuth,
  extractActiveRoleSessionsFromCookies,
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
  activeRoles?: CanonicalStaffRole[];
  message?: string;
}

export interface ActiveRoleSummary {
  role: CanonicalStaffRole;
  redirectTo: string;
  issuedAt: number;
  expiresAt: number;
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
 * Server Action: Checks if the current browser has active (< 12h) staff session cookies.
 * Supports multiple roles open simultaneously in the same browser.
 */
export async function getActiveStaffSessionAction(
  preferredRole?: "kitchen" | "barista" | "cashier" | "admin"
): Promise<{
  active: boolean;
  role?: CanonicalStaffRole;
  redirectTo?: string;
  issuedAt?: number;
  expiresAt?: number;
  activeSessions?: ActiveRoleSummary[];
}> {
  try {
    const cookieStore = await cookies();
    const activeMap = extractActiveRoleSessionsFromCookies(
      (name) => cookieStore.get(name)?.value
    );

    if (activeMap.size === 0) {
      return { active: false, activeSessions: [] };
    }

    const activeSessions: ActiveRoleSummary[] = Array.from(
      activeMap.values()
    )
      .sort((a, b) => b.issuedAt - a.issuedAt)
      .map((entry) => ({
        role: entry.role,
        redirectTo:
          ROLE_DESTINATION_MAP[entry.role] || "/smol-backdoor/admin",
        issuedAt: entry.issuedAt,
        expiresAt: entry.expiresAt,
      }));

    // Match preferredRole if active (or admin if admin is active), otherwise pick the most recently active role
    const matched =
      (preferredRole &&
        activeSessions.find((s) => s.role === preferredRole)) ||
      (preferredRole && activeSessions.find((s) => s.role === "admin")) ||
      activeSessions[0];

    return {
      active: true,
      role: matched.role,
      redirectTo: matched.redirectTo,
      issuedAt: matched.issuedAt,
      expiresAt: matched.expiresAt,
      activeSessions,
    };
  } catch {
    return { active: false, activeSessions: [] };
  }
}

/**
 * Server Action: Restores/refreshes the HTTP-only staff session cookie for a specific role
 * without overwriting or logging out any other active roles in the browser.
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
  activeRoles?: CanonicalStaffRole[];
}> {
  if (!["kitchen", "barista", "cashier", "admin"].includes(role)) {
    return { success: false };
  }

  const now = Date.now();
  const validIssuedAt =
    issuedAt && Number.isFinite(issuedAt) && issuedAt > 0 ? issuedAt : now;

  // Enforce strict 12-hour maximum lifetime from original login timestamp for this role
  if (now - validIssuedAt >= STAFF_SESSION_DURATION_MS) {
    await clearStaffSessionCookie(role);
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
    activeRoles: sessionTiming.activeRoles,
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
 * with a 12-hour persistent session, preserving any other roles already open in the browser.
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
    const { issuedAt, expiresAt, activeRoles } = await setStaffSessionCookie(
      "kitchen",
      token
    );
    return {
      success: true,
      role: "kitchen",
      redirectTo: "/smol-backdoor/kitchen",
      issuedAt,
      expiresAt,
      activeRoles,
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
    const { issuedAt, expiresAt, activeRoles } = await setStaffSessionCookie(
      "barista",
      token
    );
    return {
      success: true,
      role: "barista",
      redirectTo: "/smol-backdoor/barista",
      issuedAt,
      expiresAt,
      activeRoles,
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
    const { issuedAt, expiresAt, activeRoles } = await setStaffSessionCookie(
      "cashier",
      token
    );
    return {
      success: true,
      role: "cashier",
      redirectTo: "/smol-backdoor/cashier",
      issuedAt,
      expiresAt,
      activeRoles,
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
    const { issuedAt, expiresAt, activeRoles } = await setStaffSessionCookie(
      "admin",
      token
    );
    return {
      success: true,
      role: "admin",
      redirectTo: "/smol-backdoor/admin",
      issuedAt,
      expiresAt,
      activeRoles,
      message: "Admin Control Tower unlocked for 12 hours!",
    };
  }

  return { success: false, message: "Unknown staff role specified." };
}

/**
 * Server Action: Signs out a specific role (or all roles if omitted) and redirects to backdoor login.
 * Passing `roleToClear` ensures other open role tabs (e.g. Admin, Kitchen, Barista) stay logged in!
 */
export async function staffBackdoorLogoutAction(
  roleToClear?: "kitchen" | "barista" | "cashier" | "admin"
): Promise<void> {
  await clearStaffSessionCookie(roleToClear);
  redirect("/smol-backdoor?switch=1");
}
