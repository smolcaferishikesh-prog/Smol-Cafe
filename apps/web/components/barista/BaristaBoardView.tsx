"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Image from "next/image";
import type { BaristaTicket, BaristaOrderItem } from "@/app/barista/actions";
import {
  fetchBaristaOrdersAction,
  fetchSingleBaristaTicketAction,
  transitionBaristaOrderStatusAction,
  staffLogoutAction,
} from "@/app/barista/actions";
import type { OrderStatus } from "@smol-cafe/db";
import { isBeverageItem } from "@/lib/station-utils";
import { BaristaTicketCard } from "./BaristaTicketCard";
import { EspressoShotTimer } from "./EspressoShotTimer";
import {
  Coffee,
  Bell,
  BellOff,
  RefreshCw,
  LogOut,
  RotateCcw,
  Trash2,
  Search,
} from "lucide-react";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";
import { broadcastSyncEvent, subscribeToSyncEvents } from "@/lib/sync-events";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { soundManager } from "@/lib/sound";

interface BaristaBoardViewProps {
  initialOrders: BaristaTicket[];
}

export const BaristaBoardView: React.FC<BaristaBoardViewProps> = ({ initialOrders }) => {
  const [orders, setOrders] = useState<BaristaTicket[]>(initialOrders);
  const [dismissedTicketIds, setDismissedTicketIds] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | "ESPRESSO" | "COLD" | "SHAKES">("ALL");
  const [mounted, setMounted] = useState(false);
  const prevOrderCountRef = useRef(initialOrders.length);
  const playedChimeTicketIdsRef = useRef<Set<string>>(
    new Set(initialOrders.map((o) => o.id))
  );
  const optimisticLocksRef = useRef<Map<string, { status: OrderStatus; timestamp: number }>>(new Map());
  // Deduplication guard: prevent concurrent refreshOrders server action calls
  const isRefreshingRef = useRef(false);
  const pendingRefreshRef = useRef(false);
  // Debounce timer for sync-triggered refreshes
  const syncRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = sessionStorage.getItem("smol_barista_dismissed_tickets");
      if (saved) {
        setDismissedTicketIds(new Set(JSON.parse(saved)));
      }
    } catch {
      // safe
    }
  }, []);

  const handleDismissTicket = (orderId: string) => {
    setDismissedTicketIds((prev) => {
      const updated = new Set(prev);
      updated.add(orderId);
      try {
        sessionStorage.setItem("smol_barista_dismissed_tickets", JSON.stringify(Array.from(updated)));
      } catch {
        // safe
      }
      return updated;
    });
  };

  const handleClearAllCompleted = () => {
    const completedToDismiss = orders.filter(
      (o) => ["SERVED", "COMPLETED", "CLOSED"].includes(o.status) && !dismissedTicketIds.has(o.id)
    );
    if (completedToDismiss.length === 0) return;

    setDismissedTicketIds((prev) => {
      const updated = new Set(prev);
      completedToDismiss.forEach((o) => updated.add(o.id));
      try {
        sessionStorage.setItem("smol_barista_dismissed_tickets", JSON.stringify(Array.from(updated)));
      } catch {
        // safe
      }
      return updated;
    });
  };

  const handleRestoreDismissed = () => {
    setDismissedTicketIds(new Set());
    try {
      sessionStorage.removeItem("smol_barista_dismissed_tickets");
    } catch {
      // safe
    }
  };

  const playChime = useCallback((orderId?: string) => {
    if (!soundEnabled) return;
    if (orderId) {
      if (playedChimeTicketIdsRef.current.has(orderId)) {
        return; // Already chimed for this ticket
      }
      playedChimeTicketIdsRef.current.add(orderId);
    }
    soundManager.playKitchenNewOrderAlert();
  }, [soundEnabled]);

  const isInitialLoadedRef = useRef(false);

  const refreshOrders = useCallback(async (isManual = false) => {
    // If a refresh is currently running, queue this refresh so we don't drop updates
    if (isRefreshingRef.current) {
      pendingRefreshRef.current = true;
      return;
    }
    isRefreshingRef.current = true;
    if (isManual) setIsRefreshing(true);
    try {
      const result = await fetchBaristaOrdersAction();
      if (result && result.success && Array.isArray(result.orders)) {
        // Chime for any incoming new/confirmed drinks orders that haven't chimed yet
        const unchimedOrders = result.orders.filter(
          (o) => !playedChimeTicketIdsRef.current.has(o.id) && ["ACCEPTED", "CONFIRMED"].includes(o.status)
        );
        if (unchimedOrders.length > 0 && isInitialLoadedRef.current) {
          unchimedOrders.forEach((o) => playChime(o.id));
        }
        result.orders.forEach((o) => playedChimeTicketIdsRef.current.add(o.id));
        isInitialLoadedRef.current = true;
        prevOrderCountRef.current = result.orders.length;

        // Clean up expired optimistic locks
        const now = Date.now();
        for (const [id, lock] of optimisticLocksRef.current.entries()) {
          if (now - lock.timestamp > 8000) {
            optimisticLocksRef.current.delete(id);
          }
        }

        const mergedOrders = result.orders.map((serverOrder) => {
          const activeLock = optimisticLocksRef.current.get(serverOrder.id);
          if (activeLock) {
            if (serverOrder.status === activeLock.status) {
              optimisticLocksRef.current.delete(serverOrder.id);
              return serverOrder;
            }
            return { ...serverOrder, status: activeLock.status };
          }
          return serverOrder;
        });

        setOrders((prev) => {
          const serverOrderIds = new Set(result.orders.map((o) => o.id));
          // Retain any locally ingested tickets that are in-flight or protected by optimisticLocks
          const uncommittedLocalOrders = prev.filter(
            (local) => !serverOrderIds.has(local.id) && (optimisticLocksRef.current.has(local.id) || ["ACCEPTED", "PREPARING", "READY"].includes(local.status))
          );
          return [...uncommittedLocalOrders, ...mergedOrders];
        });
        setLastRefreshedAt(new Date());
      }
    } catch (err) {
      console.warn("Barista orders sync retry scheduled:", err);
    } finally {
      isRefreshingRef.current = false;
      if (isManual) setIsRefreshing(false);
      if (pendingRefreshRef.current) {
        pendingRefreshRef.current = false;
        setTimeout(() => {
          refreshOrders();
        }, 100);
      }
    }
  }, [playChime]);

  // Debounced version for sync events — coalesces rapid-fire events into a single refresh
  const debouncedRefresh = useCallback(() => {
    if (syncRefreshTimerRef.current) clearTimeout(syncRefreshTimerRef.current);
    syncRefreshTimerRef.current = setTimeout(() => {
      syncRefreshTimerRef.current = null;
      refreshOrders();
    }, 1000);
  }, [refreshOrders]);

  const handleIncomingTicket = useCallback(
    (orderId: string, newStatus?: OrderStatus) => {
      // 1. Ignore orders awaiting cashier approval or drafts - Barista must NOT receive or chime for these!
      if (
        !newStatus ||
        newStatus === "PENDING_CONFIRMATION" ||
        newStatus === "DRAFT" ||
        newStatus === "SUBMITTED" ||
        newStatus === "CANCELLED" ||
        newStatus === "REJECTED"
      ) {
        if (newStatus === "CANCELLED" || newStatus === "REJECTED" || newStatus === "DRAFT") {
          setOrders((prev) => prev.filter((o) => o.id !== orderId));
        }
        return;
      }
      let exists = false;
      setOrders((prev) => {
        exists = prev.some((o) => o.id === orderId);
        if (exists && newStatus) {
          return prev.map((o) =>
            o.id === orderId ? { ...o, status: newStatus } : o
          );
        }
        return prev;
      });

      if (!exists) {
        fetchSingleBaristaTicketAction(orderId)
          .then((result) => {
            if (result && result.success && result.ticket) {
              const newTicket = result.ticket;
              if (
                newTicket.status === "PENDING_CONFIRMATION" ||
                newTicket.status === "DRAFT" ||
                newTicket.status === "SUBMITTED" ||
                newTicket.status === "CANCELLED" ||
                newTicket.status === "REJECTED"
              ) {
                return;
              }
              setOrders((prev) => {
                if (prev.some((o) => o.id === newTicket.id)) return prev;
                return [newTicket, ...prev];
              });
              playChime(newTicket.id);
            } else if (result?.reason !== "NO_BEVERAGE_ITEMS") {
              // Only fallback to full refresh if it was not identified as food-only
              refreshOrders();
            }
          })
          .catch(() => {
            refreshOrders();
          });
      }
    },
    [playChime, refreshOrders]
  );

  // Real-time WebSocket
  useSupabaseRealtime({
    table: "orders",
    onData: (payload) => {
      const newRow = payload?.new as { id?: string; status?: string } | undefined;
      if (newRow && newRow.id) {
        // Do not chime or ingest orders awaiting cashier approval
        if (
          newRow.status === "PENDING_CONFIRMATION" ||
          newRow.status === "DRAFT" ||
          newRow.status === "SUBMITTED"
        ) {
          return;
        }
        handleIncomingTicket(newRow.id, newRow.status as OrderStatus);
        debouncedRefresh();
      } else {
        debouncedRefresh();
      }
    },
  });

  // Real-Time Event Listener & Non-Overlapping Polling Fallback Loop
  useEffect(() => {
    // 1. Safe, non-overlapping self-scheduling poll loop
    let pollActive = true;
    let pollTimer: NodeJS.Timeout | null = null;

    const scheduleNextPoll = () => {
      if (!pollActive) return;
      pollTimer = setTimeout(async () => {
        if (!pollActive) return;
        if (document.visibilityState === "visible") {
          try {
            await refreshOrders();
          } catch {
            // ignore background poll error
          }
        }
        if (pollActive) {
          scheduleNextPoll();
        }
      }, 1000);
    };

    scheduleNextPoll();

    const unsubscribe = subscribeToSyncEvents((event) => {
      // Ignore orders awaiting cashier approval in Barista Desk
      if (
        event.type === "ORDER_PENDING_CASHIER" ||
        event.type === "ORDER_PLACED" ||
        event.status === "PENDING_CONFIRMATION" ||
        event.status === "SUBMITTED" ||
        event.status === "DRAFT"
      ) {
        return;
      }
      // If confirmed specifically for Kitchen only or no beverage items, barista ignores
      if (
        event.type === "ORDER_CONFIRMED" &&
        (event.metadata?.stationTarget === "KITCHEN" || event.metadata?.hasBeverageItems === false)
      ) {
        return;
      }

      // 1. Direct Instant Ingestion (0ms) if full ticket payload is attached from Cashier confirmation
      if (event.type === "ORDER_CONFIRMED") {
        interface RawItem {
          id?: string;
          name: string;
          qty?: number;
          itemStatus?: string;
          isBeverage?: boolean;
        }
        interface RawTicket {
          id?: string;
          orderNo?: number;
          tableLabel?: string;
          tableId?: string;
          status?: string;
          submittedAt?: string;
          acceptedAt?: string;
          instructions?: string | null;
          items?: RawItem[];
        }
        const ticketData = event.metadata?.ticket as RawTicket | undefined;
        if (ticketData && Array.isArray(ticketData.items)) {
          const drinkItems = ticketData.items.filter((it) => isBeverageItem(it.name) || it.isBeverage);
          if (drinkItems.length > 0) {
            const newTicket: BaristaTicket = {
              id: ticketData.id || event.orderId!,
              orderNo: ticketData.orderNo || event.orderNo || 0,
              tableLabel: ticketData.tableLabel || event.tableLabel || "01",
              tableId: ticketData.tableId || "table-01",
              status: "ACCEPTED",
              submittedAt: ticketData.submittedAt || new Date().toISOString(),
              acceptedAt: ticketData.acceptedAt || new Date().toISOString(),
              readyAt: null,
              instructions: ticketData.instructions || null,
              items: drinkItems.map((d) => ({
                id: d.id || crypto.randomUUID(),
                name: d.name,
                qty: d.qty || 1,
                itemStatus: (d.itemStatus as BaristaOrderItem["itemStatus"]) || "PENDING",
                isBeverage: true,
              })),
            };
            optimisticLocksRef.current.set(newTicket.id, { status: "ACCEPTED", timestamp: Date.now() });
            setOrders((prev) => {
              if (prev.some((o) => o.id === newTicket.id)) {
                return prev.map((o) => (o.id === newTicket.id ? { ...o, status: "ACCEPTED" } : o));
              }
              return [newTicket, ...prev];
            });
            playChime(newTicket.id);
            debouncedRefresh();
            return;
          } else {
            // Drink items count is 0 -> order belongs exclusively to Kitchen
            return;
          }
        }
      }

      if (event.orderId) {
        handleIncomingTicket(event.orderId, event.status as OrderStatus);
      }
      debouncedRefresh();
    });

    // 2. Tab Visibility & Focus Listeners (Instant refresh on tab switch)
    const handleActive = () => {
      if (document.visibilityState === "visible" || document.hasFocus()) {
        refreshOrders();
      }
    };
    window.addEventListener("focus", handleActive);
    document.addEventListener("visibilitychange", handleActive);

    return () => {
      pollActive = false;
      if (pollTimer) clearTimeout(pollTimer);
      if (syncRefreshTimerRef.current) clearTimeout(syncRefreshTimerRef.current);
      unsubscribe();
      window.removeEventListener("focus", handleActive);
      document.removeEventListener("visibilitychange", handleActive);
    };
  }, [handleIncomingTicket, refreshOrders, debouncedRefresh, playChime]);

  const handleTransition = async (
    orderId: string,
    fromStatus: OrderStatus,
    toStatus: OrderStatus
  ) => {
    optimisticLocksRef.current.set(orderId, { status: toStatus, timestamp: Date.now() });

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: toStatus } : o))
    );

    const result = await transitionBaristaOrderStatusAction(orderId, fromStatus, toStatus);
    if (result.success) {
      broadcastSyncEvent({
        type: "BARISTA_TICKET_CHANGED",
        orderId,
        status: toStatus,
        timestamp: Date.now(),
      });
      broadcastSyncEvent({
        type: "STATUS_CHANGED",
        orderId,
        status: toStatus,
        timestamp: Date.now(),
      });
    } else {
      optimisticLocksRef.current.delete(orderId);
      refreshOrders();
    }
  };

  const filteredOrders = useMemo(() => {
    let list = orders.filter((o) => !dismissedTicketIds.has(o.id));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (o) =>
          o.tableLabel.toLowerCase().includes(q) ||
          o.orderNo.toString().includes(q) ||
          o.items.some((i) => i.name.toLowerCase().includes(q))
      );
    }

    if (categoryFilter !== "ALL") {
      list = list.filter((o) => {
        return o.items.some((item) => {
          const name = item.name.toLowerCase();
          if (categoryFilter === "ESPRESSO") {
            return (
              name.includes("espresso") ||
              name.includes("latte") ||
              name.includes("cappuccino") ||
              name.includes("americano") ||
              name.includes("cortado") ||
              name.includes("flat white")
            );
          }
          if (categoryFilter === "COLD") {
            return (
              name.includes("cold brew") ||
              name.includes("iced") ||
              name.includes("tonic") ||
              name.includes("frappe")
            );
          }
          if (categoryFilter === "SHAKES") {
            return name.includes("shake") || name.includes("tea") || name.includes("chai") || name.includes("smoothie");
          }
          return true;
        });
      });
    }

    return list;
  }, [orders, dismissedTicketIds, searchQuery, categoryFilter]);

  const newOrders = filteredOrders.filter((o) =>
    ["SUBMITTED", "PENDING_CONFIRMATION", "CONFIRMED", "ACCEPTED"].includes(o.status)
  );
  const brewingOrders = filteredOrders.filter((o) => o.status === "PREPARING");
  const readyOrders = filteredOrders.filter((o) => o.status === "READY");
  const completedOrders = filteredOrders.filter((o) =>
    ["SERVED", "COMPLETED", "CLOSED"].includes(o.status)
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#F3E7D3] dark:bg-[#181412] text-[#241F1C] dark:text-[#FAF4EB] font-sans transition-colors duration-200">
      {/* Top Barista Header */}
      <header className="sticky top-0 z-30 border-b border-[#C9AE8B]/40 dark:border-white/10 bg-[#FAF4EB]/95 dark:bg-[#1D1815]/95 px-3 sm:px-6 py-2.5 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-4">
          {/* Brand & Station Indicator with Custom Barista Logos */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="relative h-10 w-7 sm:h-11 sm:w-8 shrink-0 select-none">
              <Image
                src="/barista-logo.png"
                alt="smol café barista logo"
                fill
                priority
                className="object-contain drop-shadow-xs dark:hidden block"
              />
              <Image
                src="/barista-logo-dark.png"
                alt="smol café barista logo dark"
                fill
                priority
                className="object-contain drop-shadow-[0_0_10px_rgba(168,85,247,0.5)] hidden dark:block"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-serif text-lg sm:text-xl font-bold tracking-tight text-[#241F1C] dark:text-[#FAF4EB]">
                  smol café
                </span>
                <span className="text-[10px] text-[#F2C84B]">✦</span>
                <span className="rounded-md border border-[#C9AE8B]/40 dark:border-white/10 bg-[#F3E7D3] dark:bg-white/5 px-2 py-0.5 font-mono text-[10.5px] font-bold text-[#B72E35] dark:text-[#FF6B6B]">
                  barista desk
                </span>
              </div>
              <p className="font-mono text-[10px] text-[#725039] dark:text-[#C9AE8B] -mt-0.5 hidden sm:block">
                single-origin espresso &amp; artisanal pour overs
              </p>
            </div>
          </div>


          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {dismissedTicketIds.size > 0 && (
              <button
                onClick={handleRestoreDismissed}
                className="flex items-center gap-1 rounded-full border border-[#C9AE8B]/60 dark:border-stone-700 bg-[#FAF4EB] dark:bg-[#1D1815] px-2.5 py-1 text-xs font-mono text-[#725039] dark:text-[#C9AE8B] hover:text-[#B72E35] transition cursor-pointer shadow-xs"
                title="Restore dismissed tickets"
              >
                <RotateCcw className="h-3 w-3" />
                <span className="hidden sm:inline">restore ({dismissedTicketIds.size})</span>
              </button>
            )}

            {/* Sound Toggle */}
            <button
              onClick={() => {
                setSoundEnabled((v) => {
                  const next = !v;
                  if (next) {
                    soundManager.playKitchenNewOrderAlert();
                  }
                  return next;
                });
              }}
              className={`flex items-center gap-1 rounded-full border px-2 sm:px-3 py-1 text-xs font-mono transition cursor-pointer whitespace-nowrap ${
                soundEnabled
                  ? "border-[#F2C84B]/60 bg-[#F2C84B]/20 text-[#8C6207] dark:text-[#F2C84B]"
                  : "border-[#C9AE8B]/40 dark:border-white/10 bg-[#FAF4EB] dark:bg-[#1D1815] text-[#725039] dark:text-[#C9AE8B]"
              }`}
              title={soundEnabled ? "Mute audio alerts" : "Enable audio alerts & test chime"}
            >
              {soundEnabled ? (
                <>
                  <Bell className="h-3.5 w-3.5 text-[#8C6207] dark:text-[#F2C84B] shrink-0" />
                  <span className="hidden sm:inline">chime on 🔔</span>
                </>
              ) : (
                <>
                  <BellOff className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">chime off</span>
                </>
              )}
            </button>

            {/* Refresh */}
            <button
              onClick={() => void refreshOrders(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#C9AE8B]/40 dark:border-white/10 bg-[#FAF4EB] dark:bg-[#1D1815] text-[#725039] dark:text-[#C9AE8B] hover:text-[#241F1C] transition cursor-pointer"
              title="Refresh tickets"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>

            <ThemeToggle />

            {/* Logout */}
            <button
              onClick={async () => {
                await staffLogoutAction();
                window.location.href = "/smol-backdoor";
              }}
              className="flex h-8 sm:h-auto items-center justify-center gap-1 rounded-full border border-[#C9AE8B]/40 dark:border-white/10 bg-[#FAF4EB] dark:bg-[#1D1815] sm:px-3 sm:py-1 text-xs font-mono text-[#725039] dark:text-[#C9AE8B] hover:text-[#B72E35] transition cursor-pointer"
              title="Staff logout"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Barista Toolbar: Shot Timer + Beverage Filters */}
      <div className="p-3 sm:p-4 w-full space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Extraction Shot Timer Widget */}
          <div className="w-full lg:w-80 shrink-0">
            <EspressoShotTimer />
          </div>

          {/* Beverage Category Filters & Search */}
          <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 bg-[#FAF4EB] dark:bg-[#1D1815] p-1 rounded-2xl border border-[#C9AE8B]/40 dark:border-white/10 overflow-x-auto no-scrollbar shrink-0">
              {(
                [
                  { key: "ALL", label: "All Brews" },
                  { key: "ESPRESSO", label: "☕ Espresso" },
                  { key: "COLD", label: "🧊 Cold / Iced" },
                  { key: "SHAKES", label: "🥤 Shakes & Tea" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setCategoryFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    categoryFilter === tab.key
                      ? "bg-[#B72E35] text-white shadow-xs"
                      : "text-[#725039] dark:text-[#C9AE8B] hover:bg-[#F3E7D3] dark:hover:bg-white/5"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search table or drink..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#C9AE8B]/40 dark:border-white/10 bg-[#FAF4EB] dark:bg-[#1D1815] text-xs font-mono text-[#241F1C] dark:text-white placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#B72E35]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Barista 4 Kanban Columns: Fluid Responsive Across Phone, Tablet, Laptop, and Ultrawide Screens */}
      <main className="flex-1 px-3 sm:px-4 pb-6 w-full min-w-0">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-4 w-full">
          {/* Column 1: NEW BREW TICKETS */}
          <div className="flex flex-col rounded-3xl border border-[#C9AE8B]/40 dark:border-white/10 bg-[#FAF4EB] dark:bg-[#1A1715] p-3.5 sm:p-4 shadow-sm min-h-[360px] max-h-[calc(100vh-210px)]">
            <div className="mb-3 flex items-center justify-between border-b border-[#C9AE8B]/30 dark:border-white/10 pb-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#B72E35]" />
                <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#241F1C] dark:text-[#FAF4EB]">
                  new orders
                </h2>
              </div>
              <span className="rounded-full bg-[#F3E7D3] dark:bg-white/10 border border-[#C9AE8B]/40 dark:border-white/10 px-2.5 py-0.5 font-mono text-xs font-bold text-[#B72E35] dark:text-[#FF6B6B]">
                {newOrders.length}
              </span>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {newOrders.length === 0 ? (
                <p className="py-14 text-center font-serif italic text-xs text-[#725039]/60 dark:text-stone-600">
                  no new coffee tickets in queue
                </p>
              ) : (
                newOrders.map((ticket) => (
                  <BaristaTicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onTransition={handleTransition}
                    onDismiss={handleDismissTicket}
                  />
                ))
              )}
            </div>
          </div>

          {/* Column 2: GRINDING & BREWING */}
          <div className="flex flex-col rounded-3xl border border-[#C9AE8B]/40 dark:border-white/10 bg-[#FAF4EB] dark:bg-[#1A1715] p-3.5 sm:p-4 shadow-sm min-h-[360px] max-h-[calc(100vh-210px)]">
            <div className="mb-3 flex items-center justify-between border-b border-[#C9AE8B]/30 dark:border-white/10 pb-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#F2C84B] animate-pulse" />
                <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#241F1C] dark:text-[#FAF4EB]">
                  grinding &amp; brewing
                </h2>
              </div>
              <span className="rounded-full bg-[#F3E7D3] dark:bg-white/10 border border-[#C9AE8B]/40 dark:border-white/10 px-2.5 py-0.5 font-mono text-xs font-bold text-[#8C6207] dark:text-[#F2C84B]">
                {brewingOrders.length}
              </span>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {brewingOrders.length === 0 ? (
                <p className="py-14 text-center font-serif italic text-xs text-[#725039]/60 dark:text-stone-600">
                  no drinks actively brewing
                </p>
              ) : (
                brewingOrders.map((ticket) => (
                  <BaristaTicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onTransition={handleTransition}
                    onDismiss={handleDismissTicket}
                  />
                ))
              )}
            </div>
          </div>

          {/* Column 3: READY AT BAR */}
          <div className="flex flex-col rounded-3xl border border-[#C9AE8B]/40 dark:border-white/10 bg-[#FAF4EB] dark:bg-[#1A1715] p-3.5 sm:p-4 shadow-sm min-h-[360px] max-h-[calc(100vh-210px)]">
            <div className="mb-3 flex items-center justify-between border-b border-[#C9AE8B]/30 dark:border-white/10 pb-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#75AFA7]" />
                <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#241F1C] dark:text-[#FAF4EB]">
                  ready at bar
                </h2>
              </div>
              <span className="rounded-full bg-[#F3E7D3] dark:bg-white/10 border border-[#C9AE8B]/40 dark:border-white/10 px-2.5 py-0.5 font-mono text-xs font-bold text-[#245850] dark:text-[#75AFA7]">
                {readyOrders.length}
              </span>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {readyOrders.length === 0 ? (
                <p className="py-14 text-center font-serif italic text-xs text-[#725039]/60 dark:text-stone-600">
                  no beverages awaiting server pickup
                </p>
              ) : (
                readyOrders.map((ticket) => (
                  <BaristaTicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onTransition={handleTransition}
                    onDismiss={handleDismissTicket}
                  />
                ))
              )}
            </div>
          </div>

          {/* Column 4: DELIVERED / COMPLETED */}
          <div className="flex flex-col rounded-3xl border border-[#C9AE8B]/40 dark:border-white/10 bg-[#FAF4EB] dark:bg-[#1A1715] p-3.5 sm:p-4 shadow-sm min-h-[360px] max-h-[calc(100vh-210px)]">
            <div className="mb-3 flex items-center justify-between border-b border-[#C9AE8B]/30 dark:border-white/10 pb-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-stone-400" />
                <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#725039] dark:text-[#C9AE8B]">
                  delivered
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                {completedOrders.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllCompleted}
                    className="flex items-center gap-1 rounded-full border border-[#C9AE8B]/60 dark:border-white/10 bg-[#F3E7D3] dark:bg-white/5 px-2 py-0.5 font-mono text-[10px] font-bold text-[#725039] dark:text-[#C9AE8B] hover:text-[#B72E35] transition cursor-pointer"
                    title="Clear delivered tickets"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                    <span>Clear</span>
                  </button>
                )}
                <span className="rounded-full bg-[#F3E7D3] dark:bg-white/10 border border-[#C9AE8B]/40 dark:border-white/10 px-2.5 py-0.5 font-mono text-xs font-bold text-[#725039] dark:text-[#C9AE8B]">
                  {completedOrders.length}
                </span>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {completedOrders.length === 0 ? (
                <p className="py-14 text-center font-serif italic text-xs text-[#725039]/60 dark:text-stone-600">
                  delivered coffee orders appear here
                </p>
              ) : (
                completedOrders.map((ticket) => (
                  <BaristaTicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onTransition={handleTransition}
                    onDismiss={handleDismissTicket}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
