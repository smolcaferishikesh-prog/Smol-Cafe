import fs from "fs";
import path from "path";

export interface PersistedTablesStore {
  deletedTableIds: string[];
  deletedTableLabels: string[];
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

/**
 * Normalizes table label variations (e.g. "Table 03", "table-03", "03", "3", "t03")
 */
export function normalizeTableLabel(label: string): string[] {
  if (!label) return [];
  const raw = label.trim().toLowerCase();
  const clean = raw.replace(/^(table|t)[-\s_]*/i, "").trim();
  const variations = new Set<string>();
  
  variations.add(raw);
  if (clean) {
    variations.add(clean);
    if (/^\d+$/.test(clean)) {
      variations.add(clean.padStart(2, "0"));
      const num = parseInt(clean, 10);
      variations.add(num.toString());
      variations.add(num.toString().padStart(2, "0"));
      variations.add(`table-${num.toString().padStart(2, "0")}`);
      variations.add(`table-${num}`);
      variations.add(`table ${num.toString().padStart(2, "0")}`);
      variations.add(`table ${num}`);
      variations.add(`t-${num.toString().padStart(2, "0")}`);
      variations.add(`t-${num}`);
      variations.add(`t${num.toString().padStart(2, "0")}`);
      variations.add(`t${num}`);
    } else {
      variations.add(`table-${clean}`);
      variations.add(`table ${clean}`);
      variations.add(`t-${clean}`);
      variations.add(`t${clean}`);
    }
  }
  return Array.from(variations);
}

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
    // 2. Only check label tombstones for fallback mock tables or non-UUID records
    if (t.label && (!t.id || t.id.startsWith("mock_") || t.id.startsWith("tbl_"))) {
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
