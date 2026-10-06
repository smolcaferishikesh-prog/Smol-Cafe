import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const STAFF_SESSION_COOKIE = "smol_staff_session";

export interface AuthCheckResult {
  authorized: boolean;
  role?: string;
  userId?: string;
  error?: "AUTH_REQUIRED" | "FORBIDDEN" | "MFA_REQUIRED";
  message?: string;
}

/**
 * Sets the staff session cookie with explicit role permissions.
 */
export async function setStaffSessionCookie(
  role: "kitchen" | "barista" | "cashier" | "admin" | "super_admin"
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(STAFF_SESSION_COOKIE, role, {
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
 * Checks both the HTTP-only staff session cookie and Supabase JWT app_metadata role.
 */
export async function requireStaffAuth(
  allowedRoles: string[] = ["super_admin", "admin", "cashier", "kitchen", "barista", "chef"]
): Promise<AuthCheckResult> {
  const cookieStore = await cookies();
  const staffCookie = cookieStore.get(STAFF_SESSION_COOKIE)?.value;

  // 1. Check HTTP-Only Staff Role Cookie
  if (staffCookie) {
    const role = staffCookie.toLowerCase();
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
