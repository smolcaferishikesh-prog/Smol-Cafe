import fs from "fs";
import path from "path";

export interface PersistedTablesStore {
  deletedTableIds: string[];
  deletedTableLabels: string[];
  tableSectionsMap?: Record<string, string>;
  customSections?: string[];
}

const isServer = typeof window === "undefined";

function getPersistenceFilePath(): string | null {
  if (!isServer) return null;
  try {
    const cwd = process.cwd();
    if (cwd.endsWith("apps/web")) {
      return path.join(cwd, "data/tables-store.json");
    }
    return path.join(cwd, "apps/web/data/tables-store.json");
  } catch {
    return null;
  }
}

function loadPersistedStore(): PersistedTablesStore {
  const defaultStore: PersistedTablesStore = {
    deletedTableIds: [],
    deletedTableLabels: [],
    tableSectionsMap: {},
    customSections: [],
  };

  if (!isServer) return defaultStore;

  const filePath = getPersistenceFilePath();
  if (!filePath) return defaultStore;

  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        deletedTableIds: Array.isArray(parsed.deletedTableIds) ? parsed.deletedTableIds : [],
        deletedTableLabels: Array.isArray(parsed.deletedTableLabels) ? parsed.deletedTableLabels : [],
        tableSectionsMap: typeof parsed.tableSectionsMap === "object" && parsed.tableSectionsMap !== null ? parsed.tableSectionsMap : {},
        customSections: Array.isArray(parsed.customSections) ? parsed.customSections : [],
      };
    }
  } catch (err) {
    console.warn("[tables-store] Could not read tables-store.json:", err);
  }

  return defaultStore;
}

function savePersistedStore(store: PersistedTablesStore): void {
  if (!isServer) return;
  const filePath = getPersistenceFilePath();
  if (!filePath) return;

  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.warn("[tables-store] Could not write tables-store.json:", err);
  }
}

export { normalizeTableLabel } from "./table-label";
import { normalizeTableLabel } from "./table-label";

/**
 * Check if a table by ID or Label has been permanently deleted
 */
export function isTableDeleted(idOrLabel: string): boolean {
  if (!idOrLabel) return false;
  const store = loadPersistedStore();
  const query = idOrLabel.trim().toLowerCase();

  if (store.deletedTableIds.includes(idOrLabel.trim())) {
    return true;
  }

  const variations = normalizeTableLabel(idOrLabel);
  for (const v of variations) {
    if (store.deletedTableLabels.some((dl) => dl.toLowerCase() === v)) {
      return true;
    }
  }

  return false;
}

/**
 * Record a table as permanently deleted
 */
export function recordDeletedTable(id: string, label: string): void {
  const store = loadPersistedStore();
  const newIds = new Set(store.deletedTableIds);
  const newLabels = new Set(store.deletedTableLabels.map((l) => l.toLowerCase()));

  if (id && id.trim()) {
    newIds.add(id.trim());
  }

  if (label && label.trim()) {
    const variations = normalizeTableLabel(label);
    variations.forEach((v) => newLabels.add(v));
  }

  savePersistedStore({
    deletedTableIds: Array.from(newIds),
    deletedTableLabels: Array.from(newLabels),
  });
}

/**
 * Remove deleted status when an admin re-creates a table with that name
 */
export function unrecordDeletedTable(idOrLabel: string): void {
  if (!idOrLabel || !idOrLabel.trim()) return;
  const store = loadPersistedStore();
  const raw = idOrLabel.trim();
  const variations = new Set(normalizeTableLabel(raw).map((v) => v.toLowerCase()));
  variations.add(raw.toLowerCase());

  const updatedIds = store.deletedTableIds.filter((id) => id !== raw);
  const updatedLabels = store.deletedTableLabels.filter((lbl) => !variations.has(lbl.toLowerCase()));

  savePersistedStore({
    deletedTableIds: updatedIds,
    deletedTableLabels: updatedLabels,
  });
}

/**
 * Helper to filter out any deleted tables from a list.
 * Note: Database tables with a real UUID (not present in deletedTableIds) are always
 * considered active and never suppressed by stale label tombstones.
 */
export function filterDeletedTables<T extends { id?: string; label?: string }>(tables: T[]): T[] {
  const store = loadPersistedStore();
  const deletedIds = new Set(store.deletedTableIds);
  const deletedLabels = new Set(store.deletedTableLabels.map((l) => l.toLowerCase()));

  return tables.filter((t) => {
    // 1. If explicit table ID is in tombstone, filter it out
    if (t.id && deletedIds.has(t.id)) return false;
    // 2. Also check label tombstones so newly created tables with mismatched IDs or variations are filtered
    if (t.label) {
      const vars = normalizeTableLabel(t.label);
      if (vars.some((v) => deletedLabels.has(v))) return false;
    }
    return true;
  });
}

/**
 * Get all deleted table labels
 */
export function getDeletedTableLabels(): string[] {
  const store = loadPersistedStore();
  return store.deletedTableLabels;
}

/**
 * Get persisted table sections map
 */
export function getPersistedSectionsMap(): Record<string, string> {
  const store = loadPersistedStore();
  return store.tableSectionsMap || {};
}

/**
 * Get persisted custom sections list
 */
export function getPersistedCustomSections(): string[] {
  const store = loadPersistedStore();
  return store.customSections || [];
}

/**
 * Record a table's assigned section in persistent store
 */
export function recordTableSection(tableId: string, label: string, section: string): void {
  const store = loadPersistedStore();
  const map = { ...(store.tableSectionsMap || {}) };
  const cleanSec = section?.trim() || "smol-cafe";
  if (tableId && tableId.trim()) map[tableId.trim()] = cleanSec;
  if (label && label.trim()) {
    map[label.trim()] = cleanSec;
    const cleanNum = label.trim().padStart(2, "0");
    map[cleanNum] = cleanSec;
  }
  const existingCustom = store.customSections || [];
  const customSections = cleanSec && !existingCustom.includes(cleanSec)
    ? [...existingCustom, cleanSec]
    : existingCustom;

  savePersistedStore({
    ...store,
    tableSectionsMap: map,
    customSections,
  });
}

/**
 * Record a newly created custom section
 */
export function recordCustomSection(section: string): void {
  const clean = section?.trim();
  if (!clean) return;
  const store = loadPersistedStore();
  const existing = store.customSections || [];
  if (!existing.includes(clean)) {
    savePersistedStore({
      ...store,
      customSections: [...existing, clean],
    });
  }
}

/**
 * Remove a custom section
 */
export function deleteCustomSectionFromStore(section: string): void {
  const clean = section?.trim().toLowerCase();
  if (!clean) return;
  const store = loadPersistedStore();
  const filtered = (store.customSections || []).filter((s) => s.toLowerCase() !== clean);
  savePersistedStore({
    ...store,
    customSections: filtered,
  });
}
