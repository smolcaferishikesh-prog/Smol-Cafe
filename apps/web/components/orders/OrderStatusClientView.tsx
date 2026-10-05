"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { fetchActiveOrdersAction, type CustomerOrderDetails } from "@/app/orders/actions";
import type { OrderStatus } from "@smol-cafe/db";
import { OrderCard } from "./OrderCard";
import { ConversationDeckModal } from "./ConversationDeckModal";
import { Bell, BellRing, CheckCircle2, Sparkles, Receipt, ExternalLink } from "lucide-react";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";
import { subscribeToSyncEvents } from "@/lib/sync-events";
import { createTableJsonTag } from "@/lib/table-tag";
import { JsonTagInspectorModal } from "@/components/table/JsonTagInspectorModal";
import { UpiPaymentDrawer } from "@/components/payment/UpiPaymentDrawer";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { PastBillsModal } from "./PastBillsModal";
import { soundManager } from "@/lib/sound";

interface OrderStatusClientViewProps {
  initialOrders: CustomerOrderDetails[];
  tableLabel?: string;
  locationName?: string;
  hasSession: boolean;
  guestName?: string;
}

export const OrderStatusClientView: React.FC<OrderStatusClientViewProps> = ({
  initialOrders,
  tableLabel = "01",
  locationName = "Rishikesh",
  hasSession,
  guestName = "",
}) => {
  const [orders, setOrders] = useState<CustomerOrderDetails[]>(initialOrders);
  const ordersRef = useRef<CustomerOrderDetails[]>(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);
  const [currentGuestName, setCurrentGuestName] = useState(guestName);
  const [isDeckOpen, setIsDeckOpen] = useState(false);
  const [isJsonInspectorOpen, setIsJsonInspectorOpen] = useState(false);
  const [isUpiDrawerOpen, setIsUpiDrawerOpen] = useState(false);
  const [isPastBillsOpen, setIsPastBillsOpen] = useState(false);
  const [isNotifyEnabled, setIsNotifyEnabled] = useState(false);
  const [showNotifyToast, setShowNotifyToast] = useState(false);

  // Status tracker for audible chime on READY / COMPLETED transition
  const prevStatusesRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("smol_guest_name");
      if (saved && !currentGuestName) {
        setCurrentGuestName(saved);
      }
      const savedNotify = localStorage.getItem("smol_notify_order_enabled");
      if (savedNotify === "true") {
        setIsNotifyEnabled(true);
      }
    }
  }, [currentGuestName]);

  const displayTable = (tableLabel || "01").replace(/^(table|t)[-\s_]*/i, "").trim().padStart(2, "0");
  const tableJsonTag = createTableJsonTag(displayTable);

  const isRefreshingRef = useRef(false);

  const refreshOrders = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    try {
      let clientPhone: string | undefined = undefined;
      if (typeof window !== "undefined") {
        clientPhone = localStorage.getItem("smol_guest_phone") || undefined;
      }
      const res = await fetchActiveOrdersAction(clientPhone);
      if (res.success) {
        // Detect if any order transitioned to READY or COMPLETED
        res.orders.forEach((ord) => {
          const prevStatus = prevStatusesRef.current[ord.id];
          if (prevStatus && prevStatus !== ord.status && (ord.status === "READY" || ord.status === "COMPLETED" || ord.status === "SERVED")) {
            soundManager.playOrderReadyChime();

            // Native browser push notification if enabled
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
              try {
                new Notification(`Order #${ord.orderNo || ord.id.slice(-4)} is Ready! ☕`, {
                  body: `Your order at Table ${tableLabel || "01"} is hot & ready to serve.`,
                  icon: "/google-maps-icon.png",
                });
              } catch {
                // Ignore notification constructor errors
              }
            }
          }
          prevStatusesRef.current[ord.id] = ord.status;
        });

        setOrders(res.orders);
        if (res.guestName && !currentGuestName) {
          setCurrentGuestName(res.guestName);
        }
      }
    } catch (err) {
      console.error("Failed to refresh active orders:", err);
    } finally {
      isRefreshingRef.current = false;
    }
  }, [tableLabel, currentGuestName]);

  // 1. Cross-Interface & Cross-Port Supabase Broadcast Subscription with 0ms Instant State Mutation
  useEffect(() => {
    const unsub = subscribeToSyncEvents((event) => {
      if (event.orderId && event.status) {
        const newStatus = event.status as OrderStatus;
        const prevStatus = prevStatusesRef.current[event.orderId];
        if (prevStatus && prevStatus !== newStatus && (newStatus === "READY" || newStatus === "COMPLETED" || newStatus === "SERVED")) {
          soundManager.playOrderReadyChime();
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
              new Notification(`Order is Ready! ☕`, {
                body: `Your order at Table ${tableLabel || "01"} is hot & ready to serve.`,
                icon: "/google-maps-icon.png",
              });
            } catch {
              // ignore
            }
          }
        }
        prevStatusesRef.current[event.orderId] = newStatus;
        const exists = ordersRef.current.some((o) => o.id === event.orderId);
        if (!exists) {
          void refreshOrders();
        } else {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === event.orderId ? { ...o, status: newStatus } : o
            )
          );
        }
      } else {
        void refreshOrders();
      }
    });
    return () => unsub();
  }, [refreshOrders, tableLabel]);

  // 2. Supabase Realtime WebSocket subscription for Customer Order Status Updates
  useSupabaseRealtime({
    table: "orders",
    onData: (payload: { new?: { id?: string; status?: string; order_no?: number } | null }) => {
      const newRow = payload?.new;
      if (newRow && newRow.id && newRow.status) {
        const newStatus = newRow.status as OrderStatus;
        const prevStatus = prevStatusesRef.current[newRow.id];
        if (prevStatus && prevStatus !== newStatus && (newStatus === "READY" || newStatus === "COMPLETED" || newStatus === "SERVED")) {
          soundManager.playOrderReadyChime();
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
              new Notification(`Order #${newRow.order_no || newRow.id.slice(-4)} is Ready! ☕`, {
                body: `Your order at Table ${tableLabel || "01"} is hot & ready to serve.`,
                icon: "/google-maps-icon.png",
              });
            } catch {
              // ignore
            }
          }
        }
        prevStatusesRef.current[newRow.id] = newStatus;
        const exists = ordersRef.current.some((o) => o.id === newRow.id);
        if (!exists) {
          void refreshOrders();
        } else {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === newRow.id ? { ...o, status: newStatus } : o
            )
          );
        }
      } else {
        void refreshOrders();
      }
    },
    enabled: true,
  });

  // 3. Window Focus & Fallback Polling Timer with non-overlapping execution
  useEffect(() => {
    let isMounted = true;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const schedulePoll = () => {
      if (!isMounted) return;
      const interval = typeof document !== "undefined" && document.visibilityState === "visible" ? 1500 : 8000;
      pollTimer = setTimeout(async () => {
        if (!isMounted) return;
        await refreshOrders();
        schedulePoll();
      }, interval);
    };

    const handleFocus = () => {
      if (isMounted) void refreshOrders();
    };

    const handleVisibility = () => {
      if (isMounted && document.visibilityState === "visible") {
        void refreshOrders();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    // Initial trigger and start schedule
    void refreshOrders();
    schedulePoll();

    return () => {
      isMounted = false;
      if (pollTimer) clearTimeout(pollTimer);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refreshOrders]);

  if (!hasSession) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FDFBF7] px-6 py-12 text-center text-[#1C1917] dark:bg-[#141211] dark:text-[#FDFBF7]">
        <div className="w-full max-w-md rounded-3xl border border-stone-200/80 bg-white/80 p-8 shadow-xl dark:border-stone-800 dark:bg-stone-900/80">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-3xl">
            🪑
          </div>
          <h2 className="text-2xl font-bold tracking-tight">No Active Table Session</h2>
          <p className="mt-2 text-xs text-stone-600 dark:text-stone-400">
            Please scan the QR code on your table stand or tap a table below to view live orders:
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2 max-h-40 overflow-y-auto">
            {Array.from({ length: 13 }, (_, i) => (i + 1).toString().padStart(2, "0")).map((label) => {
              return (
                <a
                  key={label}
                  href={`/t/table-${label}`}
                  className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 shadow-xs hover:bg-amber-100 dark:border-amber-700 dark:bg-stone-800 dark:text-amber-200"
                >
                  Table {label}
                </a>
              );
            })}
          </div>
          <div className="mt-5">
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center rounded-xl bg-stone-900 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const latestOrder = orders[0];
  const hasOrders = orders.length > 0;

  const orderNumberStr = latestOrder
    ? `#SMOL ${latestOrder.orderNo.toString().padStart(4, "0")}`
    : "NO ACTIVE ORDER";

  const firstItemName = latestOrder?.items[0]?.name || (hasOrders ? "Order" : "Artisanal Coffee");

  // Dynamic Headline, Subtitle, and ETA based on actual order status
  let heroHeadline = `Brewing Your ${firstItemName}`;
  let heroSubtitle = "single-origin South Indian estate beans";
  let heroEta = "⏱ 8-10 mins";

  if (latestOrder) {
    if (latestOrder.status === "SERVED" || latestOrder.status === "COMPLETED") {
      heroHeadline = `${firstItemName} Served!`;
      heroSubtitle = "Delivered to your table. Hope you enjoyed it!";
      heroEta = "✓ Delivered";
    } else if (latestOrder.status === "READY") {
      heroHeadline = `${firstItemName} is Ready!`;
      heroSubtitle = "Piping hot! Your server is bringing it over, or collect at brew bar.";
      heroEta = "🔔 Ready Now";
    } else if (latestOrder.status === "PREPARING") {
      heroHeadline = `Crafting Your ${firstItemName}`;
      heroSubtitle = "Coffee is brewing and food is freshly on the kitchen grill.";
      heroEta = latestOrder.etaMinMinutes
        ? `⏱ ${latestOrder.etaMinMinutes}-${latestOrder.etaMaxMinutes || 10} mins`
        : "⏱ 5-8 mins";
    } else {
      heroHeadline = `Order Received: ${firstItemName}`;
      heroSubtitle = "Logged into café kitchen queue. Chef notified.";
      heroEta = "⏱ 8-12 mins";
    }
  } else {
    heroHeadline = "No Active Orders Placed";
    heroSubtitle = "Select your favourite brews & bakes from our menu.";
    heroEta = "—";
  }

  return (
    <div className="min-h-screen bg-[#F3E7D3] dark:bg-[#151110] text-[#241F1C] dark:text-[#FAF4EB] pb-28 font-serif transition-colors duration-200">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-[#C9AE8B]/40 dark:border-white/10 bg-[#F3E7D3]/95 dark:bg-[#181412]/95 px-4 py-3.5 backdrop-blur-md transition-colors duration-200">
        <div className="mx-auto flex max-w-md items-start justify-between gap-2.5">
          <div className="flex items-start gap-2 min-w-0">
            {/* Back Button */}
            <Link
              href="/smol-menu"
              aria-label="Back to menu"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#241F1C] dark:text-[#FAF4EB] transition hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 cursor-pointer -ml-1 mt-0.5"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </Link>

            <div className="min-w-0">
              <span className="block font-mono text-[10px] font-bold uppercase tracking-widest text-[#B72E35] dark:text-[#FF5B52]">
                4. ORDER STATUS
              </span>
              <h1 className="font-serif text-2xl font-bold tracking-tight text-[#241F1C] dark:text-[#FAF4EB] lowercase truncate">
                {currentGuestName ? `${currentGuestName}'s order` : "your order"}
              </h1>
              <p className="font-serif italic text-xs text-[#725039] dark:text-[#C9AE8B] truncate">
                Table {displayTable}{currentGuestName ? ` • Guest: ${currentGuestName}` : ""} • {locationName.toLowerCase()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 pt-1 shrink-0">
            {orders.length > 0 && (
              <button
                type="button"
                onClick={() => setIsPastBillsOpen(true)}
                className="inline-flex items-center gap-1 rounded-full bg-[#FAF4EB] dark:bg-white/10 border border-[#C9AE8B]/40 px-2.5 py-1 text-[10px] font-mono font-bold text-[#725039] dark:text-[#C9AE8B] hover:bg-[#EDE1D2] transition shadow-xs cursor-pointer"
                title="View All Bills & Invoices"
              >
                <Receipt className="h-3 w-3 text-[#B72E35] dark:text-[#FF6B6B]" />
                <span>Bills</span>
              </button>
            )}

            <span className="inline-flex items-center gap-1 rounded-full bg-[#75AFA7]/25 dark:bg-[#75AFA7]/20 border border-[#75AFA7]/40 px-2.5 py-1 text-[10px] font-mono font-bold tracking-wider text-[#1C463F] dark:text-[#75C7BC] shadow-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1C463F] dark:bg-[#75C7BC] animate-pulse" />
              LIVE
            </span>
            <ThemeToggle variant="icon" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-md px-4 pt-4 space-y-5">
        {/* Arched Hero Status Card (Ultra-Frosted Glassmorphism) */}
        <div className="relative overflow-hidden rounded-t-[5.5rem] rounded-b-3xl border border-white/80 dark:border-white/15 bg-white/60 dark:bg-[#1A1412]/80 backdrop-blur-[24px] backdrop-saturate-[180%] p-6 text-center text-[#241F1C] dark:text-white shadow-[0_20px_45px_rgba(74,46,27,0.09),0_4px_12px_rgba(0,0,0,0.03),inset_0_1.5px_1.5px_rgba(255,255,255,0.95)] dark:shadow-[0_24px_55px_rgba(0,0,0,0.7),inset_0_1.5px_1px_rgba(255,255,255,0.15)] animate-scale-in transition-all duration-300">
          {/* Top Arch Luminous Accent Line */}
          <div className="absolute top-0 inset-x-10 h-[2.5px] bg-gradient-to-r from-transparent via-[#B72E35] dark:via-purple-400 to-transparent opacity-85" />

          {/* Top Atmospheric Radial Halo */}
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-56 h-28 bg-gradient-to-b from-[#B72E35]/25 via-amber-500/10 to-transparent dark:from-purple-600/35 dark:via-purple-900/20 dark:to-transparent rounded-full blur-2xl pointer-events-none animate-pulse-glow" />

          {/* smol café Door Logo with Moving/Floating Animation & Frosted Pedestal */}
          <div className="relative mx-auto mt-1 flex flex-col items-center justify-center">
            {/* Ambient Back Glow for Logo */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-3 rounded-full bg-[#B72E35]/25 dark:bg-[#A855F7]/35 blur-xl animate-pulse-glow"
            />

            {/* Light Mode Floating Logo */}
            <div className="relative block dark:hidden animate-logo-moving-light">
              <Image
                src="/logo-transparent.png"
                alt="smol café"
                width={52}
                height={78}
                className="h-16 w-auto object-contain drop-shadow-[0_8px_18px_rgba(183,46,53,0.35)] transition-transform"
                priority
              />
            </div>

            {/* Dark Mode Floating Neon Logo */}
            <div className="relative hidden dark:block animate-logo-moving-dark">
              <Image
                src="/table-header-logo-dark-v2.png"
                alt="smol café"
                width={52}
                height={78}
                className="h-16 w-auto object-contain drop-shadow-[0_8px_20px_rgba(168,85,247,0.4)] transition-transform"
                priority
              />
            </div>

            {/* Dynamic Ground Shadow (shrinks as logo floats up) */}
            <div
              aria-hidden="true"
              className="mt-1 h-1.5 w-10 rounded-full bg-[#725039]/20 dark:bg-purple-900/40 blur-[2px] animate-logo-shadow pointer-events-none"
            />
          </div>

          {/* Headline & Subtitle */}
          <div className="mt-4 space-y-1">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#241F1C] dark:text-[#FAF4EB] tracking-tight drop-shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
              {heroHeadline}
            </h2>
            <p className="font-serif italic text-xs text-[#7A583E] dark:text-[#C9AE8B]">
              {heroSubtitle}
            </p>
          </div>

          {/* 2 Glassmorphic Metric Tiles */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            {/* Order Number Tile */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/80 dark:border-white/10 bg-white/65 dark:bg-white/[0.06] backdrop-blur-md p-3 text-center shadow-[0_4px_12px_rgba(74,46,27,0.05),inset_0_1px_1px_rgba(255,255,255,0.9)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35),inset_0_1px_1px_rgba(255,255,255,0.12)] transition-all hover:scale-[1.02]">
              <span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-[#7A583E] dark:text-[#C9AE8B]/80">
                YOUR ORDER NO.
              </span>
              <span className="block font-mono text-sm font-extrabold text-[#8C5E1A] dark:text-[#F2C84B] mt-1 tracking-wider drop-shadow-2xs">
                {orderNumberStr}
              </span>
            </div>

            {/* Ready Time Tile */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/80 dark:border-white/10 bg-white/65 dark:bg-white/[0.06] backdrop-blur-md p-3 text-center shadow-[0_4px_12px_rgba(74,46,27,0.05),inset_0_1px_1px_rgba(255,255,255,0.9)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35),inset_0_1px_1px_rgba(255,255,255,0.12)] transition-all hover:scale-[1.02]">
              <span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-[#7A583E] dark:text-[#C9AE8B]/80">
                EST. READY TIME
              </span>
              <span className="block font-mono text-sm font-extrabold text-[#B72E35] dark:text-[#C084FC] mt-1 tracking-wider drop-shadow-2xs">
                {heroEta}
              </span>
            </div>
          </div>
        </div>

        {/* Modern Interactive Order Notification Pill */}
        <div className="pt-2">
          <button
            type="button"
            onClick={async () => {
              if (!isNotifyEnabled) {
                if (typeof window !== "undefined" && "Notification" in window) {
                  try {
                    const permission = await Notification.requestPermission();
                    if (permission === "granted") {
                      try {
                        new Notification("smol café alerts active ☕", {
                          body: "We'll chime and notify you the second your order is ready!",
                          icon: "/google-maps-icon.png",
                        });
                      } catch {
                        // ignore constructor error
                      }
                    }
                  } catch (err) {
                    console.warn("Notification permission error:", err);
                  }
                }
                soundManager.playOrderPlacedChime();
                setIsNotifyEnabled(true);
                setShowNotifyToast(true);
                if (typeof window !== "undefined") {
                  localStorage.setItem("smol_notify_order_enabled", "true");
                }
                setTimeout(() => setShowNotifyToast(false), 3500);
              } else {
                setIsNotifyEnabled(false);
                if (typeof window !== "undefined") {
                  localStorage.removeItem("smol_notify_order_enabled");
                }
              }
            }}
            className={`group relative w-full overflow-hidden rounded-2xl p-3.5 transition-all duration-300 active:scale-[0.98] text-left cursor-pointer border shadow-md ${
              isNotifyEnabled
                ? "bg-gradient-to-r from-[#173824] via-[#1d472e] to-[#122e1d] border-emerald-500/40 text-emerald-50 shadow-emerald-950/20"
                : "bg-gradient-to-r from-[#B72E35] via-[#A0242B] to-[#7E161C] dark:from-[#9333EA] dark:via-[#7E22CE] dark:to-[#581C87] border-white/40 dark:border-purple-400/40 text-[#FAF4EB] shadow-[0_8px_20px_rgba(183,46,53,0.3)] dark:shadow-[0_8px_25px_rgba(126,34,206,0.45),inset_0_1.5px_1.5px_rgba(255,255,255,0.3)] hover:shadow-lg hover:shadow-[#B72E35]/35 dark:hover:shadow-purple-600/50"
            }`}
          >
            {/* Top Specular Arc Gloss Highlight */}
            <div className="absolute inset-x-3 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/50 dark:via-white/70 to-transparent pointer-events-none" />

            {/* Ambient Shimmer Light Effect */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/15 dark:via-white/25 to-transparent transition-transform duration-1000 ease-in-out pointer-events-none" />

            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Floating Icon Container with Ping Badge */}
                <div
                  className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200 ${
                    isNotifyEnabled
                      ? "bg-emerald-400/20 text-emerald-300 ring-1 ring-emerald-400/30"
                      : "bg-white/15 text-[#FAF4EB] ring-1 ring-white/20 dark:ring-purple-300/30 group-hover:bg-white/25 dark:group-hover:bg-white/20"
                  }`}
                >
                  {isNotifyEnabled ? (
                    <>
                      <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                      </span>
                      <BellRing className="h-5 w-5 text-emerald-300" />
                    </>
                  ) : (
                    <Bell className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110 text-[#FAF4EB]" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-serif font-bold text-sm tracking-wide">
                      {isNotifyEnabled ? "Order Buzz Active" : "notify me when ready"}
                    </span>
                    {isNotifyEnabled && (
                      <span className="inline-flex items-center rounded-full bg-emerald-400/20 px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-300 border border-emerald-400/30">
                        Live
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-[11px] font-sans font-normal leading-tight ${
                      isNotifyEnabled ? "text-emerald-200/80" : "text-[#F3E7D3]/90 dark:text-purple-100/90"
                    }`}
                  >
                    {isNotifyEnabled
                      ? "Instant push alert + audio chime will ring when served"
                      : "Instant audio chime & push alert when order is prepared"}
                  </p>
                </div>
              </div>

              {/* Status Pill Badge */}
              <div
                className={`shrink-0 flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-serif font-bold transition-all shadow-xs ${
                  isNotifyEnabled
                    ? "bg-emerald-400/25 text-emerald-200 border border-emerald-400/30"
                    : "bg-white/20 hover:bg-white/30 text-white border border-white/25 dark:border-purple-300/40 dark:bg-white/15 dark:hover:bg-white/25"
                }`}
              >
                {isNotifyEnabled ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                    <span>Active</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-amber-200 dark:text-purple-200" />
                    <span>Enable</span>
                  </>
                )}
              </div>
            </div>
          </button>

          {/* Quick Toast Animation */}
          {showNotifyToast && (
            <div className="mt-2 flex items-center justify-between rounded-xl bg-emerald-900/90 dark:bg-emerald-950/90 border border-emerald-500/40 px-3 py-2 text-xs text-emerald-100 shadow-md animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>We will ring a chime &amp; buzz your phone the moment your order is plated!</span>
              </div>
              <button
                type="button"
                onClick={() => setShowNotifyToast(false)}
                className="text-emerald-300 hover:text-white text-xs font-bold pl-2 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Google Maps & Cafe Review Card */}
        <div className="rounded-2xl border border-amber-300/80 dark:border-amber-900/50 bg-amber-50/90 dark:bg-amber-950/20 p-3.5 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl shadow-xs border border-amber-200/60 dark:border-amber-900/40">
                <Image
                  src="/google-maps-icon.png"
                  alt="Google Maps"
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <h4 className="font-serif font-bold text-sm text-[#241F1C] dark:text-amber-100 flex items-center gap-1.5">
                  Enjoying smol café?
                  <span className="flex text-amber-500 text-xs">★★★★★</span>
                </h4>
                <p className="text-[11px] text-[#725039] dark:text-amber-300/80 font-sans">
                  Tapovan, Rishikesh • Artisanal Coffee &amp; Slow Bakes
                </p>
              </div>
            </div>

            <a
              href="https://www.google.com/maps/place/smol+caf%C3%A9/@30.1328541,78.3205732,17z/data=!3m1!4b1!4m6!3m5!1s0x3909179f8e14f5d9:0x14fb0bd1b84078dd!8m2!3d30.1328541!4d78.3205732!16s%2Fg%2F11zytk5sgj!18m1!1e1?entry=ttu&g_ep=EgoyMDI2MDkyMS4wIKXMDSoASAFQAw%3D%3D"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#241F1C] dark:bg-amber-400 text-white dark:text-[#241F1C] px-3 py-2 text-xs font-serif font-bold shadow-xs hover:opacity-90 transition active:scale-95 shrink-0"
            >
              <span>Review</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Active Ticket Progression Cards */}
        {orders.length > 0 ? (
          <div className="pt-3 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#786F66] dark:text-[#C9AE8B]">
                Detailed Round Timeline ({orders.length} {orders.length === 1 ? "Round" : "Rounds"})
              </h4>
              <button
                type="button"
                onClick={() => setIsPastBillsOpen(true)}
                className="text-xs font-serif font-bold text-[#B72E35] dark:text-[#FF6B6B] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Receipt className="h-3 w-3" />
                <span>All Invoices</span>
              </button>
            </div>
            <div className="space-y-3">
              {orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  tableLabel={tableLabel}
                  guestName={currentGuestName}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="pt-2">
            <div className="rounded-3xl border border-dashed border-[#C9AE8B]/60 dark:border-stone-800 bg-[#FAF4EB]/60 dark:bg-stone-900/40 p-6 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-2xl">
                ☕
              </div>
              <h3 className="font-serif text-lg font-bold text-[#241F1C] dark:text-white">
                No orders placed yet
              </h3>
              <p className="font-serif italic text-xs text-[#7A583E] dark:text-[#C9AE8B] max-w-xs mx-auto">
                Ready for your coffee ritual? Browse our artisanal brews and fresh bakery treats.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                <Link
                  href="/smol-menu"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#B72E35] px-6 py-2.5 font-serif text-xs font-bold text-white shadow-md hover:bg-[#91242C] transition active:scale-95"
                >
                  <span>Browse Menu &amp; Order →</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Conversation Prompt Deck Modal */}
      <ConversationDeckModal isOpen={isDeckOpen} onClose={() => setIsDeckOpen(false)} />

      {/* JSON Table Tag Inspector Modal */}
      {isJsonInspectorOpen && (
        <JsonTagInspectorModal
          tag={tableJsonTag}
          onClose={() => setIsJsonInspectorOpen(false)}
        />
      )}

      {/* Past Bills & Invoices Modal */}
      {isPastBillsOpen && (
        <PastBillsModal
          orders={orders}
          tableLabel={tableLabel}
          guestName={currentGuestName}
          onClose={() => setIsPastBillsOpen(false)}
        />
      )}

      {/* UPI Payment Gateway Drawer */}
      {isUpiDrawerOpen && latestOrder && (
        <UpiPaymentDrawer
          orderId={latestOrder.id}
          orderNo={latestOrder.orderNo}
          tableLabel={tableLabel}
          zone={tableJsonTag.zone}
          amountPaise={latestOrder.totalPaise}
          items={latestOrder.items.map((i) => ({
            name: i.name,
            qty: i.qty,
            priceRupees: Math.round(i.unitPricePaise / 100),
            subtotalRupees: Math.round((i.unitPricePaise / 100) * i.qty),
          }))}
          onClose={() => setIsUpiDrawerOpen(false)}
          onPaymentSuccess={() => {
            setIsUpiDrawerOpen(false);
            refreshOrders();
          }}
        />
      )}
    </div>
  );
};
