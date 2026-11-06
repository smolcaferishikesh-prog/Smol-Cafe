import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isMockDatabase } from "@/lib/supabase/admin";
import {
  getStoredCredentials,
  generateRoleCredentialToken,
} from "@/lib/auth/credentials";

export const STAFF_SESSION_COOKIE = "smol_staff_session";
export const STAFF_ROLE_COOKIE_PREFIX = "smol_staff_role_";
export const STAFF_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours (43,200 seconds)
export const STAFF_SESSION_DURATION_MS = STAFF_SESSION_MAX_AGE_SECONDS * 1000; // 12 hours in ms

export type CanonicalStaffRole = "admin" | "cashier" | "barista" | "kitchen";
export const ALL_CANONICAL_STAFF_ROLES: CanonicalStaffRole[] = [
  "admin",
  "cashier",
  "barista",
  "kitchen",
];

const VALID_STAFF_ROLES = new Set([
  "super_admin",
  "admin",
  "authenticated",
  "cashier",
  "kitchen",
  "barista",
  "chef",
]);

export interface ActiveRoleSessionEntry {
  role: CanonicalStaffRole;
  signature?: string;
  issuedAt: number;
  expiresAt: number;
}

export interface AuthCheckResult {
  authorized: boolean;
  role?: string;
  activeRoles?: CanonicalStaffRole[];
  userId?: string;
  issuedAt?: number;
  expiresAt?: number;
  error?: "AUTH_REQUIRED" | "FORBIDDEN" | "MFA_REQUIRED";
  message?: string;
}

export function normalizeToCanonicalRole(
  rawRole?: string | null
): CanonicalStaffRole | null {
  if (!rawRole) return null;
  const r = rawRole.trim().toLowerCase();
  if (r === "admin" || r === "super_admin" || r === "authenticated") {
    return "admin";
  }
  if (r === "kitchen" || r === "chef") {
    return "kitchen";
  }
  if (r === "barista") {
    return "barista";
  }
  if (r === "cashier") {
    return "cashier";
  }
  return null;
}

export function getRoleSpecificCookieName(role: CanonicalStaffRole): string {
  return `${STAFF_ROLE_COOKIE_PREFIX}${role}`;
}

/**
 * Parses a single role entry (`role:sig:issuedAt` or `role:sig` or `role`).
 */
export function parseStaffSessionCookieValue(rawCookie?: string | null): {
  role: string;
  canonicalRole: CanonicalStaffRole;
  signature?: string;
  issuedAt?: number;
  expiresAt?: number;
  isExpired: boolean;
} | null {
  if (!rawCookie || typeof rawCookie !== "string") return null;
  // If multi-role format (`role1:sig1:ts1|role2:sig2:ts2`), parse the first valid non-expired entry
  if (rawCookie.includes("|")) {
    const segments = rawCookie.split("|");
    for (const seg of segments) {
      const parsedSeg = parseStaffSessionCookieValue(seg);
      if (parsedSeg && !parsedSeg.isExpired) {
        return parsedSeg;
      }
    }
    return null;
  }

  const parts = rawCookie.split(":");
  const role = parts[0]?.trim().toLowerCase();
  if (!role || !VALID_STAFF_ROLES.has(role)) return null;
  const canonicalRole = normalizeToCanonicalRole(role);
  if (!canonicalRole) return null;

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
    canonicalRole,
    signature,
    issuedAt,
    expiresAt,
    isExpired,
  };
}

/**
 * Parses all active (< 12h) role sessions from both the combined `smol_staff_session` cookie
 * and individual `smol_staff_role_<role>` cookies so multiple roles can stay logged in simultaneously.
 */
export function extractActiveRoleSessionsFromCookies(
  cookieGetter: (name: string) => string | undefined
): Map<CanonicalStaffRole, ActiveRoleSessionEntry> {
  const now = Date.now();
  const activeMap = new Map<CanonicalStaffRole, ActiveRoleSessionEntry>();

  const recordSegment = (segment?: string) => {
    if (!segment) return;
    const parsed = parseStaffSessionCookieValue(segment);
    if (!parsed || parsed.isExpired) return;
    const issuedAt = parsed.issuedAt || now;
    const expiresAt = parsed.expiresAt || issuedAt + STAFF_SESSION_DURATION_MS;
    if (now > expiresAt) return;

    const existing = activeMap.get(parsed.canonicalRole);
    if (!existing || issuedAt >= existing.issuedAt) {
      activeMap.set(parsed.canonicalRole, {
        role: parsed.canonicalRole,
        signature: parsed.signature,
        issuedAt,
        expiresAt,
      });
    }
  };

  // 1. Check combined cookie (`role1:sig1:ts1|role2:sig2:ts2`)
  const combinedRaw = cookieGetter(STAFF_SESSION_COOKIE);
  if (combinedRaw) {
    for (const seg of combinedRaw.split("|")) {
      recordSegment(seg);
    }
  }

  // 2. Check individual per-role cookies (`smol_staff_role_admin`, `smol_staff_role_cashier`, etc.)
  for (const r of ALL_CANONICAL_STAFF_ROLES) {
    const roleRaw = cookieGetter(getRoleSpecificCookieName(r));
    if (roleRaw) {
      recordSegment(roleRaw);
    }
  }

  return activeMap;
}

/**
 * Sets the staff session cookie for a role while preserving all other concurrently logged-in roles.
 * Allows a founder or staff user to have Admin, Cashier, Barista, and Kitchen open simultaneously
 * in the same browser without any role logging out another role.
 */
export async function setStaffSessionCookie(
  role: "kitchen" | "barista" | "cashier" | "admin" | "super_admin",
  signature?: string,
  customIssuedAt?: number
): Promise<{
  issuedAt: number;
  expiresAt: number;
  activeRoles: CanonicalStaffRole[];
}> {
  const cookieStore = await cookies();
  const canonicalRole: CanonicalStaffRole =
    role === "super_admin" ? "admin" : role;

  let sig = signature;
  if (!sig) {
    try {
      const creds = await getStoredCredentials();
      const cred = creds[canonicalRole];
      if (cred) {
        sig = generateRoleCredentialToken(
          canonicalRole,
          cred.pin,
          cred.password
        );
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
  const remainingSeconds = Math.max(1, Math.floor((expiresAt - now) / 1000));

  // Read existing active sessions across all roles so we never overwrite other open role tabs
  const activeMap = extractActiveRoleSessionsFromCookies(
    (name) => cookieStore.get(name)?.value
  );

  activeMap.set(canonicalRole, {
    role: canonicalRole,
    signature: sig || "active",
    issuedAt,
    expiresAt,
  });

  // 1. Set the dedicated per-role cookie (`smol_staff_role_<role>`)
  const singleRoleVal = `${canonicalRole}:${sig || "active"}:${issuedAt}`;
  cookieStore.set(getRoleSpecificCookieName(canonicalRole), singleRoleVal, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: remainingSeconds,
    expires: new Date(expiresAt),
  });

  // 2. Set the combined multi-role cookie (`smol_staff_session`) with most recently active role first
  const orderedEntries = Array.from(activeMap.values()).sort(
    (a, b) =>
      (a.role === canonicalRole ? -1 : b.role === canonicalRole ? 1 : 0) ||
      b.issuedAt - a.issuedAt
  );
  const combinedCookieVal = orderedEntries
    .map((e) => `${e.role}:${e.signature || "active"}:${e.issuedAt}`)
    .join("|");

  const maxExpiresAt = Math.max(
    expiresAt,
    ...orderedEntries.map((e) => e.expiresAt)
  );
  const maxRemainingSeconds = Math.max(
    1,
    Math.floor((maxExpiresAt - now) / 1000)
  );

  cookieStore.set(STAFF_SESSION_COOKIE, combinedCookieVal, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxRemainingSeconds,
    expires: new Date(maxExpiresAt),
  });

  return {
    issuedAt,
    expiresAt,
    activeRoles: orderedEntries.map((e) => e.role),
  };
}

/**
 * Clears staff session cookie(s) upon explicit logout.
 * If `roleToClear` is provided, only that specific role is logged out while keeping
 * any other concurrently open role tabs active! If omitted, clears all roles.
 */
export async function clearStaffSessionCookie(
  roleToClear?: "kitchen" | "barista" | "cashier" | "admin" | "super_admin"
): Promise<void> {
  const cookieStore = await cookies();

  if (roleToClear) {
    const canonical =
      roleToClear === "super_admin" ? "admin" : roleToClear;
    const activeMap = extractActiveRoleSessionsFromCookies(
      (name) => cookieStore.get(name)?.value
    );
    activeMap.delete(canonical);
    cookieStore.delete(getRoleSpecificCookieName(canonical));

    if (activeMap.size === 0) {
      cookieStore.delete(STAFF_SESSION_COOKIE);
    } else {
      const now = Date.now();
      const remainingEntries = Array.from(activeMap.values()).sort(
        (a, b) => b.issuedAt - a.issuedAt
      );
      const combinedVal = remainingEntries
        .map((e) => `${e.role}:${e.signature || "active"}:${e.issuedAt}`)
        .join("|");
      const maxExpiresAt = Math.max(
        ...remainingEntries.map((e) => e.expiresAt)
      );
      const maxRemainingSeconds = Math.max(
        1,
        Math.floor((maxExpiresAt - now) / 1000)
      );
      cookieStore.set(STAFF_SESSION_COOKIE, combinedVal, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: maxRemainingSeconds,
        expires: new Date(maxExpiresAt),
      });
    }
    return;
  }

  cookieStore.delete(STAFF_SESSION_COOKIE);
  for (const r of ALL_CANONICAL_STAFF_ROLES) {
    cookieStore.delete(getRoleSpecificCookieName(r));
  }
}

/**
 * Server-Side RBAC Guard: Validates that the request has an active authenticated staff session
 * matching ANY of the allowedRoles across all simultaneously logged-in roles.
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
  const activeMap = extractActiveRoleSessionsFromCookies(
    (name) => cookieStore.get(name)?.value
  );

  // In local mock database development, allow requests if no cookie is set
  if (
    isMockDatabase() &&
    process.env.NODE_ENV !== "production" &&
    activeMap.size === 0 &&
    !cookieStore.get(STAFF_SESSION_COOKIE)?.value
  ) {
    return {
      authorized: true,
      role: "admin",
      activeRoles: ["admin"],
    };
  }

  // 1. Check Multi-Role 12-Hour Staff Cookies
  if (activeMap.size > 0) {
    const activeRoles = Array.from(activeMap.keys());
    const normalizedAllowed = new Set(
      allowedRoles
        .map((r) => normalizeToCanonicalRole(r))
        .filter((r): r is CanonicalStaffRole => Boolean(r))
    );

    // First check if a directly matching role is active (e.g. cashier tab checks cashier, kitchen tab checks kitchen)
    for (const r of activeRoles) {
      if (normalizedAllowed.has(r)) {
        const entry = activeMap.get(r)!;
        return {
          authorized: true,
          role: r,
          activeRoles,
          issuedAt: entry.issuedAt,
          expiresAt: entry.expiresAt,
        };
      }
    }

    // Super admin & admin have access to all dashboards
    if (activeMap.has("admin")) {
      const adminEntry = activeMap.get("admin")!;
      return {
        authorized: true,
        role: "admin",
        activeRoles,
        issuedAt: adminEntry.issuedAt,
        expiresAt: adminEntry.expiresAt,
      };
    }

    const firstActive = activeMap.values().next().value as ActiveRoleSessionEntry;
    return {
      authorized: false,
      error: "FORBIDDEN",
      role: firstActive.role,
      activeRoles,
      message: `Access denied. Your active staff role (${activeRoles.join(", ")}) cannot access this section.`,
    };
  }

  // If raw cookie existed but all entries were expired
  if (cookieStore.get(STAFF_SESSION_COOKIE)?.value) {
    return {
      authorized: false,
      error: "AUTH_REQUIRED",
      message:
        "Your 12-hour staff session has expired. Please log in again at /smol-backdoor.",
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
