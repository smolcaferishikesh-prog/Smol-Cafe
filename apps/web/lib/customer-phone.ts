import crypto from "crypto";

export interface CountryCodeOption {
  code: string;
  country: string;
  flag: string;
  iso: string;
  example: string;
}

export const COUNTRY_CODES: CountryCodeOption[] = [
  { code: "+91", country: "India", flag: "🇮🇳", iso: "IN", example: "9876543210" },
  { code: "+1", country: "USA / Canada", flag: "🇺🇸", iso: "US", example: "4155552671" },
  { code: "+44", country: "United Kingdom", flag: "🇬🇧", iso: "GB", example: "7911123456" },
  { code: "+61", country: "Australia", flag: "🇦🇺", iso: "AU", example: "412345678" },
  { code: "+971", country: "UAE", flag: "🇦🇪", iso: "AE", example: "501234567" },
  { code: "+65", country: "Singapore", flag: "🇸🇬", iso: "SG", example: "81234567" },
  { code: "+49", country: "Germany", flag: "🇩🇪", iso: "DE", example: "15123456789" },
  { code: "+33", country: "France", flag: "🇫🇷", iso: "FR", example: "612345678" },
  { code: "+81", country: "Japan", flag: "🇯🇵", iso: "JP", example: "9012345678" },
  { code: "+977", country: "Nepal", flag: "🇳🇵", iso: "NP", example: "9812345678" },
  { code: "+94", country: "Sri Lanka", flag: "🇱🇰", iso: "LK", example: "771234567" },
  { code: "+66", country: "Thailand", flag: "🇹🇭", iso: "TH", example: "812345678" },
];

declare global {
  var __SMOL_ORDER_PHONE_MAP__: Record<string, { phone: string; cleanDigits: string; guestName?: string; createdAt: string }> | undefined;
}

function getOrderPhoneMap(): Record<string, { phone: string; cleanDigits: string; guestName?: string; createdAt: string }> {
  if (!globalThis.__SMOL_ORDER_PHONE_MAP__) {
    globalThis.__SMOL_ORDER_PHONE_MAP__ = {};
  }
  return globalThis.__SMOL_ORDER_PHONE_MAP__;
}

/**
 * Normalizes any phone number string into strict E.164 international format (e.g. "+919876543210", "+14155552671", "+447911123456").
 * Handles country dial codes, strips non-digit formatting and national leading zeros.
 */
export function normalizePhoneNumber(rawPhone?: string | null, defaultCountryCode = "+91"): string {
  if (!rawPhone) return "";
  let str = rawPhone.trim();

  // 1. If already explicitly formatted with '+'
  if (str.startsWith("+")) {
    const digitsOnly = str.slice(1).replace(/\D/g, "");
    return digitsOnly.length >= 7 ? `+${digitsOnly}` : "";
  }

  // 2. Handle international '00' prefix (e.g. 00919876543210 -> +919876543210)
  if (str.startsWith("00")) {
    const digitsOnly = str.slice(2).replace(/\D/g, "");
    return digitsOnly.length >= 7 ? `+${digitsOnly}` : "";
  }

  // 3. Clean raw digits
  const digitsOnly = str.replace(/\D/g, "");
  if (!digitsOnly) return "";

  // Strip national leading zero if present (e.g., 09876543210 -> 9876543210 or 07911123456 -> 7911123456)
  const nationalDigits = digitsOnly.replace(/^0+/, "");

  // Normalize default country code
  const cleanCountry = defaultCountryCode.startsWith("+")
    ? defaultCountryCode
    : `+${defaultCountryCode.replace(/\D/g, "")}`;

  // If input string already includes country code digits at start (e.g., "919876543210" for +91)
  const countryDigits = cleanCountry.slice(1);
  if (nationalDigits.startsWith(countryDigits) && nationalDigits.length >= countryDigits.length + 7) {
    return `+${nationalDigits}`;
  }

  return `${cleanCountry}${nationalDigits}`;
}

/**
 * Formats a canonical E.164 phone string into a human-readable display string (e.g., "+91 98765 43210" or "+1 415 555 2671").
 */
export function formatDisplayPhone(e164Phone?: string | null): string {
  if (!e164Phone) return "";
  const normalized = normalizePhoneNumber(e164Phone);
  if (!normalized.startsWith("+")) return e164Phone;

  // Find matching country code prefix
  const matched = COUNTRY_CODES.find((c) => normalized.startsWith(c.code));
  if (matched) {
    const local = normalized.slice(matched.code.length);
    if (local.length === 10) {
      return `${matched.code} ${local.slice(0, 5)} ${local.slice(5)}`;
    }
    return `${matched.code} ${local}`;
  }

  return normalized;
}

/**
 * Deterministically generates a valid RFC4122 UUID v4-formatted string from a normalized E.164 phone number.
 * Guarantees that every international phone number maps to the exact same customer UUID in PostgreSQL.
 */
export function getPhoneUuid(rawPhone: string, defaultCountryCode = "+91"): string {
  const normalized = normalizePhoneNumber(rawPhone, defaultCountryCode);
  if (!normalized || normalized.length < 8) {
    return "00000000-0000-4000-a000-000000000000";
  }
  const hash = crypto.createHash("sha256").update(`smol-customer-phone:${normalized}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

/**
 * Records an order to a customer's normalized E.164 phone number in memory index.
 */
export function recordOrderForPhone(orderId: string, phone: string, guestName?: string): void {
  const e164 = normalizePhoneNumber(phone);
  if (!orderId || !e164) return;
  const map = getOrderPhoneMap();
  map[orderId] = {
    phone: e164,
    cleanDigits: e164,
    guestName,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Returns the recorded phone record for a given order ID.
 */
export function getOrderPhoneRecord(orderId: string): { phone: string; cleanDigits: string; guestName?: string } | null {
  const map = getOrderPhoneMap();
  return map[orderId] || null;
}

/**
 * Checks if an order belongs to a specific customer's normalized E.164 phone number.
 */
export function doesOrderMatchCustomerPhone(
  order: { id: string; customer_id?: string | null; idempotency_key?: string | null; notes?: string | null; table_session_id?: string | null },
  customerPhone?: string | null,
  currentSessionId?: string | null
): boolean {
  const customerE164 = normalizePhoneNumber(customerPhone);
  const expectedPhoneUuid = customerE164 ? getPhoneUuid(customerE164) : null;
  const recorded = getOrderPhoneRecord(order.id);

  // 1. If order belongs to the customer's active table session
  if (currentSessionId && order.table_session_id === currentSessionId) {
    if (!order.customer_id || (expectedPhoneUuid && order.customer_id === expectedPhoneUuid)) {
      return true;
    }
  }

  // 2. If customer provided a normalized international phone number
  if (customerE164 && customerE164.length >= 8) {
    // A. Database customer_id UUID match
    if (order.customer_id && expectedPhoneUuid && order.customer_id === expectedPhoneUuid) {
      return true;
    }

    // B. In-memory record match
    if (recorded && recorded.cleanDigits) {
      const recE164 = normalizePhoneNumber(recorded.cleanDigits);
      if (recE164 === customerE164) return true;
    }

    // C. Check idempotency_key for exact E.164 or digits match
    if (order.idempotency_key && order.idempotency_key.includes(customerE164)) {
      return true;
    }
    const digitsOnly = customerE164.replace(/\D/g, "");
    if (order.idempotency_key && digitsOnly.length >= 7 && order.idempotency_key.includes(digitsOnly)) {
      return true;
    }
  }

  // 3. Anonymous guest matching active table session
  if (!customerE164 && currentSessionId && order.table_session_id === currentSessionId) {
    return true;
  }

  return false;
}
