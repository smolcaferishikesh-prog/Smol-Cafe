"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { broadcastSyncEvent } from "@/lib/sync-events";

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
}

// Enforce standard table mapping for 14 tables
globalThis.__SMOL_TABLE_SECTIONS_MAP__ = {
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

// Clean legacy custom sections
if (globalThis.__SMOL_CUSTOM_SECTIONS__) {
  globalThis.__SMOL_CUSTOM_SECTIONS__ = globalThis.__SMOL_CUSTOM_SECTIONS__.filter(
    (s) => !LEGACY_SECTIONS.has(s)
  );
}

function getSectionsList(tables: DiningTableRecord[]): string[] {
  const custom = (globalThis.__SMOL_CUSTOM_SECTIONS__ || []).filter((s) => !LEGACY_SECTIONS.has(s));
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

    // 1. Fetch tables
    const { data: tablesData, error: tablesError } = await supabase
      .from("dining_tables")
      .select("*")
      .order("label", { ascending: true });

    if (tablesError) {
      console.error("fetchTables error:", tablesError);
      return { success: false, tables: [], sections: DEFAULT_SECTIONS, message: tablesError.message };
    }

    // 2. Fetch active sessions to determine live occupancy
    const { data: sessionsData } = await supabase
      .from("table_sessions")
      .select("table_id, status")
      .eq("status", "OPEN");

    const occupiedTableIds = new Set((sessionsData || []).map((s: { table_id: string }) => s.table_id));

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

    const sectionMap = globalThis.__SMOL_TABLE_SECTIONS_MAP__ || defaultZoneMap;

    const tables: DiningTableRecord[] = (tablesData || []).map((t: any) => {
      const cleanNum = t.label?.toString().padStart(2, "0");
      let section = t.section || sectionMap[t.id] || sectionMap[t.label] || sectionMap[cleanNum] || defaultZoneMap[cleanNum] || "smol-cafe";
      if (LEGACY_SECTIONS.has(section) || section === "Café" || section === "Lounge" || section === "Terrace") {
        section = defaultZoneMap[cleanNum] || (parseInt(cleanNum, 10) > 10 ? "smol-terrace" : parseInt(cleanNum, 10) > 6 ? "smol-lounge" : "smol-cafe");
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

    return { success: true, tables, sections };
  } catch (err: any) {
    console.error("fetchTablesAndSectionsAction unexpected error:", err);
    return { success: false, tables: [], sections: DEFAULT_SECTIONS, message: err?.message || "Error fetching tables" };
  }
}

/**
 * Add a new dining table
 */
export async function createTableAction(input: CreateTableInput): Promise<{
  success: boolean;
  table?: DiningTableRecord;
  message?: string;
}> {
  try {
    const label = input.label.trim();
    if (!label) {
      return { success: false, message: "Table label or number is required." };
    }

    const supabase = createAdminClient();

    // Check if table label already exists
    const { data: existing } = await supabase
      .from("dining_tables")
      .select("id")
      .eq("label", label)
      .maybeSingle();

    if (existing) {
      return { success: false, message: `Table "${label}" already exists. Please choose a unique name.` };
    }

    const cleanNum = label.padStart(2, "0");
    const section = input.section?.trim() || "smol-cafe";
    const seats = Number(input.seats) || 2;
    const active = input.active !== undefined ? input.active : true;

    // 1. Fetch valid location UUID
    let locationId: string | null = null;
    const { data: loc } = await supabase.from("locations").select("id").limit(1).maybeSingle();
    if (loc) {
      locationId = loc.id;
    } else {
      const { data: newLoc } = await supabase
        .from("locations")
        .insert({ name: "smol café · rishikesh", timezone: "Asia/Kolkata" })
        .select("id")
        .single();
      locationId = newLoc?.id || null;
    }

    if (!locationId) {
      return { success: false, message: "Could not resolve restaurant location." };
    }

    // 2. Insert dining table (PostgreSQL gen_random_uuid generates UUID id)
    const { data: inserted, error: insertError } = await supabase
      .from("dining_tables")
      .insert({
        location_id: locationId,
        label,
        seats,
        active,
      })
      .select()
      .single();

    if (insertError) {
      return { success: false, message: insertError.message };
    }

    const tableId = inserted.id;

    // 3. Save section mapping in runtime registry
    if (!globalThis.__SMOL_TABLE_SECTIONS_MAP__) {
      globalThis.__SMOL_TABLE_SECTIONS_MAP__ = {};
    }
    globalThis.__SMOL_TABLE_SECTIONS_MAP__[tableId] = section;
    globalThis.__SMOL_TABLE_SECTIONS_MAP__[label] = section;
    globalThis.__SMOL_TABLE_SECTIONS_MAP__[cleanNum] = section;

    // 4. Generate table QR token
    const tokenStr = `table-${label.toLowerCase().replace(/\s+/g, "-")}`;
    await supabase.from("table_qr_tokens").insert({
      table_id: tableId,
      token_hash: tokenStr,
      version: 1,
    });

    // Make sure section is registered in custom sections if new
    if (!DEFAULT_SECTIONS.includes(section)) {
      if (!globalThis.__SMOL_CUSTOM_SECTIONS__) {
        globalThis.__SMOL_CUSTOM_SECTIONS__ = [];
      }
      if (!globalThis.__SMOL_CUSTOM_SECTIONS__.includes(section)) {
        globalThis.__SMOL_CUSTOM_SECTIONS__.push(section);
      }
    }

    try {
      revalidatePath("/admin");
      revalidatePath("/admin/tables");
      revalidatePath("/");
      revalidatePath("/home");
    } catch {
      // Non-fatal if revalidation context is absent
    }

    const newTable: DiningTableRecord = {
      id: tableId,
      location_id: locationId,
      label,
      seats,
      active,
      section,
      isOccupied: false,
    };

    broadcastSyncEvent({
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
 * Edit an existing dining table
 */
export async function updateTableAction(
  tableId: string,
  input: UpdateTableInput
): Promise<{
  success: boolean;
  table?: DiningTableRecord;
  message?: string;
}> {
  try {
    const supabase = createAdminClient();

    // Only update columns that exist in the PostgreSQL dining_tables schema
    const dbUpdates: Record<string, unknown> = {};
    if (input.label !== undefined) dbUpdates.label = input.label.trim();
    if (input.seats !== undefined) dbUpdates.seats = Number(input.seats);
    if (input.active !== undefined) dbUpdates.active = input.active;

    let updated: Record<string, unknown> | null = null;
    if (Object.keys(dbUpdates).length > 0) {
      const { data, error: updateError } = await supabase
        .from("dining_tables")
        .update(dbUpdates)
        .eq("id", tableId)
        .select()
        .single();

      if (updateError) {
        return { success: false, message: updateError.message };
      }
      updated = data as Record<string, unknown>;
    } else {
      const { data } = await supabase
        .from("dining_tables")
        .select("*")
        .eq("id", tableId)
        .single();
      updated = data as Record<string, unknown>;
    }

    const cleanNum = (updated?.label || input.label || "").toString().padStart(2, "0");

    // Handle section update in runtime memory
    if (input.section) {
      const trimmedSection = input.section.trim();
      if (!globalThis.__SMOL_TABLE_SECTIONS_MAP__) {
        globalThis.__SMOL_TABLE_SECTIONS_MAP__ = {};
      }
      globalThis.__SMOL_TABLE_SECTIONS_MAP__[tableId] = trimmedSection;
      if (updated?.label) globalThis.__SMOL_TABLE_SECTIONS_MAP__[String(updated.label)] = trimmedSection;
      if (cleanNum) globalThis.__SMOL_TABLE_SECTIONS_MAP__[cleanNum] = trimmedSection;

      if (!DEFAULT_SECTIONS.includes(trimmedSection)) {
        if (!globalThis.__SMOL_CUSTOM_SECTIONS__) {
          globalThis.__SMOL_CUSTOM_SECTIONS__ = [];
        }
        if (!globalThis.__SMOL_CUSTOM_SECTIONS__.includes(trimmedSection)) {
          globalThis.__SMOL_CUSTOM_SECTIONS__.push(trimmedSection);
        }
      }
    }

    const effectiveSection =
      (input.section ? input.section.trim() : undefined) ||
      globalThis.__SMOL_TABLE_SECTIONS_MAP__?.[tableId] ||
      globalThis.__SMOL_TABLE_SECTIONS_MAP__?.[cleanNum] ||
      "Café";

    try {
      revalidatePath("/admin");
      revalidatePath("/admin/tables");
      revalidatePath("/");
      revalidatePath("/home");
    } catch {
      // Non-fatal if revalidation context is absent
    }

    const updatedTable: DiningTableRecord = {
      id: (updated?.id as string) || tableId,
      location_id: (updated?.location_id as string) || "",
      label: (updated?.label as string) || input.label || "",
      seats: updated?.seats !== undefined ? Number(updated.seats) : (input.seats || 2),
      active: updated?.active !== undefined ? Boolean(updated.active) : (input.active !== undefined ? input.active : true),
      section: effectiveSection,
    };

    broadcastSyncEvent({
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
 * Delete a dining table
 */
export async function deleteTableAction(tableId: string): Promise<{
  success: boolean;
  message?: string;
}> {
  try {
    const supabase = createAdminClient();

    // 1. Close or delete any existing table sessions for this table
    try {
      await supabase
        .from("table_sessions")
        .delete()
        .eq("table_id", tableId);
    } catch {
      // Fallback: try closing if delete is restricted
      await supabase
        .from("table_sessions")
        .update({ status: "CLOSED", closed_at: new Date().toISOString() })
        .eq("table_id", tableId);
    }

    // 2. Remove associated QR tokens
    await supabase.from("table_qr_tokens").delete().eq("table_id", tableId);

    // 3. Delete the table itself
    const { error: deleteError } = await supabase
      .from("dining_tables")
      .delete()
      .eq("id", tableId);

    if (deleteError) {
      return { success: false, message: deleteError.message };
    }

    // 4. Clean up runtime memory map
    if (globalThis.__SMOL_TABLE_SECTIONS_MAP__) {
      delete globalThis.__SMOL_TABLE_SECTIONS_MAP__[tableId];
    }

    revalidatePath("/admin");
    revalidatePath("/admin/tables");
    revalidatePath("/smol-backdoor/admin");
    revalidatePath("/");
    revalidatePath("/home");

    broadcastSyncEvent({
      type: "TABLE_DELETED",
      tableId,
      metadata: { id: tableId },
      timestamp: Date.now(),
    });

    return { success: true, message: "Table deleted successfully." };
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
  try {
    const trimmed = name.trim();
    if (!trimmed) {
      return { success: false, message: "Section name cannot be empty." };
    }

    if (!globalThis.__SMOL_CUSTOM_SECTIONS__) {
      globalThis.__SMOL_CUSTOM_SECTIONS__ = [];
    }

    if (
      DEFAULT_SECTIONS.includes(trimmed) ||
      globalThis.__SMOL_CUSTOM_SECTIONS__.includes(trimmed)
    ) {
      return { success: false, message: `Section "${trimmed}" already exists.` };
    }

    globalThis.__SMOL_CUSTOM_SECTIONS__.push(trimmed);

    revalidatePath("/admin");
    revalidatePath("/admin/tables");

    const allSections = Array.from(new Set([...DEFAULT_SECTIONS, ...globalThis.__SMOL_CUSTOM_SECTIONS__]));

    broadcastSyncEvent({
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
  try {
    const trimmed = name.trim();
    if (!trimmed) return { success: false, message: "Invalid section name." };

    if (DEFAULT_SECTIONS.includes(trimmed)) {
      return {
        success: false,
        message: `Default section "${trimmed}" cannot be deleted, but you can rename or move tables away from it.`,
      };
    }

    const assignedCount = Object.values(globalThis.__SMOL_TABLE_SECTIONS_MAP__ || {}).filter(
      (s) => s === trimmed
    ).length;

    if (assignedCount > 0) {
      return {
        success: false,
        message: `Cannot delete section "${trimmed}": ${assignedCount} table(s) are currently assigned to it. Move them first.`,
      };
    }

    if (globalThis.__SMOL_CUSTOM_SECTIONS__) {
      globalThis.__SMOL_CUSTOM_SECTIONS__ = globalThis.__SMOL_CUSTOM_SECTIONS__.filter(
        (s) => s !== trimmed
      );
    }

    revalidatePath("/admin");
    revalidatePath("/admin/tables");

    const allSections = Array.from(new Set([...DEFAULT_SECTIONS, ...(globalThis.__SMOL_CUSTOM_SECTIONS__ || [])]));

    broadcastSyncEvent({
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
