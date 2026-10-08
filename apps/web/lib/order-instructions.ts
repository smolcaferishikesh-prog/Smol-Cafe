import type { SupabaseClient } from "@supabase/supabase-js";

const INSTRUCTION_DELIMITER_START = "__INST__";
const INSTRUCTION_DELIMITER_END = "__END_INST__";

/**
 * Encodes special preparation instructions into an idempotency key string
 * as a graceful fallback when orders table does not have an instructions column.
 */
export function encodeInstructionsInIdempotencyKey(
  existingKey: string | null | undefined,
  instructions: string
): string {
  const baseKey = cleanIdempotencyKey(existingKey || `ord_${Date.now()}`);
  if (!instructions || !instructions.trim()) {
    return baseKey;
  }
  const encoded = Buffer.from(instructions.trim(), "utf-8").toString("base64");
  return `${baseKey}${INSTRUCTION_DELIMITER_START}${encoded}${INSTRUCTION_DELIMITER_END}`;
}

/**
 * Removes instruction markers from an idempotency key.
 */
export function cleanIdempotencyKey(key: string | null | undefined): string {
  if (!key) return "";
  const startIdx = key.indexOf(INSTRUCTION_DELIMITER_START);
  if (startIdx === -1) return key;
  const endIdx = key.indexOf(INSTRUCTION_DELIMITER_END);
  if (endIdx === -1) return key.slice(0, startIdx);
  return key.slice(0, startIdx) + key.slice(endIdx + INSTRUCTION_DELIMITER_END.length);
}

/**
 * Extracts order instructions from either native column or encoded idempotency key.
 */
export function extractOrderInstructions(order: {
  instructions?: string | null;
  notes?: string | null;
  special_instructions?: string | null;
  idempotency_key?: string | null;
}): string | null {
  // 1. Check native fields first
  const direct = order.instructions || order.notes || order.special_instructions;
  if (direct && typeof direct === "string" && direct.trim().length > 0) {
    return direct.trim();
  }

  // 2. Check fallback embedded in idempotency_key
  const key = order.idempotency_key;
  if (key && key.includes(INSTRUCTION_DELIMITER_START)) {
    try {
      const startIdx = key.indexOf(INSTRUCTION_DELIMITER_START) + INSTRUCTION_DELIMITER_START.length;
      const endIdx = key.indexOf(INSTRUCTION_DELIMITER_END);
      if (endIdx > startIdx) {
        const encoded = key.slice(startIdx, endIdx);
        const decoded = Buffer.from(encoded, "base64").toString("utf-8");
        if (decoded && decoded.trim().length > 0) {
          return decoded.trim();
        }
      }
    } catch (e) {
      console.warn("Failed to decode instruction from idempotency_key:", e);
    }
  }

  return null;
}

/**
 * Safely updates an order in Supabase with financial snapshots and instructions.
 * If the DB schema does not have the 'instructions' column, gracefully falls back
 * to saving instructions in the idempotency_key so financial fields are never blocked.
 */
export async function safeUpdateOrderWithInstructions(
  supabase: SupabaseClient,
  orderId: string,
  updatePayload: Record<string, any>,
  instructions?: string | null
): Promise<{ success: boolean; error?: any }> {
  const payloadWithInstructions = { ...updatePayload };

  if (instructions !== undefined && instructions !== null) {
    payloadWithInstructions.instructions = instructions;
  }

  // 1. Attempt native update with instructions column
  const { error: nativeErr } = await supabase
    .from("orders")
    .update(payloadWithInstructions)
    .eq("id", orderId);

  if (!nativeErr) {
    return { success: true };
  }

  // 2. Check if error is due to missing 'instructions' column in schema cache
  const isMissingColumn =
    nativeErr.code === "PGRST204" ||
    nativeErr.message?.toLowerCase().includes("instructions");

  if (isMissingColumn) {
    console.warn("Notice: 'orders.instructions' column missing in DB schema cache. Falling back to embedded idempotency_key.");

    // Remove instructions from payload
    const fallbackPayload = { ...updatePayload };
    delete fallbackPayload.instructions;

    // Fetch existing idempotency key to embed instructions safely
    if (instructions && instructions.trim().length > 0) {
      const { data: existingOrd } = await supabase
        .from("orders")
        .select("idempotency_key")
        .eq("id", orderId)
        .maybeSingle();

      const newIdempotencyKey = encodeInstructionsInIdempotencyKey(
        existingOrd?.idempotency_key,
        instructions
      );
      fallbackPayload.idempotency_key = newIdempotencyKey;
    }

    const { error: fallbackErr } = await supabase
      .from("orders")
      .update(fallbackPayload)
      .eq("id", orderId);

    if (fallbackErr) {
      console.error("Failed to update order snapshot even with fallback payload:", fallbackErr);
      return { success: false, error: fallbackErr };
    }

    return { success: true };
  }

  // If another database error occurred, return failure
  console.error("Database error updating order snapshot:", nativeErr);
  return { success: false, error: nativeErr };
}
