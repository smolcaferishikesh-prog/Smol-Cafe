/**
 * Utility functions for routing items to Kitchen vs Barista station.
 * Shared across the Barista Desk (/barista) and Customer Drinks menu (/drinks).
 */

export function isBeverageItem(name: string, categoryName?: string): boolean {
  const n = (name || "").toLowerCase().trim();
  const c = (categoryName || "").toLowerCase().trim();

  // If category is a beverage category
  if (
    c.includes("coffee") ||
    c.includes("brew") ||
    c.includes("chai") ||
    c.includes("tea") ||
    c.includes("drink") ||
    c.includes("beverage") ||
    c.includes("barista") ||
    c.includes("shake") ||
    c.includes("cooler") ||
    c.includes("smoothie") ||
    c.includes("kombucha")
  ) {
    return true;
  }

  // Check item keywords
  return (
    n.includes("coffee") ||
    n.includes("espresso") ||
    n.includes("americano") ||
    n.includes("latte") ||
    n.includes("cappuccino") ||
    n.includes("mocha") ||
    n.includes("cortado") ||
    n.includes("macchiato") ||
    n.includes("flat white") ||
    n.includes("brew") ||
    n.includes("pour over") ||
    n.includes("aeropress") ||
    n.includes("tonic") ||
    n.includes("shake") ||
    n.includes("frappe") ||
    n.includes("tea") ||
    n.includes("chai") ||
    n.includes("matcha") ||
    n.includes("smoothie") ||
    n.includes("kombucha") ||
    n.includes("beverage") ||
    n.includes("hot chocolate") ||
    n.includes("cooler") ||
    n.includes("lemonade") ||
    n.includes("soda") ||
    n.includes("cold brew")
  );
}

import type { OrderStatus } from "@smol-cafe/db";

/**
 * Derives the station-specific fulfillment status from a station's subset of items.
 * Status precedence:
 * - If station has no items: "SERVED"
 * - If ALL items are SERVED / COMPLETED: "SERVED"
 * - If ALL items are READY or SERVED: "READY"
 * - If ANY item is PREPARING: "PREPARING"
 * - If ANY item is ACCEPTED: "ACCEPTED"
 * - Fallback to order's overall status or "PENDING"
 */
export function deriveStationStatus(
  stationItems: Array<{ itemStatus?: string | null; item_status?: string | null }>,
  orderStatus: OrderStatus
): OrderStatus {
  if (!stationItems || stationItems.length === 0) {
    return orderStatus;
  }

  // If order is terminal (CANCELLED or REJECTED)
  if (orderStatus === "CANCELLED" || orderStatus === "REJECTED") {
    return orderStatus;
  }

  const statuses = stationItems.map((i) =>
    (i.itemStatus || i.item_status || "PENDING").toUpperCase()
  );

  const allServed = statuses.every(
    (s) => s === "SERVED" || s === "COMPLETED" || s === "DELIVERED"
  );
  if (allServed) return "SERVED";

  const allReadyOrServed = statuses.every(
    (s) => s === "READY" || s === "SERVED" || s === "COMPLETED" || s === "DELIVERED"
  );
  if (allReadyOrServed) return "READY";

  const anyPreparing = statuses.some((s) => s === "PREPARING" || s === "IN_PROGRESS");
  if (anyPreparing) return "PREPARING";

  const anyReady = statuses.some((s) => s === "READY");
  if (anyReady) return "PREPARING"; // Station has some ready, but still preparing remainder

  const anyAccepted = statuses.some((s) => s === "ACCEPTED");
  if (anyAccepted) return "ACCEPTED";

  // If overall order is ACCEPTED, treat items as ACCEPTED for station view
  if (orderStatus === "ACCEPTED" || orderStatus === "CONFIRMED") {
    return "ACCEPTED";
  }

  return orderStatus;
}

/**
 * Derives the aggregate order status across ALL items (both Kitchen and Barista).
 * The overall order is only READY when ALL required station line items are READY or SERVED.
 * The overall order is only SERVED when ALL line items are SERVED.
 */
export function deriveAggregateOrderStatus(
  allItems: Array<{ item_status?: string | null; itemStatus?: string | null }>,
  currentStatus: OrderStatus
): OrderStatus {
  if (!allItems || allItems.length === 0) {
    return currentStatus;
  }

  if (currentStatus === "CANCELLED" || currentStatus === "REJECTED" || currentStatus === "DRAFT") {
    return currentStatus;
  }

  const statuses = allItems.map((i) =>
    (i.item_status || i.itemStatus || "PENDING").toUpperCase()
  );

  const allServed = statuses.every(
    (s) => s === "SERVED" || s === "COMPLETED" || s === "DELIVERED"
  );
  if (allServed) return "SERVED";

  const allReadyOrServed = statuses.every(
    (s) => s === "READY" || s === "SERVED" || s === "COMPLETED" || s === "DELIVERED"
  );
  if (allReadyOrServed) return "READY";

  const anyPreparingOrReady = statuses.some(
    (s) => s === "PREPARING" || s === "IN_PROGRESS" || s === "READY"
  );
  if (anyPreparingOrReady) return "PREPARING";

  const anyAccepted = statuses.some((s) => s === "ACCEPTED");
  if (anyAccepted) return "ACCEPTED";

  return currentStatus;
}
