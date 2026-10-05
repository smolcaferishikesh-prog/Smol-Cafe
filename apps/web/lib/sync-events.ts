/**
 * Smol Café — Cross-Interface Real-Time Sync Utility
 * Enables zero-latency communication across Customer, Kitchen, Barista, Cashier,
 * and Admin views using in-memory listeners, BroadcastChannel, localStorage events,
 * and Supabase Realtime WebSockets with reliable delivery guarantees.
 */

import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type SyncEventType =
  | "ORDER_PLACED"
  | "ORDER_CONFIRMED"
  | "ORDER_REJECTED"
  | "ORDER_PENDING_CASHIER"
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
  priceRupees?: number;
  pricePaise?: number;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

const CHANNEL_NAME = "smol_orders_channel";
const STORAGE_KEY = "smol_sync_event";
const SUPABASE_BROADCAST_CHANNEL = "smol_orders_live";
const MAX_PENDING_SUPABASE_EVENTS = 100;
const MAX_SEND_RETRIES = 5;
const EVENT_TTL_MS = 60000;
const DEDUPE_WINDOW_MS = 3000;

// Set of active event listeners across the application
const syncListeners = new Set<(event: SyncPayload) => void>();

// In-memory event deduplication cache to prevent duplicate ticket ingestion & double chimes
const recentEventKeys = new Map<string, number>();

function shouldProcessEvent(event: SyncPayload): boolean {
  const now = Date.now();
  // Cleanup stale keys (> 10s)
  for (const [k, ts] of recentEventKeys.entries()) {
    if (now - ts > 10000) {
      recentEventKeys.delete(k);
    }
  }

  const id = event.orderId || event.orderNo || event.itemId || event.tableLabel || "global";
  const status = event.status || event.stockStatus || "";
  const timeBucket = event.timestamp ? Math.floor(event.timestamp / DEDUPE_WINDOW_MS) : Math.floor(now / DEDUPE_WINDOW_MS);
  const dedupeKey = `${event.type}_${id}_${status}_${timeBucket}`;

  if (recentEventKeys.has(dedupeKey)) {
    return false;
  }

  recentEventKeys.set(dedupeKey, now);
  return true;
}

function dispatchToLocalListeners(event: SyncPayload): void {
  if (!shouldProcessEvent(event)) {
    return;
  }

  syncListeners.forEach((listener) => {
    try {
      listener(event);
    } catch (err) {
      console.error("Error in sync listener:", err);
    }
  });
}

// Singleton BroadcastChannel reference for active tabs in the same origin
let globalBroadcastChannel: BroadcastChannel | null = null;

function getOrInitBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return null;
  if (!globalBroadcastChannel) {
    try {
      globalBroadcastChannel = new BroadcastChannel(CHANNEL_NAME);
      globalBroadcastChannel.onmessage = (e: MessageEvent<SyncPayload>) => {
        if (e.data && e.data.type) {
          dispatchToLocalListeners(e.data);
        }
      };
    } catch {
      globalBroadcastChannel = null;
    }
  }
  return globalBroadcastChannel;
}

interface QueuedEvent {
  payload: SyncPayload;
  queuedAt: number;
  retries: number;
}

// Singleton Supabase broadcast channel state
let globalSupabaseChannel: RealtimeChannel | null = null;
let isSupabaseChannelReady = false;
let isConnecting = false;
let reconnectTimer: NodeJS.Timeout | null = null;
let retryFlushTimer: NodeJS.Timeout | null = null;
const pendingSupabaseEvents: QueuedEvent[] = [];

async function sendSupabaseEventDirect(channel: RealtimeChannel, payload: SyncPayload): Promise<boolean> {
  try {
    const result = await channel.send({
      type: "broadcast",
      event: "sync",
      payload,
    });
    // In @supabase/realtime-js, send resolves to 'ok' | 'timed out' | 'error'
    return result === "ok";
  } catch {
    return false;
  }
}

async function flushPendingSupabaseEvents(): Promise<void> {
  if (!isSupabaseChannelReady || !globalSupabaseChannel) return;
  if (pendingSupabaseEvents.length === 0) return;

  const now = Date.now();
  const toProcess = pendingSupabaseEvents.splice(0, pendingSupabaseEvents.length);

  for (const item of toProcess) {
    if (now - item.queuedAt > EVENT_TTL_MS) {
      continue; // Dropping expired event
    }

    const ok = await sendSupabaseEventDirect(globalSupabaseChannel, item.payload);
    if (!ok && item.retries < MAX_SEND_RETRIES) {
      pendingSupabaseEvents.push({
        payload: item.payload,
        queuedAt: item.queuedAt,
        retries: item.retries + 1,
      });
    }
  }

  // If there are still failed items to retry, schedule a follow-up flush
  if (pendingSupabaseEvents.length > 0 && !retryFlushTimer) {
    retryFlushTimer = setTimeout(() => {
      retryFlushTimer = null;
      flushPendingSupabaseEvents();
    }, 1000);
  }
}

function getOrInitSupabaseChannel(): RealtimeChannel | null {
  if (typeof window === "undefined") return null;

  if (globalSupabaseChannel && isSupabaseChannelReady) {
    return globalSupabaseChannel;
  }

  if (isConnecting) {
    return globalSupabaseChannel;
  }

  try {
    const supabase = createClient();
    if (!supabase || typeof supabase.channel !== "function") return null;

    isConnecting = true;

    // Clean up existing channel if reconnecting
    if (globalSupabaseChannel) {
      try {
        supabase.removeChannel(globalSupabaseChannel);
      } catch {
        // ignore cleanup error
      }
      globalSupabaseChannel = null;
    }

    const channel = supabase.channel(SUPABASE_BROADCAST_CHANNEL, {
      config: {
        broadcast: { ack: false, self: true },
      },
    });

    // 1. Broadcast messages from other devices/tabs
    channel.on(
      "broadcast",
      { event: "sync" },
      ({ payload }: { payload: SyncPayload }) => {
        if (payload && payload.type) {
          dispatchToLocalListeners(payload);
        }
      }
    );

    // 2. Direct Postgres CDC push notifications on 'orders' table
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      (payload: { new?: Record<string, unknown>; eventType: string }) => {
        const newOrder = payload?.new;
        if (newOrder && typeof newOrder.id === "string") {
          const status = typeof newOrder.status === "string" ? newOrder.status : "PENDING";
          const syncEvent: SyncPayload = {
            type:
              status === "PENDING" || status === "SUBMITTED"
                ? "ORDER_PLACED"
                : "STATUS_CHANGED",
            orderId: newOrder.id,
            orderNo: typeof newOrder.order_no === "number" ? newOrder.order_no : undefined,
            status,
            timestamp: Date.now(),
            metadata: {
              eventType: payload.eventType,
            },
          };
          dispatchToLocalListeners(syncEvent);
        }
      }
    );

    // 3. Direct Postgres CDC push notifications on 'menu_items'
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "menu_items" },
      (payload: { new?: Record<string, unknown>; eventType: string }) => {
        const item = payload?.new;
        if (item && typeof item.id === "string") {
          const syncEvent: SyncPayload = {
            type: "ITEM_AVAILABILITY_CHANGED",
            itemId: item.id,
            stockStatus: item.status === "SOLD_OUT" ? "SOLD_OUT" : "IN_STOCK",
            timestamp: Date.now(),
            metadata: {
              eventType: payload.eventType,
            },
          };
          dispatchToLocalListeners(syncEvent);
        }
      }
    );

    channel.subscribe((status: string) => {
      isConnecting = false;
      if (status === "SUBSCRIBED") {
        isSupabaseChannelReady = true;
        flushPendingSupabaseEvents();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        isSupabaseChannelReady = false;
        // Schedule auto-reconnect backoff
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            getOrInitSupabaseChannel();
          }, 1500);
        }
      }
    });

    globalSupabaseChannel = channel;
  } catch {
    isConnecting = false;
    isSupabaseChannelReady = false;
  }

  return globalSupabaseChannel;
}

// Browser lifecycle listeners to automatically re-sync when network or tab resumes
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    isSupabaseChannelReady = false;
    getOrInitSupabaseChannel();
  });

  window.addEventListener("focus", () => {
    if (!isSupabaseChannelReady) {
      getOrInitSupabaseChannel();
    } else {
      flushPendingSupabaseEvents();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (!isSupabaseChannelReady) {
        getOrInitSupabaseChannel();
      } else {
        flushPendingSupabaseEvents();
      }
    }
  });
}

/**
 * Broadcasts an event across all open tabs, windows, and external devices via Supabase Realtime.
 */
export function broadcastSyncEvent(event: SyncPayload): void {
  if (typeof window === "undefined") return;

  const payload: SyncPayload = {
    ...event,
    timestamp: event.timestamp || Date.now(),
  };

  // 1. Dispatch locally to all registered listeners in current page (0ms)
  dispatchToLocalListeners(payload);

  // 2. BroadcastChannel for active tabs in same origin (0ms across tabs)
  try {
    const bc = getOrInitBroadcastChannel();
    if (bc) {
      bc.postMessage(payload);
    }
  } catch {
    // BroadcastChannel error ignored
  }

  // 3. LocalStorage trigger for cross-window / background tabs in same origin
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...payload, _nonce: `${Date.now()}_${Math.random()}` })
    );
  } catch {
    // LocalStorage error ignored
  }

  // 4. Supabase Realtime Broadcast Channel for cross-device & cross-port delivery.
  try {
    const sbChannel = getOrInitSupabaseChannel();
    if (sbChannel && isSupabaseChannelReady) {
      sendSupabaseEventDirect(sbChannel, payload).then((ok) => {
        if (!ok) {
          // If immediate send timed out or errored, queue for retry
          pendingSupabaseEvents.push({
            payload,
            queuedAt: Date.now(),
            retries: 1,
          });
          if (pendingSupabaseEvents.length > MAX_PENDING_SUPABASE_EVENTS) {
            pendingSupabaseEvents.shift();
          }
          if (!retryFlushTimer) {
            retryFlushTimer = setTimeout(() => {
              retryFlushTimer = null;
              flushPendingSupabaseEvents();
            }, 1000);
          }
        }
      });
    } else {
      // Channel connecting or offline: queue and flush as soon as SUBSCRIBED
      pendingSupabaseEvents.push({
        payload,
        queuedAt: Date.now(),
        retries: 0,
      });
      if (pendingSupabaseEvents.length > MAX_PENDING_SUPABASE_EVENTS) {
        pendingSupabaseEvents.shift();
      }
      getOrInitSupabaseChannel();
    }
  } catch {
    pendingSupabaseEvents.push({
      payload,
      queuedAt: Date.now(),
      retries: 0,
    });
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
    return () => {};
  }

  // Register in local listener set
  syncListeners.add(callback);

  // Initialize persistent BroadcastChannel and Supabase WebSocket broadcast channel
  getOrInitBroadcastChannel();
  getOrInitSupabaseChannel();

  const storageHandler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue) as SyncPayload;
        dispatchToLocalListeners(parsed);
      } catch {
        // parse error ignored
      }
    }
  };

  window.addEventListener("storage", storageHandler);

  return () => {
    syncListeners.delete(callback);
    window.removeEventListener("storage", storageHandler);
  };
}
