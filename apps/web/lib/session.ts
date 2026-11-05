import crypto from "crypto";
import { cookies } from "next/headers";

export const TABLE_SESSION_COOKIE = "smol_table_session";
export const TABLE_ACTIVE_COOKIE = "smol_table_active";

export interface TableSessionData {
  sessionId: string;
  tableId: string;
  tableLabel: string;
  locationId: string;
  locationName: string;
  openedAt: string;
  customerSessionId?: string;
  verificationCode?: string;
  guestName?: string;
  guestPhone?: string;
}

export function isValidUuid(id: string | null | undefined): boolean {
  if (!id || typeof id !== "string") return false;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const isMock =
    !supabaseUrl ||
    supabaseUrl.includes("placeholder") ||
    (!supabaseUrl.startsWith("http://") && !supabaseUrl.startsWith("https://"));
  if (isMock) return true;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

const SESSION_SECRET = process.env.SESSION_SECRET || "smol-cafe-secret-session-key-2026";

/**
 * Creates an HMAC signature for the given payload string.
 */
function sign(value: string): string {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

/**
 * Encodes and signs session data into a secure cookie value.
 */
export function encodeSession(data: TableSessionData): string {
  const json = JSON.stringify(data);
  const base64 = Buffer.from(json, "utf-8").toString("base64url");
  const signature = sign(base64);
  return `${base64}.${signature}`;
}

/**
 * Decodes and verifies a signed session cookie.
 */
export function decodeSession(cookieValue: string): TableSessionData | null {
  try {
    const parts = cookieValue.split(".");
    if (parts.length !== 2) return null;

    const [base64, signature] = parts;
    const expectedSignature = sign(base64);

    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature, "utf-8"),
        Buffer.from(expectedSignature, "utf-8")
      )
    ) {
      return null;
    }

    const json = Buffer.from(base64, "base64url").toString("utf-8");
    const data = JSON.parse(json) as TableSessionData;

    // Ensure sessionId is a valid UUID to prevent Postgres 22P02 errors
    if (!isValidUuid(data.sessionId)) {
      return null;
    }

    // Ensure customerSessionId exists for order ownership validation
    if (!data.customerSessionId && data.sessionId) {
      data.customerSessionId = `cust_${data.sessionId}`;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Sets the signed table session cookie.
 */
export async function setTableSessionCookie(data: TableSessionData): Promise<void> {
  try {
    const cookieStore = await cookies();
    const value = encodeSession(data);

    cookieStore.set(TABLE_SESSION_COOKIE, value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12, // 12 hours
    });

    // Companion client-accessible flag for UI components (e.g. BottomNavBar visibility)
    cookieStore.set(TABLE_ACTIVE_COOKIE, "1", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
  } catch {
    // Ignored if called during Server Component render phase
  }
}


/**
 * Reads and verifies the table session from cookies.
 */
export async function getTableSessionCookie(): Promise<TableSessionData | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(TABLE_SESSION_COOKIE);
    if (!cookie?.value) return null;
    return decodeSession(cookie.value);
  } catch {
    return null;
  }
}

/**
 * Clears the table session cookie.
 */
export async function clearTableSessionCookie(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(TABLE_SESSION_COOKIE);
    cookieStore.delete(TABLE_ACTIVE_COOKIE);
  } catch {
    // Outside active request context
  }
}
