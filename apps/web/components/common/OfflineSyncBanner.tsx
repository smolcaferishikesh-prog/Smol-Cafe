"use client";

import React, { useState, useEffect } from "react";
import { useNetworkHealth } from "@/hooks/useNetworkHealth";
import {
  getQueuedOfflineOrders,
  processOfflineOrderQueue,
  registerOfflineAutoSync,
  type QueuedOfflineOrder,
} from "@/lib/offline-queue";
import { WifiOff, Wifi, RefreshCw, CheckCircle2, AlertCircle, X } from "lucide-react";

export const OfflineSyncBanner: React.FC = () => {
  const { isOnline, isDegraded, checkHealth } = useNetworkHealth();
  const [queuedOrders, setQueuedOrders] = useState<QueuedOfflineOrder[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Poll / refresh queued orders
  const refreshQueue = () => {
    setQueuedOrders(getQueuedOfflineOrders());
  };

  useEffect(() => {
    setIsMounted(true);
    refreshQueue();

    const cleanup = registerOfflineAutoSync((syncedCount) => {
      refreshQueue();
      setSyncNotice(`Synced ${syncedCount} offline order${syncedCount > 1 ? "s" : ""} to server!`);
      setTimeout(() => setSyncNotice(null), 5000);
    });

    const interval = setInterval(refreshQueue, 3000);
    return () => {
      cleanup();
      clearInterval(interval);
    };
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    await checkHealth();
    const res = await processOfflineOrderQueue();
    setIsSyncing(false);
    refreshQueue();

    if (res.syncedCount > 0) {
      setSyncNotice(`Successfully synchronized ${res.syncedCount} order${res.syncedCount > 1 ? "s" : ""}!`);
      setTimeout(() => setSyncNotice(null), 4000);
    } else if (res.failedCount > 0) {
      setSyncNotice("Sync failed: Check network connection or server status.");
      setTimeout(() => setSyncNotice(null), 4000);
    }
  };

  // Disabled by user request — do not show offline banner
  return null;

  // Only render if mounted on client AND (offline OR has queued orders waiting to sync OR active sync notice)
  if (!isMounted || (isOnline && queuedOrders.length === 0 && !syncNotice)) {
    return null;
  }

  if (isDismissed && queuedOrders.length === 0) {
    return null;
  }

  return (
    <div className="sticky top-0 z-[100] w-full px-3 py-2 text-xs font-sans border-b shadow-md transition-all duration-200 bg-[#FAF4EB] border-[#C9AE8B] text-[#241F1C] dark:bg-[#1A1715] dark:border-stone-800 dark:text-[#FDFBF7]">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        {/* Left: Status Icon & Message */}
        <div className="flex items-center gap-2.5 min-w-0">
          {!isOnline || isDegraded ? (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#B72E35]/15 border border-[#B72E35]/30 text-[#B72E35]">
              <WifiOff className="h-3.5 w-3.5 animate-pulse" />
            </div>
          ) : syncNotice ? (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
          ) : (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 border border-amber-300 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              <Wifi className="h-3.5 w-3.5 text-amber-600" />
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-bold">
              <span>
                {syncNotice
                  ? syncNotice
                  : !isOnline
                    ? "Offline Mode Active"
                    : isDegraded
                      ? "Weak Connection"
                      : "Pending Local Queue"}
              </span>
              {queuedOrders.length > 0 && (
                <span className="rounded-full bg-[#B72E35] text-white px-2 py-0.2 font-mono text-[10px] font-black">
                  {queuedOrders.length} {queuedOrders.length === 1 ? "order" : "orders"} queued
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#725039] dark:text-stone-400 truncate">
              {!isOnline
                ? "Orders and actions are buffered locally. Will auto-sync upon reconnection."
                : queuedOrders.length > 0
                  ? "Local orders ready to synchronize with the server."
                  : "Connecting to smol café realtime mesh..."}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {queuedOrders.length > 0 && (
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 rounded-full bg-[#B72E35] hover:bg-[#9E242A] text-white px-3 py-1.5 text-xs font-bold transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Syncing..." : "Sync Now"}</span>
            </button>
          )}

          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 rounded-full text-[#725039] hover:bg-[#EAE0CE] dark:text-stone-400 dark:hover:bg-stone-800 transition cursor-pointer"
            aria-label="Dismiss banner"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
