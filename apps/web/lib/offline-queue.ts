/**
 * Smol Café — Offline Order Queue & Background Sync Engine
 * Enables seamless order placement, ticket buffering, and automatic
 * reconciliation when network connectivity drops or recovers.
 */

import { broadcastSyncEvent } from "./sync-events";
import { placePaidOrderAction } from "@/app/menu/actions";
import { generateSafeUuid } from "./uuid";

export interface QueuedOfflineOrder {
  idempotencyKey: string;
  tempOrderNo: number;
  tableLabel: string;
  items: Array<{
    menu_item_id: string;
    expected_unit_price_paise: number;
    qty: number;
    name: string;
  }>;
  totalPaise: number;
  instructions?: string;
  paymentMethod: string;
  transactionId?: string;
  queuedAt: number;
  status: "QUEUED" | "SYNCING" | "SYNCED" | "FAILED";
  retryCount: number;
  lastError?: string;
  verificationCode: string;
}

const STORAGE_KEY = "smol_offline_order_queue";
const OFFLINE_SYNC_CHANNEL = "smol_offline_sync";

/**
 * Retrieves all currently queued offline orders from localStorage
 */
export function getQueuedOfflineOrders(): QueuedOfflineOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedOfflineOrder[];
  } catch (err) {
    console.warn("Error reading offline order queue:", err);
    return [];
  }
}

/**
 * Persists the offline order queue
 */
function saveQueuedOfflineOrders(queue: QueuedOfflineOrder[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    notifyQueueChange();
  } catch (err) {
    console.warn("Error saving offline order queue:", err);
  }
}

function notifyQueueChange() {
  if (typeof window === "undefined") return;
  try {
    if ("BroadcastChannel" in window) {
      const bc = new BroadcastChannel(OFFLINE_SYNC_CHANNEL);
      bc.postMessage({ type: "QUEUE_CHANGED", timestamp: Date.now() });
      bc.close();
    }
  } catch {
    // ignore
  }
}

/**
 * Enqueues an order when offline or when a network request fails
 */
export function enqueueOfflineOrder(orderData: {
  tableLabel: string;
  items: Array<{
    menu_item_id: string;
    expected_unit_price_paise: number;
    qty: number;
    name: string;
  }>;
  totalPaise: number;
  instructions?: string;
  paymentMethod?: string;
  transactionId?: string;
}): QueuedOfflineOrder {
  const queue = getQueuedOfflineOrders();
  const idempotencyKey = generateSafeUuid();
  const tempOrderNo = Math.floor(100 + Math.random() * 900);
  const verificationCode = String(Math.floor(1000 + Math.random() * 9000));

  const queuedOrder: QueuedOfflineOrder = {
    idempotencyKey,
    tempOrderNo,
    tableLabel: orderData.tableLabel,
    items: orderData.items,
    totalPaise: orderData.totalPaise,
    instructions: orderData.instructions,
    paymentMethod: orderData.paymentMethod || "CASH_AT_COUNTER",
    transactionId: orderData.transactionId || `OFF-${Date.now().toString().slice(-6)}`,
    queuedAt: Date.now(),
    status: "QUEUED",
    retryCount: 0,
    verificationCode,
  };

  queue.push(queuedOrder);
  saveQueuedOfflineOrders(queue);

  // Broadcast local order placed event so kitchen/cashier in same browser tab mesh see it
  broadcastSyncEvent({
    type: "ORDER_PLACED",
    orderId: `offline-${idempotencyKey}`,
    orderNo: tempOrderNo,
    tableLabel: orderData.tableLabel,
    status: "PENDING_VERIFICATION",
    timestamp: Date.now(),
    metadata: {
      isOffline: true,
      verificationCode,
      amountPaise: orderData.totalPaise,
      itemsCount: orderData.items.length,
    },
  });

  return queuedOrder;
}

/**
 * Removes a synced or discarded order from queue
 */
export function removeQueuedOrder(idempotencyKey: string): void {
  const queue = getQueuedOfflineOrders();
  const filtered = queue.filter((o) => o.idempotencyKey !== idempotencyKey);
  saveQueuedOfflineOrders(filtered);
}

/**
 * Processes all queued offline orders sequentially when online
 */
export async function processOfflineOrderQueue(): Promise<{
  syncedCount: number;
  failedCount: number;
  results: Array<{ orderNo: number; success: boolean; serverOrderNo?: number; message?: string }>;
}> {
  if (typeof window === "undefined" || !navigator.onLine) {
    return { syncedCount: 0, failedCount: 0, results: [] };
  }

  const queue = getQueuedOfflineOrders();
  if (queue.length === 0) {
    return { syncedCount: 0, failedCount: 0, results: [] };
  }

  let syncedCount = 0;
  let failedCount = 0;
  const results: Array<{ orderNo: number; success: boolean; serverOrderNo?: number; message?: string }> = [];

  for (const order of queue) {
    try {
      order.status = "SYNCING";
      order.retryCount += 1;

      const res = await placePaidOrderAction(
        order.items.map((it) => ({
          menu_item_id: it.menu_item_id,
          expected_unit_price_paise: it.expected_unit_price_paise,
          qty: it.qty,
          name: it.name,
        })),
        order.idempotencyKey,
        {
          instructions: order.instructions,
          paymentMethod: order.paymentMethod,
          tableLabel: order.tableLabel,
        }
      );

      if (res.success && res.orderId) {
        order.status = "SYNCED";
        syncedCount += 1;
        results.push({
          orderNo: order.tempOrderNo,
          serverOrderNo: res.orderNo,
          success: true,
          message: `Synced to server as Order #${res.orderNo}`,
        });

        // Broadcast live confirmation across network
        broadcastSyncEvent({
          type: "ORDER_CONFIRMED",
          orderId: res.orderId,
          orderNo: res.orderNo,
          tableLabel: order.tableLabel,
          status: "CONFIRMED",
          timestamp: Date.now(),
        });
        broadcastSyncEvent({
          type: "INVENTORY_UPDATED",
          timestamp: Date.now(),
        });

        // Remove from local queue
        removeQueuedOrder(order.idempotencyKey);
      } else {
        order.status = "FAILED";
        order.lastError = res.message || "Server rejected offline order.";
        failedCount += 1;
        results.push({
          orderNo: order.tempOrderNo,
          success: false,
          message: order.lastError,
        });
      }
    } catch (err: unknown) {
      order.status = "FAILED";
      order.lastError = (err as Error)?.message || "Network error during sync.";
      failedCount += 1;
      results.push({
        orderNo: order.tempOrderNo,
        success: false,
        message: order.lastError,
      });
    }
  }

  saveQueuedOfflineOrders(getQueuedOfflineOrders());
  return { syncedCount, failedCount, results };
}

/**
 * Registers automatic background synchronization on network reconnect
 */
export function registerOfflineAutoSync(onSyncComplete?: (synced: number) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handleOnline = async () => {
    const res = await processOfflineOrderQueue();
    if (res.syncedCount > 0 && onSyncComplete) {
      onSyncComplete(res.syncedCount);
    }
  };

  window.addEventListener("online", handleOnline);

  let bc: BroadcastChannel | null = null;
  try {
    if ("BroadcastChannel" in window) {
      bc = new BroadcastChannel(OFFLINE_SYNC_CHANNEL);
      bc.onmessage = () => {
        // queue changed
      };
    }
  } catch {
    // ignore
  }

  return () => {
    window.removeEventListener("online", handleOnline);
    if (bc) bc.close();
  };
}
