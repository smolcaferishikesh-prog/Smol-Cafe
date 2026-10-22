/**
 * Smol Café — Table Label Normalization Utility
 * Normalizes table label variations (e.g. "Table 03", "table-03", "03", "3", "t03")
 * Completely client and server safe (zero Node.js fs/path dependencies).
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
