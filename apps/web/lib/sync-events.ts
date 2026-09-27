/**
 * Smol Café — Cross-Interface Real-Time Sync Utility
 * Enables zero-latency communication across Customer, Kitchen, Cashier,
 * and Admin views using BroadcastChannel, localStorage events, and Supabase WebSockets.
 */

import { createClient } from "@/lib/supabase/client";

export type SyncEventType =
  | "ORDER_PLACED"
  | "ORDER_CONFIRMED"
  | "ORDER_REJECTED"
  | "STATUS_CHANGED"
  | "TICKET_STATUS_CHANGED"
  | "ITEM_AVAILABILITY_CHANGED"
  | "TABLE_RENAMED"
  | "TABLE_CREATED"
  | "TABLE_DELETED"
  | "REWARD_REDEEMED"
  | "LOYALTY_UPDATED"
  | "INVENTORY_UPDATED"
  | "BILL_SETTLED"
  | "PAYMENT_COMPLETED"
  | "BARISTA_TICKET_CHANGED"
  | "SETTINGS_UPDATED";

export interface SyncPayload {
  type: SyncEventType;
  orderId?: string;
  orderNo?: number;
  tableLabel?: string;
  tableId?: string;
  itemId?: string;
  availability?: string;
  portionsLeft?: number;
  stockStatus?: string;
  status?: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

const CHANNEL_NAME = "smol_orders_channel";
const STORAGE_KEY = "smol_sync_event";
const SUPABASE_BROADCAST_CHANNEL = "smol_orders_live";

// Set of active event listeners across the application
const syncListeners = new Set<(event: SyncPayload) => void>();

// Singleton Supabase broadcast channel reference
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let globalSupabaseChannel: any = null;

function getOrInitSupabaseChannel() {
  if (typeof window === "undefined") return null;
  if (!globalSupabaseChannel) {
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (supabase && typeof (supabase as any).channel === "function") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const channel = (supabase as any).channel(SUPABASE_BROADCAST_CHANNEL, {
          config: { broadcast: { self: true } },
        });

        // Register broadcast listener BEFORE subscribing
        channel.on(
          "broadcast",
          { event: "sync" },
          ({ payload }: { payload: SyncPayload }) => {
            if (payload && payload.type) {
              syncListeners.forEach((listener) => {
                try {
                  listener(payload);
                } catch (err) {
                  console.error("Error in sync listener:", err);
                }
              });
            }
          }
        );

        // Listen to Postgres CDC changes on 'orders' table for instant DB push notifications
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload: any) => {
            const newOrder = payload?.new;
            if (newOrder && newOrder.id) {
              const syncEvent: SyncPayload = {
                type: newOrder.status === "PENDING" || newOrder.status === "SUBMITTED" ? "ORDER_PLACED" : "STATUS_CHANGED",
                orderId: newOrder.id,
                orderNo: newOrder.order_no,
                tableLabel: newOrder.table_label,
                status: newOrder.status,
                timestamp: Date.now(),
                metadata: {
                  newRow: newOrder,
                  eventType: payload.eventType,
                },
              };
              syncListeners.forEach((listener) => {
                try {
                  listener(syncEvent);
                } catch {
                  // ignore
                }
              });
            }
          }
        );

        // Listen to Postgres CDC changes on 'menu_items' table for instant stock/price updates
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table: "menu_items" },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload: any) => {
            const item = payload?.new;
            if (item && item.id) {
              const syncEvent: SyncPayload = {
                type: "ITEM_AVAILABILITY_CHANGED",
                itemId: item.id,
                stockStatus: item.status === "SOLD_OUT" ? "SOLD_OUT" : item.metadata?.availability || "IN_STOCK",
                timestamp: Date.now(),
                metadata: {
                  item,
                  eventType: payload.eventType,
                },
              };
              syncListeners.forEach((listener) => {
                try {
                  listener(syncEvent);
                } catch {
                  // ignore
                }
              });
            }
          }
        );

        channel.subscribe((status: string) => {
          if (status === "SUBSCRIBED") {
            // Connected to broadcast mesh
          }
        });

        globalSupabaseChannel = channel;
      }
    } catch {
      // Supabase client unavailable
    }
  }
  return globalSupabaseChannel;
}

/**
 * Broadcasts an event across all open tabs, windows, and external devices via Supabase Realtime.
 */
export function broadcastSyncEvent(event: SyncPayload): void {
  if (typeof window === "undefined") return;

  const payload: SyncPayload = {
    ...event,
    timestamp: Date.now(),
  };

  // 1. Dispatch locally to all registered listeners in current page
  syncListeners.forEach((listener) => {
    try {
      listener(payload);
    } catch {
      // ignore
    }
  });

  // 2. BroadcastChannel for active tabs in same origin
  try {
    if ("BroadcastChannel" in window) {
      const bc = new BroadcastChannel(CHANNEL_NAME);
      bc.postMessage(payload);
      bc.close();
    }
  } catch {
    // BroadcastChannel error ignored
  }

  // 3. LocalStorage trigger for cross-window / background tabs in same origin
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // LocalStorage error ignored
  }

  // 4. Supabase Realtime Broadcast Channel for cross-device & cross-port sync (localhost:3000 <-> localhost:3001)
  try {
    const sbChannel = getOrInitSupabaseChannel();
    if (sbChannel && typeof sbChannel.send === "function") {
      sbChannel.send({
        type: "broadcast",
        event: "sync",
        payload,
      }).catch(() => { });
    }
  } catch {
    // Supabase broadcast error ignored
  }
}

/**
  * Alias for broadcastSyncEvent for ergonomics across components and actions
  */
export const emitSyncEvent = broadcastSyncEvent;

/**
 * Subscribes to real-time sync events across tabs, windows, ports, and devices.
 */
export function subscribeToSyncEvents(
  callback: (event: SyncPayload) => void
): () => void {
  if (typeof window === "undefined") {
    return () => { };
  }

  // Register in local listener set
  syncListeners.add(callback);

  // Initialize Supabase WebSocket broadcast channel
  getOrInitSupabaseChannel();

  let bc: BroadcastChannel | null = null;
  try {
    if ("BroadcastChannel" in window) {
      bc = new BroadcastChannel(CHANNEL_NAME);
      bc.onmessage = (e) => {
        if (e.data && e.data.type) {
          callback(e.data as SyncPayload);
        }
      };
    }
  } catch {
    bc = null;
  }

  const storageHandler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        callback(parsed as SyncPayload);
      } catch {
        // parse error ignored
      }
    }
  };

  window.addEventListener("storage", storageHandler);

  return () => {
    syncListeners.delete(callback);
    if (bc) {
      bc.close();
    }
    window.removeEventListener("storage", storageHandler);
  };
}
