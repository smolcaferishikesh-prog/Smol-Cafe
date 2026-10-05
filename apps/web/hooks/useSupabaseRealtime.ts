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
 * Uses deterministic channel names to prevent connection bloat and re-subscribe churn.
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

    // Deterministic channel name per table & filter to avoid duplicate subscriptions
    const channelName = `realtime_${schema}_${table}_${filter || "all"}`;
    let isSubscribed = true;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    function setupChannel() {
      if (!isSubscribed) return;

      const channel = supabase.channel(channelName);

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
            if (isSubscribed && !reconnectTimeout) {
              reconnectTimeout = setTimeout(() => {
                reconnectTimeout = null;
                try {
                  supabase.removeChannel(channel);
                } catch {
                  // ignore cleanup
                }
                setupChannel();
              }, 2000);
            }
          }
        });

      return channel;
    }

    const currentChannel = setupChannel();

    return () => {
      isSubscribed = false;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      try {
        if (currentChannel) {
          supabase.removeChannel(currentChannel);
        }
      } catch {
        // ignore cleanup error
      }
    };
  }, [table, schema, filter, event, enabled]);
}
