"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export interface RealtimeSubscriptionOptions<T extends { [key: string]: unknown } = Record<string, unknown>> {
  table: string;
  schema?: string;
  filter?: string;
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  onData: (payload: RealtimePostgresChangesPayload<T>) => void;
  enabled?: boolean;
}

/**
 * High-performance React hook for real-time PostgreSQL WebSocket subscriptions via Supabase Realtime.
 * Uses unique channel identifiers per hook instance to prevent callbacks-after-subscribe errors,
 * connection bloat, and StrictMode channel collisions.
 */
export function useSupabaseRealtime<T extends { [key: string]: unknown } = Record<string, unknown>>({
  table,
  schema = "public",
  filter,
  event = "*",
  onData,
  enabled = true,
}: RealtimeSubscriptionOptions<T>) {
  const onDataRef = useRef(onData);
  onDataRef.current = onData;

  useEffect(() => {
    if (!enabled) return;

    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    // Unique channel instance per component to avoid "cannot add callbacks after subscribe()" error
    const channelId = `rt_${schema}_${table}_${filter ? filter.replace(/[^a-zA-Z0-9]/g, "_") : "all"}_${Math.random().toString(36).slice(2, 9)}`;
    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    function setupChannel() {
      if (!isMounted) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return;
      }

      try {
        if (channel) {
          try {
            supabase.removeChannel(channel);
          } catch {
            // ignore
          }
        }
        channel = supabase.channel(channelId);

        channel
          .on(
            "postgres_changes",
            {
              event,
              schema,
              table,
              filter,
            },
            (payload: RealtimePostgresChangesPayload<T>) => {
              if (onDataRef.current) {
                onDataRef.current(payload);
              }
            }
          )
          .subscribe((status: string) => {
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              if (isMounted && !reconnectTimeout && (typeof navigator === "undefined" || navigator.onLine)) {
                reconnectTimeout = setTimeout(() => {
                  reconnectTimeout = null;
                  if (!isMounted) return;
                  setupChannel();
                }, 3000);
              }
            }
          });
      } catch {
        // Silently handle setup error when offline
      }
    }

    const handleOnline = () => {
      if (isMounted) {
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
          reconnectTimeout = null;
        }
        setupChannel();
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
    }

    setupChannel();

    return () => {
      isMounted = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          // ignore cleanup error
        }
      }
    };
  }, [table, schema, filter, event, enabled]);
}
