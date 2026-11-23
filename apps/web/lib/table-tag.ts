/**
 * Smol Café — JSON Tagging for Tables
 * Encapsulates table metadata, zone assignment, seating capacity,
 * and session tagging for cross-interface synchronization.
 */

export type TableZone = "smol-cafe" | "smol-lounge" | "smol-terrace" | "Café" | "Lounge" | "Terrace" | (string & {});

export interface TableJsonTag {
  table_id: string;
  table_number: string;
  zone: TableZone;
  capacity: number;
  guest_count: number;
  qr_hash: string;
  service_mode: "DINE_IN" | "TAKEAWAY";
  session_id: string | null;
  status: "AVAILABLE" | "OCCUPIED";
  created_at: string | null;
  device_fingerprint?: string;
  notes?: string;
}

export interface TableJsonTagOverrides {
  tableId?: string;
  zone?: TableZone;
  capacity?: number;
  isOccupied?: boolean;
  openedAt?: string | null;
}

export const TABLE_ZONES_CONFIG: Record<string, { zone: TableZone; capacity: number }> = {
  // 6 Café Tables
  "01": { zone: "smol-cafe", capacity: 2 },
  "02": { zone: "smol-cafe", capacity: 2 },
  "03": { zone: "smol-cafe", capacity: 4 },
  "04": { zone: "smol-cafe", capacity: 4 },
  "05": { zone: "smol-cafe", capacity: 2 },
  "06": { zone: "smol-cafe", capacity: 4 },

  // 4 Lounge Tables
  "07": { zone: "smol-lounge", capacity: 4 },
  "08": { zone: "smol-lounge", capacity: 4 },
  "09": { zone: "smol-lounge", capacity: 6 },
  "10": { zone: "smol-lounge", capacity: 6 },

  // 4 Terrace Tables
  "11": { zone: "smol-terrace", capacity: 2 },
  "12": { zone: "smol-terrace", capacity: 2 },
  "13": { zone: "smol-terrace", capacity: 4 },
  "14": { zone: "smol-terrace", capacity: 4 },
};

/**
 * Generates a standard TableJsonTag from actual persisted table/session data (fixes SMOL-006).
 * Empty tables never fabricate guest counts, session IDs, or placeholder timestamps.
 */
export function createTableJsonTag(
  tableLabel: string,
  sessionId?: string | null,
  guestCount?: number,
  overrides?: TableJsonTagOverrides
): TableJsonTag {
  const rawStripped = (tableLabel || "01").replace(/^(table|t)[-_\s]*/i, "").trim();
  const cleanLabel = /^\d+$/.test(rawStripped) ? rawStripped.padStart(2, "0") : rawStripped;
  const fallbackConfig = TABLE_ZONES_CONFIG[cleanLabel] || {
    zone: "smol-cafe" as TableZone,
    capacity: 4,
  };

  const isOccupied = overrides?.isOccupied ?? Boolean(sessionId);
  const resolvedCapacity =
    typeof overrides?.capacity === "number" && overrides.capacity > 0
      ? overrides.capacity
      : fallbackConfig.capacity;
  const resolvedGuestCount = isOccupied
    ? typeof guestCount === "number" && guestCount >= 0
      ? guestCount
      : 1
    : 0;
  const resolvedSessionId = isOccupied ? sessionId || null : null;
  const slug = cleanLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  return {
    table_id: overrides?.tableId || `tbl_${slug || cleanLabel}`,
    table_number: cleanLabel,
    zone: overrides?.zone || fallbackConfig.zone,
    capacity: resolvedCapacity,
    guest_count: resolvedGuestCount,
    qr_hash: `smol-qr-t${slug || cleanLabel}`,
    service_mode: "DINE_IN",
    session_id: resolvedSessionId,
    status: isOccupied ? "OCCUPIED" : "AVAILABLE",
    created_at: isOccupied ? overrides?.openedAt || null : null,
  };
}
