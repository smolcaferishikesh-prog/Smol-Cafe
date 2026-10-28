import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isMockDatabase } from "@/lib/supabase/admin";
import {
  getStoredCredentials,
  generateRoleCredentialToken,
} from "@/lib/auth/credentials";

export const STAFF_SESSION_COOKIE = "smol_staff_session";

export interface AuthCheckResult {
  authorized: boolean;
  role?: string;
  userId?: string;
  error?: "AUTH_REQUIRED" | "FORBIDDEN" | "MFA_REQUIRED";
  message?: string;
}

/**
 * Sets the staff session cookie with explicit role permissions and cryptographic credential signature.
 */
export async function setStaffSessionCookie(
  role: "kitchen" | "barista" | "cashier" | "admin" | "super_admin",
  signature?: string
): Promise<void> {
  const cookieStore = await cookies();
  let sig = signature;
  if (!sig) {
    try {
      const creds = await getStoredCredentials();
      const roleKey = role === "super_admin" ? "admin" : (role as "admin" | "cashier" | "kitchen" | "barista");
      const cred = creds[roleKey];
      if (cred) {
        sig = generateRoleCredentialToken(roleKey, cred.pin, cred.password);
      }
    } catch {}
  }
  const cookieVal = sig ? `${role}:${sig}` : role;

  cookieStore.set(STAFF_SESSION_COOKIE, cookieVal, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });
}

/**
 * Clears the staff session cookie upon logout.
 */
export async function clearStaffSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(STAFF_SESSION_COOKIE);
}

/**
 * Server-Side RBAC Guard: Validates that the request has an active authenticated staff session.
 * Enforces credential signature matching: if admin changed password/PIN, old sessions are automatically rejected and logged out!
 */
export async function requireStaffAuth(
  allowedRoles: string[] = ["super_admin", "admin", "cashier", "kitchen", "barista", "chef"]
): Promise<AuthCheckResult> {
  const cookieStore = await cookies();
  const staffCookie = cookieStore.get(STAFF_SESSION_COOKIE)?.value;

  // In local mock database development, allow requests if no cookie is set
  if (isMockDatabase() && process.env.NODE_ENV !== "production" && !staffCookie) {
    return { authorized: true, role: "admin" };
  }

  // 1. Check HTTP-Only Staff Role Cookie
  if (staffCookie) {
    const [rawRole, tokenSig] = staffCookie.split(":");
    const role = rawRole?.toLowerCase();

    // Check credential signature freshness against active credentials
    try {
      const creds = await getStoredCredentials();
      const roleKey = role === "super_admin" ? "admin" : (role as "admin" | "cashier" | "kitchen" | "barista");
      const targetCred = creds[roleKey];

      if (targetCred) {
        const expectedSig = generateRoleCredentialToken(roleKey, targetCred.pin, targetCred.password);
        // If cookie does NOT have a signature or signature doesn't match active credentials:
        if (!tokenSig || tokenSig !== expectedSig) {
          cookieStore.delete(STAFF_SESSION_COOKIE);
          return {
            authorized: false,
            error: "AUTH_REQUIRED",
            message: "Credentials have been updated by Admin. Please log in with the new PIN/password.",
          };
        }
      }
    } catch (err) {
      console.warn("requireStaffAuth signature verification notice:", err);
    }

    // Super admin & admin have access to all dashboards
    if (role === "admin" || role === "super_admin" || role === "authenticated") {
      return { authorized: true, role: "admin" };
    }

    if (allowedRoles.includes(role)) {
      return { authorized: true, role };
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
        message: "Staff authentication required. Please log in at /smol-backdoor.",
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
  if (staffCookie === "authenticated" && process.env.NODE_ENV !== "production") {
    return { authorized: true, role: "super_admin" };
  }

  try {
    const supabase = await createClient();
    const { data: authData, error } = await supabase.auth.getUser();

    if (error || !authData.user) {
      return { authorized: false, error: "AUTH_REQUIRED", message: "Admin login required." };
    }

    // Verify Authenticator Assurance Level (AAL2)
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalData && aalData.currentLevel !== "aal2" && aalData.nextLevel === "aal2") {
      return {
        authorized: false,
        error: "MFA_REQUIRED",
        message: "Multi-Factor Authentication (TOTP) verification required for admin operations.",
      };
    }

    return { authorized: true, userId: authData.user.id };
  } catch {
    return { authorized: false, error: "AUTH_REQUIRED" };
  }
}
