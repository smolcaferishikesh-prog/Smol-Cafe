"use server";

import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffAuth } from "@/lib/auth/rbac";
import { broadcastSyncEvent } from "@/lib/sync-events";
import { invalidateAdminOverviewCache } from "@/app/admin/actions";
import {
  filterDeletedTables,
  recordDeletedTable,
  unrecordDeletedTable,
  getPersistedSectionsMap,
  getPersistedCustomSections,
  recordTableSection,
  recordCustomSection,
  deleteCustomSectionFromStore,
} from "@/lib/table-store";

export interface DiningTableRecord {
  id: string;
  location_id: string;
  label: string;
  seats: number;
  active: boolean;
  section: string;
  isOccupied?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateTableInput {
  label: string;
  section: string;
  seats: number;
  active?: boolean;
}

export interface UpdateTableInput {
  label?: string;
  section?: string;
  seats?: number;
  active?: boolean;
}

const DEFAULT_SECTIONS = [
  "smol-cafe",
  "smol-lounge",
  "smol-terrace",
];

const LEGACY_SECTIONS = new Set([
  "Café",
  "Cafe",
  "Lounge",
  "Terrace",
  "Indoor Cozy",
  "Courtyard Verandah",
  "Garden Terrace",
  "Brew Bar",
]);

declare global {
  var __SMOL_CUSTOM_SECTIONS__: string[] | undefined;
  var __SMOL_TABLE_SECTIONS_MAP__: Record<string, string> | undefined;
  var __SMOL_DEFAULT_LOCATION_ID__: string | undefined;
  var __SMOL_HAS_SECTION_COLUMN__: boolean | undefined;
}

const DEFAULT_ZONE_MAP: Record<string, string> = {
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

function getActiveSectionsMap(): Record<string, string> {
  const persisted = getPersistedSectionsMap();
  if (!globalThis.__SMOL_TABLE_SECTIONS_MAP__) {
    globalThis.__SMOL_TABLE_SECTIONS_MAP__ = { ...DEFAULT_ZONE_MAP, ...persisted };
  } else {
    Object.assign(globalThis.__SMOL_TABLE_SECTIONS_MAP__, persisted);
  }
  return globalThis.__SMOL_TABLE_SECTIONS_MAP__;
}

// Clean legacy custom sections
if (globalThis.__SMOL_CUSTOM_SECTIONS__) {
  globalThis.__SMOL_CUSTOM_SECTIONS__ = globalThis.__SMOL_CUSTOM_SECTIONS__.filter(
    (s) => !LEGACY_SECTIONS.has(s)
  );
}

function getSectionsList(tables: DiningTableRecord[]): string[] {
  const persistedCustom = getPersistedCustomSections();
  const custom = Array.from(
    new Set([...(globalThis.__SMOL_CUSTOM_SECTIONS__ || []), ...persistedCustom])
  ).filter((s) => !LEGACY_SECTIONS.has(s));
  const fromTables = tables
    .map((t) => t.section)
    .filter((s) => Boolean(s) && !LEGACY_SECTIONS.has(s));
  const combined = Array.from(new Set([...DEFAULT_SECTIONS, ...custom, ...fromTables]));
  return combined;
}

/**
 * Fetch all dining tables, floor sections, and occupancy status
 */
export async function fetchTablesAndSectionsAction(): Promise<{
  success: boolean;
  tables: DiningTableRecord[];
  sections: string[];
  message?: string;
}> {
  try {
    const supabase = createAdminClient();

    // 1. Fetch tables and active sessions concurrently in parallel
    const [tablesRes, sessionsRes] = await Promise.all([
      supabase
        .from("dining_tables")
        .select("*")
        .order("label", { ascending: true }),
      supabase
        .from("table_sessions")
        .select("id, table_id, status")
        .in("status", ["OPEN", "PAYMENT_PENDING"]),
    ]);

    if (tablesRes.error) {
      console.error("fetchTables error:", tablesRes.error);
      return { success: false, tables: [], sections: DEFAULT_SECTIONS, message: tablesRes.error.message };
    }

    const tablesData = tablesRes.data;
    const sessionsData = (sessionsRes.data || []) as Array<{ id: string; table_id: string; status: string }>;

    // Cache location_id from existing tables so createTableAction never needs an extra DB lookup
    if (tablesData && tablesData.length > 0 && tablesData[0].location_id) {
      globalThis.__SMOL_DEFAULT_LOCATION_ID__ = tablesData[0].location_id;
    }

    // A table is occupied ONLY after a customer places an order on an open session
    // and until the Cashier marks the table available (which closes the session)
    const openSessionIds = sessionsData.map((s) => s.id).filter(Boolean);
    const sessionsWithOrders = new Set<string>();

    if (openSessionIds.length > 0) {
      const { data: activeOrders } = await supabase
        .from("orders")
        .select("table_session_id, status")
        .in("table_session_id", openSessionIds);

      for (const ord of activeOrders || []) {
        if (ord.status !== "CANCELLED" && ord.status !== "REJECTED" && ord.table_session_id) {
          sessionsWithOrders.add(ord.table_session_id);
        }
      }
    }

    const occupiedTableIds = new Set(
      sessionsData
        .filter((s) => sessionsWithOrders.has(s.id))
        .map((s) => s.table_id)
    );
    const sectionMap = getActiveSectionsMap();

    const tables: DiningTableRecord[] = (tablesData || []).map((t: any) => {
      const cleanNum = t.label?.toString().padStart(2, "0");
      let section =
        (t.section && !LEGACY_SECTIONS.has(t.section) ? t.section : undefined) ||
        sectionMap[t.id] ||
        sectionMap[t.label] ||
        sectionMap[cleanNum] ||
        DEFAULT_ZONE_MAP[cleanNum] ||
        "smol-cafe";
      if (LEGACY_SECTIONS.has(section) || section === "Café" || section === "Lounge" || section === "Terrace") {
        section = DEFAULT_ZONE_MAP[cleanNum] || "smol-cafe";
      }
      return {
        id: t.id,
        location_id: t.location_id,
        label: t.label,
        seats: t.seats || (["07", "08", "09", "10"].includes(cleanNum) ? 4 : ["13", "14"].includes(cleanNum) ? 4 : 2),
        active: t.active !== undefined ? t.active : true,
        section,
        isOccupied: occupiedTableIds.has(t.id),
        created_at: t.created_at,
        updated_at: t.updated_at,
      };
    });

    const sections = getSectionsList(tables);
    const nonDeletedTables = filterDeletedTables(tables);

    return { success: true, tables: nonDeletedTables, sections };
  } catch (err: any) {
    console.error("fetchTablesAndSectionsAction unexpected error:", err);
    return { success: false, tables: [], sections: DEFAULT_SECTIONS, message: err?.message || "Error fetching tables" };
  }
}

/**
 * Add a new dining table (Parallelized & Non-Blocking)
 */
export async function createTableAction(input: CreateTableInput): Promise<{
  success: boolean;
  table?: DiningTableRecord;
  message?: string;
}> {
  const auth = await requireStaffAuth(["admin", "super_admin"]);
  if (!auth.authorized) {
    return { success: false, message: auth.message || "Unauthorized: Admin access required." };
  }

  try {
    const label = input.label.trim();
    if (!label) {
      return { success: false, message: "Table label or number is required." };
    }

    const supabase = createAdminClient();
    const cleanNum = label.padStart(2, "0");
    const section = input.section?.trim() || "smol-cafe";
    const seats = Number(input.seats) || 2;
    const active = input.active !== undefined ? input.active : true;

    // 1. Check duplicate label AND resolve locationId in parallel in a single round-trip
    const cachedLocationId = globalThis.__SMOL_DEFAULT_LOCATION_ID__ || null;
    const [existingRes, locRes] = await Promise.all([
      supabase
        .from("dining_tables")
        .select("id, active")
        .eq("label", label)
        .maybeSingle(),
      cachedLocationId
        ? Promise.resolve({ data: { id: cachedLocationId } })
        : supabase.from("locations").select("id").limit(1).maybeSingle(),
    ]);

    let locationId = cachedLocationId || locRes?.data?.id || null;
    if (!locationId) {
      const { data: newLoc } = await supabase
        .from("locations")
        .insert({ name: "smol café · rishikesh", timezone: "Asia/Kolkata" })
        .select("id")
        .single();
      locationId = newLoc?.id || "11111111-1111-1111-1111-111111111111";
    }
    globalThis.__SMOL_DEFAULT_LOCATION_ID__ = locationId;

    // If a soft-deleted/inactive table with this label exists in DB, reactivate & update it in 1 step
    let tableId = "";
    if (existingRes.data?.id) {
      const existingTable = existingRes.data as { id: string; active?: boolean };
      const isCurrentlyDeleted = !existingTable.active;
      if (!isCurrentlyDeleted) {
        // Also check if it was marked deleted in table-store
        const activeFiltered = filterDeletedTables([{ id: existingTable.id, label }]);
        if (activeFiltered.length > 0) {
          return { success: false, message: `Table "${label}" already exists. Please choose a unique name.` };
        }
      }
      tableId = existingTable.id;
      const updatePayload: Record<string, unknown> = {
        label,
        seats,
        active,
        ...(globalThis.__SMOL_HAS_SECTION_COLUMN__ !== false ? { section } : {}),
      };
      const upd = await supabase.from("dining_tables").update(updatePayload).eq("id", tableId);
      if (upd.error && upd.error.message?.includes("section")) {
        globalThis.__SMOL_HAS_SECTION_COLUMN__ = false;
        await supabase.from("dining_tables").update({ label, seats, active }).eq("id", tableId);
      }
    } else {
      // 2. Insert new dining table directly
      const generatedId = crypto.randomUUID();
      const insertPayload: Record<string, unknown> = {
        id: generatedId,
        location_id: locationId,
        label,
        seats,
        active,
        ...(globalThis.__SMOL_HAS_SECTION_COLUMN__ !== false ? { section } : {}),
      };

      const res = await supabase
        .from("dining_tables")
        .insert(insertPayload as any)
        .select("id")
        .single();

      if (res.error && res.error.message?.includes("section")) {
        globalThis.__SMOL_HAS_SECTION_COLUMN__ = false;
        const fallback = await supabase
          .from("dining_tables")
          .insert({
            id: generatedId,
            location_id: locationId,
            label,
            seats,
            active,
          })
          .select("id")
          .single();
        if (fallback.error) {
          return { success: false, message: fallback.error.message };
        }
        tableId = fallback.data?.id || generatedId;
      } else if (res.error) {
        return { success: false, message: res.error.message };
      } else {
        tableId = res.data?.id || generatedId;
      }
    }

    // 3. Single batched write to clear tombstones and record section
    unrecordDeletedTable([label, cleanNum, `table-${cleanNum}`, `t-${cleanNum}`, tableId]);
    recordTableSection(tableId, label, section);

    if (!globalThis.__SMOL_TABLE_SECTIONS_MAP__) {
      globalThis.__SMOL_TABLE_SECTIONS_MAP__ = {};
    }
    globalThis.__SMOL_TABLE_SECTIONS_MAP__[tableId] = section;
    globalThis.__SMOL_TABLE_SECTIONS_MAP__[label] = section;
    globalThis.__SMOL_TABLE_SECTIONS_MAP__[cleanNum] = section;

    if (!DEFAULT_SECTIONS.includes(section)) {
      recordCustomSection(section);
      if (!globalThis.__SMOL_CUSTOM_SECTIONS__) {
        globalThis.__SMOL_CUSTOM_SECTIONS__ = [];
      }
      if (!globalThis.__SMOL_CUSTOM_SECTIONS__.includes(section)) {
        globalThis.__SMOL_CUSTOM_SECTIONS__.push(section);
      }
    }

    // 4. Fire-and-forget QR token upsert and Realtime broadcast so response returns immediately
    const tokenStr = `table-${label.toLowerCase().replace(/\s+/g, "-")}`;
    void supabase
      .from("table_qr_tokens")
      .upsert(
        {
          table_id: tableId,
          token_hash: tokenStr,
          version: 1,
        },
        { onConflict: "token_hash" }
      )
      .then(() => {});

    void invalidateAdminOverviewCache();

    const newTable: DiningTableRecord = {
      id: tableId,
      location_id: locationId,
      label,
      seats,
      active,
      section,
      isOccupied: false,
    };

    void broadcastSyncEvent({
      type: "TABLE_CREATED",
      tableId,
      tableLabel: label,
      metadata: {
        id: tableId,
        label,
        seats,
        active,
        section,
        location_id: locationId,
      },
      timestamp: Date.now(),
    });

    return {
      success: true,
      table: newTable,
      message: `Table ${label} added successfully!`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to create table.";
    return { success: false, message: errorMsg };
  }
}

/**
 * Edit an existing dining table (Single Round-Trip)
 */
export async function updateTableAction(
  tableId: string,
  input: UpdateTableInput
): Promise<{
  success: boolean;
  table?: DiningTableRecord;
  message?: string;
}> {
  const auth = await requireStaffAuth(["admin", "super_admin"]);
  if (!auth.authorized) {
    return { success: false, message: auth.message || "Unauthorized: Admin access required." };
  }

  try {
    const supabase = createAdminClient();

    const dbUpdates: Record<string, unknown> = {};
    if (input.label !== undefined) dbUpdates.label = input.label.trim();
    if (input.seats !== undefined) dbUpdates.seats = Number(input.seats);
    if (input.active !== undefined) dbUpdates.active = input.active;
    if (input.section !== undefined && globalThis.__SMOL_HAS_SECTION_COLUMN__ !== false) {
      dbUpdates.section = input.section.trim();
    }

    let updated: Record<string, unknown> | null = null;
    if (Object.keys(dbUpdates).length > 0) {
      let { data, error: updateError } = await supabase
        .from("dining_tables")
        .update(dbUpdates)
        .eq("id", tableId)
        .select()
        .single();

      if (updateError && updateError.message?.includes("section")) {
        globalThis.__SMOL_HAS_SECTION_COLUMN__ = false;
        delete dbUpdates.section;
        const retry = await supabase
          .from("dining_tables")
          .update(dbUpdates)
          .eq("id", tableId)
          .select()
          .single();
        data = retry.data;
        updateError = retry.error;
      }

      if (updateError) {
        return { success: false, message: updateError.message };
      }
      updated = data as Record<string, unknown>;
    }

    const cleanNum = (updated?.label || input.label || "").toString().padStart(2, "0");
    const targetLabel = (updated?.label as string) || input.label || "";

    const effectiveSection =
      (input.section ? input.section.trim() : undefined) ||
      (updated?.section as string) ||
      globalThis.__SMOL_TABLE_SECTIONS_MAP__?.[tableId] ||
      globalThis.__SMOL_TABLE_SECTIONS_MAP__?.[cleanNum] ||
      "smol-cafe";

    if (input.section || effectiveSection) {
      const trimmedSection = (input.section || effectiveSection).trim();
      recordTableSection(tableId, targetLabel, trimmedSection);
      if (!globalThis.__SMOL_TABLE_SECTIONS_MAP__) {
        globalThis.__SMOL_TABLE_SECTIONS_MAP__ = {};
      }
      globalThis.__SMOL_TABLE_SECTIONS_MAP__[tableId] = trimmedSection;
      if (targetLabel) globalThis.__SMOL_TABLE_SECTIONS_MAP__[targetLabel] = trimmedSection;
      if (cleanNum) globalThis.__SMOL_TABLE_SECTIONS_MAP__[cleanNum] = trimmedSection;

      if (!DEFAULT_SECTIONS.includes(trimmedSection)) {
        recordCustomSection(trimmedSection);
        if (!globalThis.__SMOL_CUSTOM_SECTIONS__) {
          globalThis.__SMOL_CUSTOM_SECTIONS__ = [];
        }
        if (!globalThis.__SMOL_CUSTOM_SECTIONS__.includes(trimmedSection)) {
          globalThis.__SMOL_CUSTOM_SECTIONS__.push(trimmedSection);
        }
      }
    }

    void invalidateAdminOverviewCache();

    const updatedTable: DiningTableRecord = {
      id: (updated?.id as string) || tableId,
      location_id: (updated?.location_id as string) || globalThis.__SMOL_DEFAULT_LOCATION_ID__ || "",
      label: (updated?.label as string) || input.label || "",
      seats: updated?.seats !== undefined ? Number(updated.seats) : (input.seats || 2),
      active: updated?.active !== undefined ? Boolean(updated.active) : (input.active !== undefined ? input.active : true),
      section: effectiveSection,
    };

    void broadcastSyncEvent({
      type: "TABLE_RENAMED",
      tableId: updatedTable.id,
      tableLabel: updatedTable.label,
      metadata: {
        id: updatedTable.id,
        label: updatedTable.label,
        seats: updatedTable.seats,
        active: updatedTable.active,
        section: updatedTable.section,
      },
      timestamp: Date.now(),
    });

    return {
      success: true,
      table: updatedTable,
      message: "Table updated successfully!",
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to update table.";
    return { success: false, message: errorMsg };
  }
}

/**
 * Delete a dining table (Parallelized & Instant Return)
 */
export async function deleteTableAction(tableId: string, knownLabel?: string): Promise<{
  success: boolean;
  message?: string;
}> {
  const auth = await requireStaffAuth(["admin", "super_admin"]);
  if (!auth.authorized) {
    return { success: false, message: auth.message || "Unauthorized: Admin access required." };
  }

  try {
    const supabase = createAdminClient();

    let resolvedTableId = tableId;
    let tableLabel = knownLabel?.trim() || "";

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tableId);

    // Only query DB for ID/label if one of them is missing
    if (isUuid && !tableLabel) {
      try {
        const { data: tbl } = await supabase
          .from("dining_tables")
          .select("id, label")
          .eq("id", tableId)
          .maybeSingle();
        if (tbl?.label) tableLabel = tbl.label;
      } catch {}
    } else if (!isUuid && tableLabel) {
      try {
        const { data: tbl } = await supabase
          .from("dining_tables")
          .select("id, label")
          .eq("label", tableLabel)
          .maybeSingle();
        if (tbl?.id) {
          resolvedTableId = tbl.id;
          if (tbl.label) tableLabel = tbl.label;
        }
      } catch {}
    }

    // 1. Record to persistent deleted store immediately (prevent resurrection)
    if (resolvedTableId) {
      recordDeletedTable(resolvedTableId, tableLabel);
    }
    if (tableId && tableId !== resolvedTableId) {
      recordDeletedTable(tableId, tableLabel);
    }

    // 2. Clean up runtime memory map immediately
    if (globalThis.__SMOL_TABLE_SECTIONS_MAP__) {
      delete globalThis.__SMOL_TABLE_SECTIONS_MAP__[tableId];
      if (resolvedTableId) {
        delete globalThis.__SMOL_TABLE_SECTIONS_MAP__[resolvedTableId];
      }
      if (tableLabel) {
        delete globalThis.__SMOL_TABLE_SECTIONS_MAP__[tableLabel];
      }
    }

    const targetUuid = isUuid
      ? tableId
      : /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedTableId)
      ? resolvedTableId
      : null;

    // 3. Execute DB cleanup in parallel
    if (targetUuid) {
      await Promise.all([
        supabase
          .from("table_sessions")
          .update({ status: "CLOSED", closed_at: new Date().toISOString() })
          .eq("table_id", targetUuid)
          .eq("status", "OPEN"),
        supabase.from("table_qr_tokens").delete().eq("table_id", targetUuid),
      ]);

      const { error: deleteError } = await supabase
        .from("dining_tables")
        .delete()
        .eq("id", targetUuid);

      if (deleteError) {
        await supabase
          .from("dining_tables")
          .update({ active: false })
          .eq("id", targetUuid);
      }
    }

    void invalidateAdminOverviewCache();

    void broadcastSyncEvent({
      type: "TABLE_DELETED",
      tableId: resolvedTableId || tableId,
      tableLabel,
      metadata: { id: resolvedTableId || tableId, label: tableLabel },
      timestamp: Date.now(),
    });

    return {
      success: true,
      message: tableLabel
        ? `Table ${tableLabel} deleted successfully.`
        : "Table deleted successfully.",
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to delete table.";
    return { success: false, message: errorMsg };
  }
}

/**
 * Create a new custom section/zone
 */
export async function createSectionAction(name: string): Promise<{
  success: boolean;
  sections?: string[];
  message?: string;
}> {
  const auth = await requireStaffAuth(["admin", "super_admin"]);
  if (!auth.authorized) {
    return { success: false, message: auth.message || "Unauthorized: Admin access required." };
  }

  try {
    const trimmed = name.trim();
    if (!trimmed) {
      return { success: false, message: "Section name cannot be empty." };
    }

    if (!globalThis.__SMOL_CUSTOM_SECTIONS__) {
      globalThis.__SMOL_CUSTOM_SECTIONS__ = [];
    }

    const isDuplicate =
      DEFAULT_SECTIONS.some((s) => s.toLowerCase() === trimmed.toLowerCase()) ||
      globalThis.__SMOL_CUSTOM_SECTIONS__.some((s) => s.toLowerCase() === trimmed.toLowerCase());

    if (isDuplicate) {
      return { success: false, message: `Section "${trimmed}" already exists.` };
    }

    globalThis.__SMOL_CUSTOM_SECTIONS__.push(trimmed);
    recordCustomSection(trimmed);

    const allSections = Array.from(new Set([...DEFAULT_SECTIONS, ...globalThis.__SMOL_CUSTOM_SECTIONS__, ...getPersistedCustomSections()]));

    void broadcastSyncEvent({
      type: "SETTINGS_UPDATED",
      metadata: {
        action: "SECTIONS_UPDATED",
        sections: allSections,
      },
      timestamp: Date.now(),
    });

    return {
      success: true,
      sections: allSections,
      message: `Section "${trimmed}" added!`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to create section.";
    return { success: false, message: errorMsg };
  }
}

/**
 * Delete a custom section (if no tables are assigned to it)
 */
export async function deleteSectionAction(name: string): Promise<{
  success: boolean;
  sections?: string[];
  message?: string;
}> {
  const auth = await requireStaffAuth(["admin", "super_admin"]);
  if (!auth.authorized) {
    return { success: false, message: auth.message || "Unauthorized: Admin access required." };
  }

  try {
    const trimmed = name.trim();
    if (!trimmed) return { success: false, message: "Invalid section name." };

    if (DEFAULT_SECTIONS.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      return {
        success: false,
        message: `Default section "${trimmed}" cannot be deleted, but you can rename or move tables away from it.`,
      };
    }

    const activeMap = getActiveSectionsMap();
    const assignedCount = Object.values(activeMap).filter(
      (s) => s?.toLowerCase() === trimmed.toLowerCase()
    ).length;

    if (assignedCount > 0) {
      return {
        success: false,
        message: `Cannot delete section "${trimmed}": ${assignedCount} table(s) are currently assigned to it. Move them first.`,
      };
    }

    if (globalThis.__SMOL_CUSTOM_SECTIONS__) {
      globalThis.__SMOL_CUSTOM_SECTIONS__ = globalThis.__SMOL_CUSTOM_SECTIONS__.filter(
        (s) => s.toLowerCase() !== trimmed.toLowerCase()
      );
    }
    deleteCustomSectionFromStore(trimmed);

    const allSections = Array.from(new Set([...DEFAULT_SECTIONS, ...(globalThis.__SMOL_CUSTOM_SECTIONS__ || []), ...getPersistedCustomSections()]));

    void broadcastSyncEvent({
      type: "SETTINGS_UPDATED",
      metadata: {
        action: "SECTIONS_UPDATED",
        sections: allSections,
      },
      timestamp: Date.now(),
    });

    return {
      success: true,
      sections: allSections,
      message: `Section "${trimmed}" deleted.`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to delete section.";
    return { success: false, message: errorMsg };
  }
}
