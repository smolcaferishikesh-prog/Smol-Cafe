/**
 * ☕ Direct Device UPI Payment Engine for smol café
 * Supports dynamic Merchant ID setup from Admin Settings,
 * App Drawer intents (GPay, Paytm, PhonePe, BHIM, CRED),
 * dynamic QR code generation, and simulated verification.
 */

export interface UpiPaymentParams {
  amountPaise: number;
  orderNo?: string | number;
  transactionRef?: string;
  note?: string;
}

export interface MerchantConfig {
  vpa: string;
  name: string;
  phone: string;
  gstin: string;
  fssai?: string;
  address?: string;
  taxRatePercent: number; // e.g. 5%
  serviceChargePercent?: number;
  openingHours?: string;
  wifiSsid?: string;
  wifiPassword?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  contactEmail?: string;
}

const DEFAULT_MERCHANT_CONFIG: MerchantConfig = {
  vpa: process.env.NEXT_PUBLIC_UPI_ID || "smolcafe@icici",
  name: process.env.NEXT_PUBLIC_UPI_NAME || "smol café Tapovan",
  phone: process.env.NEXT_PUBLIC_UPI_NUMBER || "+91 9305084332",
  gstin: "05AAECS1482M1ZB",
  fssai: "22624039000124",
  address: "Tapovan, Rishikesh, Uttarakhand 249192",
  taxRatePercent: 5,
  serviceChargePercent: 0,
  openingHours: "08:00 AM – 10:00 PM (Daily)",
  wifiSsid: "smol_cafe_guest",
  wifiPassword: "slowcoffeewarmvibes",
  receiptHeader: "artisanal coffee & slow bakes",
  receiptFooter: "small place • slow coffee • warm conversations",
  contactEmail: "hello@smolcafe.in",
};

const MERCHANT_CONFIG_KEY = "smol_merchant_config";

/**
 * Retrieves current active merchant configuration.
 * Prioritizes custom settings saved in Admin Settings (localStorage).
 */
export function getUpiConfig(): MerchantConfig {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(MERCHANT_CONFIG_KEY);
      if (stored) {
        return { ...DEFAULT_MERCHANT_CONFIG, ...JSON.parse(stored) };
      }
    } catch {
      // ignore storage error
    }
  }
  return DEFAULT_MERCHANT_CONFIG;
}

/**
 * Updates merchant configuration (used by Admin Tower Settings).
 */
export function updateMerchantConfig(updates: Partial<MerchantConfig>): MerchantConfig {
  const current = getUpiConfig();
  const next = { ...current, ...updates };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(MERCHANT_CONFIG_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("smol_merchant_updated", { detail: next }));
    } catch {
      // ignore storage error
    }
  }
  return next;
}

/**
 * Builds standard generic UPI intent URI
 * (upi://pay?pa=...&pn=...&am=...&cu=INR&tn=...&tr=...)
 */
export function buildUpiUri(params: UpiPaymentParams): string {
  const config = getUpiConfig();
  const amountRupees = (params.amountPaise / 100).toFixed(2);
  const note = params.note || (params.orderNo ? `smol cafe Order #${params.orderNo}` : "smol cafe bill");
  const tr = params.transactionRef || (params.orderNo ? `SMOL-${params.orderNo}` : `SMOL-${Date.now()}`);

  const queryParams = new URLSearchParams({
    pa: config.vpa,
    pn: config.name,
    am: amountRupees,
    cu: "INR",
    tn: note,
    tr: tr,
  });

  return `upi://pay?${queryParams.toString()}`;
}

/**
 * Builds app-specific deep links when user selects an app in the App Drawer.
 */
export function buildAppSpecificUpiUri(
  app: "gpay" | "paytm" | "phonepe" | "bhim" | "cred",
  params: UpiPaymentParams
): string {
  const baseUri = buildUpiUri(params);

  switch (app) {
    case "gpay":
      return `gpay://upi/pay?${baseUri.replace("upi://pay?", "")}`;
    case "paytm":
      return `paytmmp://pay?${baseUri.replace("upi://pay?", "")}`;
    case "phonepe":
      return `phonepe://pay?${baseUri.replace("upi://pay?", "")}`;
    case "bhim":
      return `upi://pay?${baseUri.replace("upi://pay?", "")}`;
    case "cred":
      return `credpay://upi/pay?${baseUri.replace("upi://pay?", "")}`;
    default:
      return baseUri;
  }
}

/**
 * Triggers the native mobile UPI intent app chooser popup.
 */
export function launchUpiAppChooser(params: UpiPaymentParams): boolean {
  if (typeof window === "undefined") return false;
  const upiUri = buildUpiUri(params);
  window.location.href = upiUri;
  return true;
}

export interface UpiVerificationResult {
  success: boolean;
  transactionId: string;
  bankReference: string;
  paidAt: string;
  amountPaise: number;
  appName: string;
}

/**
 * Realistic simulated payment verification for desktop and mock gateways.
 */
export async function simulateUpiPayment(
  appName: string,
  params: UpiPaymentParams
): Promise<UpiVerificationResult> {
  // Simulate network roundtrip to bank gateway
  await new Promise((resolve) => setTimeout(resolve, 1400));

  const txnId = `UPI/${new Date().getFullYear()}/${Math.floor(100000000 + Math.random() * 900000000)}`;
  const bankRef = `REF${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

  return {
    success: true,
    transactionId: txnId,
    bankReference: bankRef,
    paidAt: new Date().toISOString(),
    amountPaise: params.amountPaise,
    appName,
  };
}
