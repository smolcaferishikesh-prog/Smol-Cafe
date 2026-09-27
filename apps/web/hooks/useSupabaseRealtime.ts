"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export interface RealtimeSubscriptionOptions {
  table: string;
  schema?: string;
  filter?: string;
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  onData: (payload: any) => void;
  enabled?: boolean;
}

/**
 * High-performance React hook for real-time PostgreSQL WebSocket subscriptions via Supabase Realtime.
 * Uses deterministic channel names to prevent connection bloat and re-subscribe churn.
 */
export function useSupabaseRealtime({
  table,
  schema = "public",
  filter,
  event = "*",
  onData,
  enabled = true,
}: RealtimeSubscriptionOptions) {
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
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = (supabase as any).channel(channelName);

    if (!channel || typeof channel.on !== "function") {
      return;
    }

    channel
      .on(
        "postgres_changes",
        {
          event,
          schema,
          table,
          filter,
        },
        (payload: any) => {
          if (onDataRef.current) {
            onDataRef.current(payload);
          }
        }
      )
      .subscribe((status: string) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(`[Realtime] Channel status for ${table}: ${status}`);
        }
      });

    return () => {
      try {
        if (typeof (supabase as unknown as { removeChannel?: (c: unknown) => void }).removeChannel === "function") {
          (supabase as unknown as { removeChannel: (c: unknown) => void }).removeChannel(channel);
        }
      } catch {
        // ignore cleanup error
      }
    };
  }, [table, schema, filter, event, enabled]);
}
