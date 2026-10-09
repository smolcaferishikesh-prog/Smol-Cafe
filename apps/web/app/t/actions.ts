"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  setTableSessionCookie,
  clearTableSessionCookie,
  getTableSessionCookie,
  type TableSessionData,
} from "@/lib/session";
import type { TableQrToken, DiningTable, TableSession } from "@smol-cafe/db";
import { TABLE_ZONES_CONFIG } from "@/lib/table-tag";

export interface ResolveQrResult {
  success: boolean;
  error?: "INVALID_TOKEN" | "REVOKED_TOKEN" | "TABLE_INACTIVE" | "DB_ERROR";
  message?: string;
  session?: TableSessionData;
}

/**
 * Computes SHA-256 hash of a string.
 */
function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(str?: string | null): boolean {
  return Boolean(str && UUID_REGEX.test(str));
}

async function getDefaultLocationId(supabase: ReturnType<typeof createAdminClient>): Promise<string> {
  let locationId: string | null = (globalThis as unknown as { __SMOL_DEFAULT_LOCATION_ID__?: string }).__SMOL_DEFAULT_LOCATION_ID__ || null;
  if (locationId && isUuid(locationId)) {
    return locationId;
  }
  try {
    const { data: loc } = await supabase.from("locations").select("id").limit(1).maybeSingle();
    if (loc?.id && isUuid(loc.id)) {
      (globalThis as unknown as { __SMOL_DEFAULT_LOCATION_ID__?: string }).__SMOL_DEFAULT_LOCATION_ID__ = loc.id;
      return loc.id;
    }
    const { data: newLoc } = await supabase
      .from("locations")
      .insert({ name: "Smol Café · Rishikesh", timezone: "Asia/Kolkata" })
      .select("id")
      .single();
    if (newLoc?.id && isUuid(newLoc.id)) {
      (globalThis as unknown as { __SMOL_DEFAULT_LOCATION_ID__?: string }).__SMOL_DEFAULT_LOCATION_ID__ = newLoc.id;
      return newLoc.id;
    }
  } catch (e) {
    console.warn("Could not resolve location UUID:", e);
  }
  return "00000000-0000-0000-0000-000000000001";
}

/**
 * Server Action: Resolves a QR token, validates against table_qr_tokens,
 * finds or creates an active OPEN session on the dining table,
 * and sets a signed session cookie.
 */
export async function resolveQrToken(
  rawToken: string,
  setCookie = true,
  guestName?: string,
  guestPhone?: string
): Promise<ResolveQrResult> {
  if (!rawToken || typeof rawToken !== "string") {
    return {
      success: false,
      error: "INVALID_TOKEN",
      message: "This QR code is invalid. Please ask staff for assistance.",
    };
  }

  const cleanedRaw = rawToken.trim();
  let plainToken = cleanedRaw;
  try {
    plainToken = decodeURIComponent(cleanedRaw);
  } catch {
    plainToken = cleanedRaw;
  }
  const tokenHash = hashToken(plainToken);

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (err) {
    console.error("Failed to initialize Supabase client:", err);
    return {
      success: false,
      error: "DB_ERROR",
      message: "Could not connect to the database. Please try again.",
    };
  }

  try {
    // Check existing cookie for guest details if not supplied
    const existingCookie = await getTableSessionCookie().catch(() => null);
    const finalGuestName = guestName || existingCookie?.guestName;
    const finalGuestPhone = guestPhone || existingCookie?.guestPhone;

    // 1. Query table_qr_tokens by hash, plain token, or standardized table-XX format
    const matchDigits = plainToken.match(/(\d+)/);
    const standardTableLabel = matchDigits ? matchDigits[1].padStart(2, "0") : "";
    const rawNumberLabel = matchDigits ? parseInt(matchDigits[1], 10).toString() : "";
    const standardTokenHash = standardTableLabel ? `table-${standardTableLabel}` : "";

    const queryFilters = [
      `token_hash.eq.${tokenHash}`,
      `token_hash.eq.${plainToken}`,
    ];
    if (standardTokenHash && standardTokenHash !== plainToken) {
      queryFilters.push(`token_hash.eq.${standardTokenHash}`);
    }

    const { data: qrTokens, error: qrError } = await supabase
      .from("table_qr_tokens")
      .select("*")
      .or(queryFilters.join(","))
      .limit(1);

    let diningTable: DiningTable | null = null;
    let qrVersion = 1;

    if (!qrError && qrTokens && qrTokens.length > 0) {
      const qrToken = qrTokens[0] as unknown as TableQrToken;
      // If token wasn't revoked, resolve linked table
      if (!qrToken.revoked_at) {
        qrVersion = qrToken.version || 1;
        const { data: table } = await supabase
          .from("dining_tables")
          .select("*")
          .eq("id", qrToken.table_id)
          .maybeSingle();

        if (table) {
          diningTable = table as unknown as DiningTable;
        }
      }
    }

    // Fallback 1: match table number directly or resolve table by label (padded and unpadded)
    if (!diningTable && (standardTableLabel || plainToken)) {
      const targetLabel = standardTableLabel || plainToken;
      let query = supabase.from("dining_tables").select("*");
      if (rawNumberLabel && rawNumberLabel !== targetLabel) {
        query = query.or(`label.eq.${targetLabel},label.eq.${rawNumberLabel}`);
      } else {
        query = query.eq("label", targetLabel);
      }
      const { data: tableByLabel } = await query.limit(1).maybeSingle();

      if (tableByLabel) {
        diningTable = tableByLabel as unknown as DiningTable;
      }
    }

    // Fallback 2: Auto-provision standard cafe table if missing
    if (!diningTable && standardTableLabel) {
      const tableConfig = TABLE_ZONES_CONFIG[standardTableLabel] || {
        zone: "Café",
        capacity: 4,
      };
      const validLocationId = await getDefaultLocationId(supabase);
      try {
        const { data: insertedTable } = await supabase
          .from("dining_tables")
          .insert({
            location_id: validLocationId,
            label: standardTableLabel,
            seats: tableConfig.capacity,
            active: true,
          })
          .select()
          .maybeSingle();

        if (insertedTable) {
          diningTable = insertedTable as unknown as DiningTable;
          // Also create standard QR token
          await supabase.from("table_qr_tokens").insert({
            table_id: insertedTable.id,
            token_hash: `table-${standardTableLabel}`,
            version: 1,
          });
        }
      } catch (upsertErr) {
        console.warn("Could not insert dining table:", upsertErr);
      }

      if (!diningTable) {
        const now = new Date().toISOString();
        diningTable = {
          id: `tbl_${standardTableLabel}`,
          location_id: validLocationId,
          label: standardTableLabel,
          seats: tableConfig.capacity,
          active: true,
          created_at: now,
          updated_at: now,
        };
      }
    }

    if (!diningTable) {
      return {
        success: false,
        error: "INVALID_TOKEN",
        message: "This table does not exist. Please scan a valid table QR or select your table from the welcome screen.",
      };
    }

    // If diningTable is found, ensure active status
    if (!diningTable.active) {
      // Auto-activate known standard cafe tables if temporarily inactive
      if (standardTableLabel && TABLE_ZONES_CONFIG[standardTableLabel]) {
        await supabase.from("dining_tables").update({ active: true }).eq("id", diningTable.id);
        diningTable.active = true;
      } else {
        return {
          success: false,
          error: "TABLE_INACTIVE",
          message: "This table is currently not in service. Please check with staff.",
        };
      }
    }

    // Fetch location name
    const validLocationId = isUuid(diningTable.location_id)
      ? diningTable.location_id
      : await getDefaultLocationId(supabase);

    let locationName = "Smol Café";
    if (isUuid(validLocationId)) {
      try {
        const { data: location } = await supabase
          .from("locations")
          .select("name")
          .eq("id", validLocationId)
          .maybeSingle();
        if (location?.name) {
          locationName = location.name;
        }
      } catch (err) {
        console.warn("Could not fetch location name:", err);
      }
    }

    // 3. Find existing OPEN table session
    let { data: existingSession } = await supabase
      .from("table_sessions")
      .select("*")
      .eq("table_id", diningTable.id)
      .eq("status", "OPEN")
      .maybeSingle();

    // Auto-close stale sessions (> 3 hours inactive)
    if (existingSession) {
      const MAX_INACTIVITY_MS = 3 * 60 * 60 * 1000;
      const lastActive = new Date(existingSession.last_activity_at || existingSession.opened_at).getTime();
      if (Date.now() - lastActive > MAX_INACTIVITY_MS) {
        await supabase
          .from("table_sessions")
          .update({ status: "CLOSED", closed_at: new Date().toISOString() })
          .eq("id", existingSession.id);
        existingSession = null;
      }
    }

    let sessionId: string;
    let openedAt: string;

    if (existingSession) {
      const activeSession = existingSession as unknown as TableSession;
      sessionId = activeSession.id;
      openedAt = activeSession.opened_at;

      // Update last activity timestamp
      await supabase
        .from("table_sessions")
        .update({ last_activity_at: new Date().toISOString() })
        .eq("id", sessionId);
    } else {
      // Create new OPEN table session
      const now = new Date().toISOString();
      const sessionLocationId = isUuid(diningTable.location_id)
        ? diningTable.location_id
        : await getDefaultLocationId(supabase);

      let dbTableId = diningTable.id;
      if (!isUuid(dbTableId)) {
        const { data: realTable } = await supabase
          .from("dining_tables")
          .select("id")
          .eq("label", diningTable.label)
          .limit(1)
          .maybeSingle();
        if (realTable?.id && isUuid(realTable.id)) {
          dbTableId = realTable.id;
          diningTable.id = realTable.id;
        }
      }

      const { data: newSession, error: insertError } = await supabase
        .from("table_sessions")
        .insert({
          location_id: sessionLocationId,
          table_id: dbTableId,
          status: "OPEN",
          opened_at: now,
          last_activity_at: now,
          guest_count: 1,
          session_token_version: qrVersion,
        })
        .select("*")
        .single();

      if (insertError || !newSession) {
        console.error("Failed to create table session:", insertError);
        return {
          success: false,
          error: "DB_ERROR",
          message: "Unable to start a dining session. Please ask staff.",
        };
      }

      const createdSession = newSession as unknown as TableSession;
      sessionId = createdSession.id;
      openedAt = createdSession.opened_at;
    }

    // Generate secure 4-digit verification code (e.g. 4821)
    const verificationCode = (existingSession as { verification_code?: string })?.verification_code ||
      String(Math.floor(1000 + Math.random() * 9000));
    const customerSessionId = `cust_${sessionId}_${Math.random().toString(36).slice(2, 7)}`;

    // 4. Set signed session cookie if requested
    const sessionData: TableSessionData = {
      sessionId,
      tableId: diningTable.id,
      tableLabel: diningTable.label,
      locationId: diningTable.location_id,
      locationName,
      openedAt,
      customerSessionId,
      verificationCode,
      guestName: finalGuestName,
      guestPhone: finalGuestPhone,
    };

    if (setCookie) {
      await setTableSessionCookie(sessionData);
    }

    return {
      success: true,
      session: sessionData,
    };
  } catch (error) {
    console.error("Error in resolveQrToken:", error);
    return {
      success: false,
      error: "DB_ERROR",
      message: "An unexpected error occurred while resolving table session.",
    };
  }
}

import { getPhoneUuid, normalizePhoneNumber } from "@/lib/customer-phone";

/**
 * Server Action: Onboards guest with Name & Phone number, updates table session,
 * and enables redirecting to /home instead of menu.
 */
export async function onboardGuestAndRedirectAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const token = (formData.get("tableToken") as string) || "table-01";
  const guestName = (formData.get("guestName") as string || "").trim();
  const guestPhone = (formData.get("guestPhone") as string || "").trim();

  if (!guestName || guestName.length < 2) {
    return { success: false, error: "Please enter your name." };
  }
  const e164Phone = normalizePhoneNumber(guestPhone);
  if (!e164Phone || e164Phone.length < 8 || !e164Phone.startsWith("+")) {
    return { success: false, error: "Please enter a valid international mobile number." };
  }

  const result = await resolveQrToken(token, true, guestName, e164Phone);

  if (!result.success) {
    return { success: false, error: result.message || "Failed to start table session." };
  }

  // Non-blocking profile upsert in background so guest onboarding is instantaneous
  (async () => {
    try {
      const supabase = createAdminClient();
      const phoneUuid = getPhoneUuid(e164Phone);
      await supabase.from("profiles").upsert(
        {
          id: phoneUuid,
          display_name: guestName,
          phone: e164Phone,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "phone" }
      );
    } catch (err) {
      console.warn("Could not upsert profile during onboarding:", err);
    }
  })();

  return { success: true };
}

/**
 * Server Action: Establishes an anonymous dining session for guests skipping onboarding.
 * Ensures the table session is created in the database and the signed JWT session cookie
 * is set before navigating to /home.
 */
export async function skipGuestOnboardingAction(tableToken: string): Promise<{ success: boolean; tableLabel?: string; error?: string }> {
  const token = tableToken || "table-01";
  const result = await resolveQrToken(token, true, "Guest", undefined);
  if (!result.success || !result.session) {
    return { success: false, error: result.message || "Failed to establish table session." };
  }
  return { success: true, tableLabel: result.session.tableLabel };
}

/**
 * Server Action: Activates table session from form action and redirects to /home.
 */
export async function activateTableAndRedirectAction(formData: FormData): Promise<void> {
  const token = formData.get("tableToken") as string;
  const guestName = (formData.get("guestName") as string || "").trim();
  const guestPhone = (formData.get("guestPhone") as string || "").trim();
  if (token) {
    await resolveQrToken(token, true, guestName || undefined, guestPhone || undefined);
  }
  redirect("/home");
}

/**
 * Server Action: Clears the current table session and redirects to home.
 */
export async function clearTableSession(): Promise<void> {
  await clearTableSessionCookie();
  redirect("/home");
}

/**
 * Server Action: Switches the active table session dynamically for multi-user/multi-table support.
 */
export async function switchTableSessionAction(tableLabel: string): Promise<{ success: boolean; message?: string }> {
  const token = `table-${tableLabel.toString().padStart(2, "0")}`;
  const result = await resolveQrToken(token, true);
  return {
    success: result.success,
    message: result.message,
  };
}

export interface ClientTableInfo {
  label: string;
  zone: string;
  capacity: number;
  active: boolean;
}

/**
 * Server Action: Fetches all active dining tables dynamically from Supabase database.
 */
export async function fetchActiveTablesAction(): Promise<ClientTableInfo[]> {
  const defaultZoneMap: Record<string, string> = {
    "01": "smol-cafe",
    "02": "smol-cafe",
    "03": "smol-cafe",
    "04": "smol-cafe",
    "05": "smol-cafe",
    "06": "smol-cafe",
    "07": "smol-lounge",
    "08": "smol-lounge",
    "09": "smol-lounge",
    "10": "smol-lounge",
    "11": "smol-terrace",
    "12": "smol-terrace",
    "13": "smol-terrace",
    "14": "smol-terrace",
  };

  try {
    const supabase = createAdminClient();
    const { data: tablesData, error } = await supabase
      .from("dining_tables")
      .select("*")
      .order("label", { ascending: true });

    if (error || !tablesData || tablesData.length === 0) {
      return Array.from({ length: 14 }, (_, i) => {
        const label = (i + 1).toString().padStart(2, "0");
        const info = TABLE_ZONES_CONFIG[label] || { zone: "smol-cafe", capacity: 2 };
        return { label, zone: info.zone, capacity: info.capacity, active: true };
      });
    }

    const sectionMap = globalThis.__SMOL_TABLE_SECTIONS_MAP__ || defaultZoneMap;

    const mappedTables = tablesData
      .filter((t: any) => t.active !== false)
      .map((t: any) => {
        const cleanNum = (t.label || "").toString().padStart(2, "0");
        const zone =
          sectionMap[t.id] ||
          sectionMap[t.label] ||
          sectionMap[cleanNum] ||
          TABLE_ZONES_CONFIG[cleanNum]?.zone ||
          "Café";
        const capacity = t.seats || TABLE_ZONES_CONFIG[cleanNum]?.capacity || 2;
        return {
          label: cleanNum,
          zone,
          capacity,
          active: t.active !== false,
        };
      });

    // Natural sort tables by numeric value or alphanumeric string
    return mappedTables.sort((a, b) => {
      const numA = parseInt(a.label, 10);
      const numB = parseInt(b.label, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.label.localeCompare(b.label);
    });
  } catch (err) {
    console.error("fetchActiveTablesAction error:", err);
    return Array.from({ length: 10 }, (_, i) => {
      const label = (i + 1).toString().padStart(2, "0");
      const info = TABLE_ZONES_CONFIG[label] || { zone: "Café", capacity: 2 };
      return { label, zone: info.zone, capacity: info.capacity, active: true };
    });
  }
}


