import crypto from "crypto";
import { generateSafeUuid } from "../uuid";

export type LogLevel = "INFO" | "WARN" | "ERROR";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  requestId: string;
  message: string;
  action?: string;
  tableSessionId?: string;
  orderId?: string;
  durationMs?: number;
  data?: Record<string, unknown>;
}

// In-memory ring buffer for recently emitted logs (up to 100 entries for admin inspection)
const RECENT_LOGS_LIMIT = 100;
const recentLogsBuffer: LogEntry[] = [];

/**
 * Generates a unique request correlation ID
 */
export function generateRequestId(): string {
  return `req_${crypto.randomBytes(4).toString("hex")}`;
}

const SENSITIVE_KEY_REGEX =
  /^(otp|pin|password|secret|signature|token|auth|authorization|card|cvv|payload|credential)/i;

/**
 * Recursively deep-redacts sensitive keys (OTPs, PINs, secrets, signatures, raw card details)
 */
export function redactSensitiveData<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    // Check if string looks like an OTP or token
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item)) as unknown as T;
  }

  if (typeof obj === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (SENSITIVE_KEY_REGEX.test(key)) {
        cleaned[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        cleaned[key] = redactSensitiveData(value);
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned as T;
  }

  return obj;
}

/**
 * Emits a structured JSON log entry
 */
function emitLog(
  level: LogLevel,
  message: string,
  meta?: {
    requestId?: string;
    action?: string;
    tableSessionId?: string;
    orderId?: string;
    durationMs?: number;
    data?: Record<string, unknown>;
  }
) {
  const entry: LogEntry = {
    id: generateSafeUuid(),
    timestamp: new Date().toISOString(),
    level,
    requestId: meta?.requestId || "req_global",
    message,
    action: meta?.action,
    tableSessionId: meta?.tableSessionId,
    orderId: meta?.orderId,
    durationMs: meta?.durationMs,
    data: meta?.data ? redactSensitiveData(meta.data) : undefined,
  };

  // Add to in-memory audit ring buffer
  recentLogsBuffer.unshift(entry);
  if (recentLogsBuffer.length > RECENT_LOGS_LIMIT) {
    recentLogsBuffer.pop();
  }

  // Format as single-line structured JSON for log aggregators (Datadog, Grafana Loki, CloudWatch)
  const jsonOutput = JSON.stringify(entry);
  if (level === "ERROR") {
    console.error(jsonOutput);
  } else if (level === "WARN") {
    console.warn(jsonOutput);
  } else {
    console.log(jsonOutput);
  }
}

export const logger = {
  info: (
    message: string,
    meta?: {
      requestId?: string;
      action?: string;
      tableSessionId?: string;
      orderId?: string;
      durationMs?: number;
      data?: Record<string, unknown>;
    }
  ) => emitLog("INFO", message, meta),

  warn: (
    message: string,
    meta?: {
      requestId?: string;
      action?: string;
      tableSessionId?: string;
      orderId?: string;
      durationMs?: number;
      data?: Record<string, unknown>;
    }
  ) => emitLog("WARN", message, meta),

  error: (
    message: string,
    meta?: {
      requestId?: string;
      action?: string;
      tableSessionId?: string;
      orderId?: string;
      durationMs?: number;
      data?: Record<string, unknown>;
    }
  ) => emitLog("ERROR", message, meta),
};

export function getRecentLogs(): LogEntry[] {
  return [...recentLogsBuffer];
}
