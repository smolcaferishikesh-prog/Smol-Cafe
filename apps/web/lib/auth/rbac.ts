import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isMockDatabase } from "@/lib/supabase/admin";
import {
  getStoredCredentials,
  generateRoleCredentialToken,
} from "@/lib/auth/credentials";

export const STAFF_SESSION_COOKIE = "smol_staff_session";
export const STAFF_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours (43,200 seconds)
export const STAFF_SESSION_DURATION_MS = STAFF_SESSION_MAX_AGE_SECONDS * 1000; // 12 hours in ms

const VALID_STAFF_ROLES = new Set([
  "super_admin",
  "admin",
  "authenticated",
  "cashier",
  "kitchen",
  "barista",
  "chef",
]);

export interface AuthCheckResult {
  authorized: boolean;
  role?: string;
  userId?: string;
  issuedAt?: number;
  expiresAt?: number;
  error?: "AUTH_REQUIRED" | "FORBIDDEN" | "MFA_REQUIRED";
  message?: string;
}

/**
 * Parses a raw `smol_staff_session` cookie value (`role`, `role:sig`, or `role:sig:issuedAt`).
 */
export function parseStaffSessionCookieValue(rawCookie?: string | null): {
  role: string;
  signature?: string;
  issuedAt?: number;
  expiresAt?: number;
  isExpired: boolean;
} | null {
  if (!rawCookie || typeof rawCookie !== "string") return null;
  const parts = rawCookie.split(":");
  const role = parts[0]?.trim().toLowerCase();
  if (!role || !VALID_STAFF_ROLES.has(role)) return null;

  const signature = parts[1] || undefined;
  const rawIssuedAt = parts[2] ? Number(parts[2]) : undefined;
  const issuedAt =
    rawIssuedAt && Number.isFinite(rawIssuedAt) && rawIssuedAt > 0
      ? rawIssuedAt
      : undefined;

  const expiresAt = issuedAt ? issuedAt + STAFF_SESSION_DURATION_MS : undefined;
  const isExpired = Boolean(expiresAt && Date.now() > expiresAt);

  return {
    role,
    signature,
    issuedAt,
    expiresAt,
    isExpired,
  };
}

/**
 * Sets the staff session cookie with explicit role permissions and a 12-hour expiration window.
 * Once logged in, the staff session remains valid for 12 hours unless the user explicitly logs out.
 */
export async function setStaffSessionCookie(
  role: "kitchen" | "barista" | "cashier" | "admin" | "super_admin",
  signature?: string,
  customIssuedAt?: number
): Promise<{ issuedAt: number; expiresAt: number }> {
  const cookieStore = await cookies();
  let sig = signature;
  if (!sig) {
    try {
      const creds = await getStoredCredentials();
      const roleKey =
        role === "super_admin"
          ? "admin"
          : (role as "admin" | "cashier" | "kitchen" | "barista");
      const cred = creds[roleKey];
      if (cred) {
        sig = generateRoleCredentialToken(roleKey, cred.pin, cred.password);
      }
    } catch {}
  }

  const now = Date.now();
  const issuedAt =
    customIssuedAt &&
    Number.isFinite(customIssuedAt) &&
    customIssuedAt > 0 &&
    now - customIssuedAt < STAFF_SESSION_DURATION_MS
      ? customIssuedAt
      : now;
  const expiresAt = issuedAt + STAFF_SESSION_DURATION_MS;
  const remainingSeconds = Math.max(
    1,
    Math.floor((expiresAt - now) / 1000)
  );

  const cookieVal = `${role}:${sig || "active"}:${issuedAt}`;

  cookieStore.set(STAFF_SESSION_COOKIE, cookieVal, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: remainingSeconds,
    expires: new Date(expiresAt),
  });

  return { issuedAt, expiresAt };
}

/**
 * Clears the staff session cookie upon explicit logout.
 */
export async function clearStaffSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(STAFF_SESSION_COOKIE);
}

/**
 * Server-Side RBAC Guard: Validates that the request has an active authenticated staff session.
 * Keeps staff sessions active for a full 12 hours from login without premature auto-logout.
 */
export async function requireStaffAuth(
  allowedRoles: string[] = [
    "super_admin",
    "admin",
    "cashier",
    "kitchen",
    "barista",
    "chef",
  ]
): Promise<AuthCheckResult> {
  const cookieStore = await cookies();
  const staffCookie = cookieStore.get(STAFF_SESSION_COOKIE)?.value;

  // In local mock database development, allow requests if no cookie is set
  if (
    isMockDatabase() &&
    process.env.NODE_ENV !== "production" &&
    !staffCookie
  ) {
    return { authorized: true, role: "admin" };
  }

  // 1. Check HTTP-Only Staff Role Cookie (12-Hour Session Window)
  if (staffCookie) {
    const parsed = parseStaffSessionCookieValue(staffCookie);
    if (!parsed) {
      return {
        authorized: false,
        error: "AUTH_REQUIRED",
        message:
          "Invalid staff session. Please log in at /smol-backdoor.",
      };
    }

    if (parsed.isExpired) {
      return {
        authorized: false,
        error: "AUTH_REQUIRED",
        message:
          "Your 12-hour staff session has expired. Please log in again at /smol-backdoor.",
      };
    }

    const { role, issuedAt, expiresAt } = parsed;

    // Super admin & admin have access to all dashboards
    if (
      role === "admin" ||
      role === "super_admin" ||
      role === "authenticated"
    ) {
      return {
        authorized: true,
        role: "admin",
        issuedAt,
        expiresAt,
      };
    }

    if (allowedRoles.includes(role)) {
      return {
        authorized: true,
        role,
        issuedAt,
        expiresAt,
      };
    }

    return {
      authorized: false,
      error: "FORBIDDEN",
      role,
      message: `Access denied. Your current staff role (${role}) cannot access this section.`,
    };
  }

  // 2. Check Supabase Auth JWT Session
  try {
    const supabase = await createClient();
    const { data: authData, error } = await supabase.auth.getUser();

    if (error || !authData?.user) {
      return {
        authorized: false,
        error: "AUTH_REQUIRED",
        message:
          "Staff authentication required. Please log in at /smol-backdoor.",
      };
    }

    const userRole =
      (authData.user.app_metadata?.role as string) ||
      (authData.user.user_metadata?.role as string) ||
      "customer";

    if (!allowedRoles.includes(userRole) && userRole !== "super_admin") {
      return {
        authorized: false,
        error: "FORBIDDEN",
        role: userRole,
        message: `Unauthorized: Action requires one of [${allowedRoles.join(", ")}]. Current role: ${userRole}.`,
      };
    }

    return {
      authorized: true,
      role: userRole,
      userId: authData.user.id,
    };
  } catch {
    return {
      authorized: false,
      error: "AUTH_REQUIRED",
      message: "Authentication verification failed.",
    };
  }
}

/**
 * Server-Side MFA Guard: Ensures Admin/Owner account has completed Supabase TOTP MFA (AAL2).
 */
export async function requireAdminMfa(): Promise<AuthCheckResult> {
  const cookieStore = await cookies();
  const staffCookie = cookieStore.get(STAFF_SESSION_COOKIE)?.value;

  // In development / demo tablet session
  if (
    staffCookie === "authenticated" &&
    process.env.NODE_ENV !== "production"
  ) {
    return { authorized: true, role: "super_admin" };
  }

  try {
    const supabase = await createClient();
    const { data: authData, error } = await supabase.auth.getUser();

    if (error || !authData.user) {
      return {
        authorized: false,
        error: "AUTH_REQUIRED",
        message: "Admin login required.",
      };
    }

    // Verify Authenticator Assurance Level (AAL2)
    const { data: aalData } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (
      aalData &&
      aalData.currentLevel !== "aal2" &&
      aalData.nextLevel === "aal2"
    ) {
      return {
        authorized: false,
        error: "MFA_REQUIRED",
        message:
          "Multi-Factor Authentication (TOTP) verification required for admin operations.",
      };
    }

    return { authorized: true, userId: authData.user.id };
  } catch {
    return { authorized: false, error: "AUTH_REQUIRED" };
  }
}
