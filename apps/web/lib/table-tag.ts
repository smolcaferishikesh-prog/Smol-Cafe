import { generateSafeUuid } from "./uuid";

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
  session_id: string;
  created_at: string;
  device_fingerprint?: string;
  notes?: string;
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
 * Generates a standard TableJsonTag for a given table label and session ID.
 */
export function createTableJsonTag(
  tableLabel: string,
  sessionId?: string,
  guestCount: number = 2
): TableJsonTag {
  const cleanLabel = (tableLabel || "01").replace(/^(table|t)[-\s_]*/i, "").trim().padStart(2, "0");
  const config = TABLE_ZONES_CONFIG[cleanLabel] || {
    zone: "smol-cafe" as TableZone,
    capacity: 2,
  };

  return {
    table_id: `tbl_${cleanLabel}`,
    table_number: cleanLabel,
    zone: config.zone,
    capacity: config.capacity,
    guest_count: guestCount,
    qr_hash: `smol-qr-t${cleanLabel}`,
    service_mode: "DINE_IN",
    session_id: sessionId || `sess_${cleanLabel}`,
    created_at: "2026-01-01T00:00:00.000Z",
    device_fingerprint: "mobile-web-client",
  };
}
