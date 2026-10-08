"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import type { ActiveCashierTable } from "@/app/bill/actions";
import {
  fetchActiveCashierTablesAction,
  recordCashPaymentAction,
  openTableSessionAction,
} from "@/app/bill/actions";
import {
  fetchPendingCashierOrdersAction,
  confirmCashierOrderAction,
  rejectCashierOrderAction,
  clearAllPendingCashierOrdersAction,
  fetchPaidCashierHistoryAction,
  fetchReadyForDeliveryOrdersAction,
  markOrderDeliveredAction,
  type PendingOrderVerification,
  type PaidHistoryRecord,
  type DeliveryOrder,
} from "@/app/cashier/actions";
import {
  Bell,
  Armchair,
  Sparkles,
  Check,
  Receipt,
  CreditCard,
  Tag,
  Printer,
  RefreshCw,
  Edit3,
  Coffee,
  UtensilsCrossed,
  Layers,
  Trash2,
  Smartphone,
  Banknote,
  X,
  Gift,
  LogOut,
  Clock,
  Loader2,
  Truck,
  Phone,
  UserCheck,
  CheckCircle2,
} from "lucide-react";
import { staffBackdoorLogoutAction } from "@/app/smol-backdoor/actions";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";
import { broadcastSyncEvent, subscribeToSyncEvents } from "@/lib/sync-events";
import { createTableJsonTag, type TableJsonTag } from "@/lib/table-tag";
import { JsonTagInspectorModal } from "@/components/table/JsonTagInspectorModal";
import { UpiPaymentDrawer } from "@/components/payment/UpiPaymentDrawer";
import { DigitalReceiptModal, type ReceiptData } from "@/components/payment/DigitalReceiptModal";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { soundManager } from "@/lib/sound";
import { CashierOrderEditorModal } from "./CashierOrderEditorModal";

interface CashierDashboardProps {
  initialTables: ActiveCashierTable[];
  initialPendingOrders?: PendingOrderVerification[];
  initialDeliveryOrders?: DeliveryOrder[];
  initialPaidHistory?: PaidHistoryRecord[];
}

export const CashierDashboard: React.FC<CashierDashboardProps> = ({
  initialTables,
  initialPendingOrders = [],
  initialDeliveryOrders = [],
  initialPaidHistory = [],
}) => {
  const [activeTab, setActiveTab] = useState<"queue" | "delivery" | "paid">("queue");
  const [tables, setTables] = useState<ActiveCashierTable[]>(initialTables);
  const [pendingOrders, setPendingOrders] = useState<PendingOrderVerification[]>(initialPendingOrders);
  const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrder[]>(initialDeliveryOrders);
  const [deliveringOrderIds, setDeliveringOrderIds] = useState<Set<string>>(new Set());
  const [paidHistory, setPaidHistory] = useState<PaidHistoryRecord[]>(initialPaidHistory);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const playedChimeOrderIdsRef = useRef<Set<string>>(
    new Set(initialPendingOrders.map((o) => o.id))
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);
  const [selectedTable, setSelectedTable] = useState<ActiveCashierTable | null>(null);
  const [inspectingTag, setInspectingTag] = useState<TableJsonTag | null>(null);
  const [activeUpiTable, setActiveUpiTable] = useState<ActiveCashierTable | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null);
  const [editingOrder, setEditingOrder] = useState<PendingOrderVerification | null>(null);
  const [paymentPromptOrder, setPaymentPromptOrder] = useState<{
    order: PendingOrderVerification;
    stationTarget: "KITCHEN" | "BARISTA" | "ALL";
    selectedMethod: "UPI" | "CASH" | "CARD" | "COMPLIMENTARY";
  } | null>(null);
  const [amountTendered, setAmountTendered] = useState("");
  const [staffName, setStaffName] = useState("Cashier");
  const [submittingOrderIds, setSubmittingOrderIds] = useState<Set<string>>(new Set());
  const submittingOrderIdsRef = useRef<Set<string>>(new Set());
  const confirmedOrderIdsRef = useRef<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [resultMessage, setResultMessage] = useState<{
    type: "success" | "error";
    text: string;
    changeRupees?: number;
  } | null>(null);

  const isRefreshingRef = useRef(false);

  const refreshData = useCallback(async (isBackground = false) => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    if (!isBackground) {
      setIsRefreshing(true);
    }
    try {
      const [tableData, pendingData, deliveryData, paidData] = await Promise.all([
        fetchActiveCashierTablesAction(),
        fetchPendingCashierOrdersAction(),
        fetchReadyForDeliveryOrdersAction(),
        fetchPaidCashierHistoryAction(),
      ]);
      setTables(tableData);
      if (pendingData.success) {
        const filteredPending = pendingData.orders.filter(
          (o) =>
            !submittingOrderIdsRef.current.has(o.id) &&
            !confirmedOrderIdsRef.current.has(o.id)
        );

        // Check if any incoming order hasn't played audio chime yet
        const hasNewOrder = filteredPending.some(
          (o) => !playedChimeOrderIdsRef.current.has(o.id)
        );
        if (hasNewOrder) {
          soundManager.playCashierIncomingOrderAlert();
        }
        filteredPending.forEach((o) => playedChimeOrderIdsRef.current.add(o.id));

        setPendingOrders(filteredPending);
      }
      if (deliveryData.success) {
        setDeliveryOrders(deliveryData.orders);
      }
      if (paidData.success) {
        setPaidHistory(paidData.records);
      }
    } catch (err) {
      console.error("Failed to refresh cashier data:", err);
    } finally {
      isRefreshingRef.current = false;
      if (!isBackground) {
        setIsRefreshing(false);
      }
    }
  }, []);

  // Instant refresh for realtime updates without artificial delays
  const instantRefresh = useCallback(() => {
    void refreshData(true);
  }, [refreshData]);

  // Supabase Real-time subscriptions for cross-device live updates
  useSupabaseRealtime({
    table: "orders",
    onData: (payload: { new?: { id?: string; status?: string } | null }) => {
      const newRow = payload?.new;
      if (newRow && newRow.id) {
        if (
          newRow.status === "ACCEPTED" ||
          newRow.status === "PREPARING" ||
          newRow.status === "READY" ||
          newRow.status === "SERVED" ||
          newRow.status === "COMPLETED" ||
          newRow.status === "CANCELLED" ||
          newRow.status === "REJECTED"
        ) {
          setPendingOrders((prev) => prev.filter((o) => o.id !== newRow.id));
        } else {
          if (newRow.status === "PENDING_CONFIRMATION") {
            if (!playedChimeOrderIdsRef.current.has(newRow.id)) {
              playedChimeOrderIdsRef.current.add(newRow.id);
              soundManager.playCashierIncomingOrderAlert();
            }
          }
          void refreshData(true);
        }
      } else {
        void refreshData(true);
      }
    },
  });
  useSupabaseRealtime({ table: "table_sessions", onData: () => instantRefresh() });
  useSupabaseRealtime({ table: "bills", onData: () => instantRefresh() });

  const handleOpenTableForGuest = async (label: string) => {
    await openTableSessionAction(label);
    void refreshData(true);
  };

  // Poll pending orders and tables + real-time event listener + window focus revalidation
  useEffect(() => {
    let isMounted = true;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const schedulePoll = () => {
      if (!isMounted) return;
      const interval = typeof document !== "undefined" && document.visibilityState === "visible" ? 1500 : 8000;
      pollTimer = setTimeout(async () => {
        if (!isMounted) return;
        await refreshData(true);
        schedulePoll();
      }, interval);
    };

    const handleFocus = () => {
      if (isMounted) void refreshData(true);
    };

    const handleVisibility = () => {
      if (isMounted && document.visibilityState === "visible") {
        void refreshData(true);
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    // Initial load and start scheduling
    void refreshData(false);
    schedulePoll();

    const unsubscribe = subscribeToSyncEvents((event) => {
      if (!isMounted) return;
      if (event.type === "ORDER_PENDING_CASHIER" || event.status === "PENDING_CONFIRMATION") {
        if (event.orderId && !playedChimeOrderIdsRef.current.has(event.orderId)) {
          playedChimeOrderIdsRef.current.add(event.orderId);
          soundManager.playCashierIncomingOrderAlert();
        }
        void refreshData(true);
        return;
      }

      if (event.orderId && event.status && ["ACCEPTED", "PREPARING", "READY", "SERVED", "COMPLETED", "CANCELLED"].includes(event.status)) {
        setPendingOrders((prev) => prev.filter((o) => o.id !== event.orderId));
      } else {
        void refreshData(true);
      }
    });

    return () => {
      isMounted = false;
      if (pollTimer) clearTimeout(pollTimer);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      unsubscribe();
    };
  }, [refreshData]);

  const handleInitiateConfirm = (
    order: PendingOrderVerification,
    stationTarget: "KITCHEN" | "BARISTA" | "ALL" = "ALL"
  ) => {
    setPaymentPromptOrder({
      order,
      stationTarget,
      selectedMethod: "UPI",
    });
  };

  const handleConfirmOrder = async (
    orderId: string,
    stationTarget: "KITCHEN" | "BARISTA" | "ALL" = "ALL",
    paymentMethod: "UPI" | "CASH" | "CARD" | "COMPLIMENTARY" = "UPI"
  ) => {
    if (submittingOrderIdsRef.current.has(orderId)) return;

    // 1. Check whether this dispatch is partial or full
    const targetOrder = (paymentPromptOrder && paymentPromptOrder.order.id === orderId ? paymentPromptOrder.order : null) || pendingOrders.find((o) => o.id === orderId);
    setPaymentPromptOrder(null);
    submittingOrderIdsRef.current.add(orderId);
    setSubmittingOrderIds((prev) => new Set(prev).add(orderId));

    const willHavePendingFood = stationTarget === "KITCHEN" || stationTarget === "ALL" ? false : Boolean(targetOrder?.hasPendingFood);
    const willHavePendingBeverage = stationTarget === "BARISTA" || stationTarget === "ALL" ? false : Boolean(targetOrder?.hasPendingBeverage);
    const willRemainPending = willHavePendingFood || willHavePendingBeverage;

    if (!willRemainPending) {
      confirmedOrderIdsRef.current.add(orderId);
      setPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
    } else {
      // Retain in pending list with updated station flags
      setPendingOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                hasPendingFood: willHavePendingFood,
                hasPendingBeverage: willHavePendingBeverage,
              }
            : o
        )
      );
    }

    if (targetOrder) {
      const optimisticPaidRecord: PaidHistoryRecord = {
        id: `ORD-${targetOrder.orderNo || targetOrder.id.slice(-4)}`,
        tableLabel: targetOrder.tableLabel,
        totalRupees: Math.round(targetOrder.totalPaise / 100),
        paymentMethod: paymentMethod,
        paidAt: new Date().toISOString(),
        itemsCount: targetOrder.items.reduce((acc, i) => acc + i.qty, 0) || 1,
        items: targetOrder.items.map((i) => ({
          name: i.name,
          qty: i.qty,
          priceRupees: Math.round(i.unitPricePaise / 100),
          subtotalRupees: Math.round(i.lineSubtotal / 100),
        })),
      };
      setPaidHistory((prev) => [optimisticPaidRecord, ...prev.filter((p) => p.id !== optimisticPaidRecord.id)]);
    }

    const stationLabel =
      stationTarget === "KITCHEN"
        ? "Kitchen (Food)"
        : stationTarget === "BARISTA"
        ? "Barista (Drinks)"
        : "Kitchen & Barista";

    setActionFeedback({
      type: "success",
      text: `Order #${targetOrder?.orderNo || ""} confirmed (${paymentMethod}) and dispatched to ${stationLabel}!`,
    });

    try {
      const res = await confirmCashierOrderAction(orderId, stationTarget, staffName, paymentMethod);
      if (res.success) {
        if (res.isFullyDispatched) {
          confirmedOrderIdsRef.current.add(orderId);
          setPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
        } else {
          refreshData();
        }

        const ticketPayload = targetOrder
          ? {
              id: targetOrder.id,
              orderNo: targetOrder.orderNo,
              tableLabel: targetOrder.tableLabel,
              tableId: targetOrder.tableId,
              status: "ACCEPTED" as const,
              submittedAt: targetOrder.submittedAt || new Date().toISOString(),
              acceptedAt: new Date().toISOString(),
              readyAt: null,
              instructions: targetOrder.instructions,
              items: targetOrder.items.map((it) => ({
                id: it.id,
                name: it.name,
                qty: it.qty,
                itemStatus:
                  stationTarget === "ALL"
                    ? "ACCEPTED"
                    : stationTarget === "KITCHEN" && !it.isBeverage
                    ? "ACCEPTED"
                    : stationTarget === "BARISTA" && it.isBeverage
                    ? "ACCEPTED"
                    : it.itemStatus || "PENDING",
                isBeverage: it.isBeverage,
              })),
            }
          : undefined;

        broadcastSyncEvent({
          type: "ORDER_CONFIRMED",
          orderId,
          orderNo: targetOrder?.orderNo,
          tableLabel: targetOrder?.tableLabel,
          tableId: targetOrder?.tableId,
          status: res.isFullyDispatched ? "ACCEPTED" : "SUBMITTED",
          station: stationTarget,
          timestamp: Date.now(),
          metadata: {
            stationTarget,
            isFullyDispatched: res.isFullyDispatched,
            staffName,
            paymentMethod,
            hasFoodItems: targetOrder ? targetOrder.hasFoodItems : true,
            hasBeverageItems: targetOrder ? targetOrder.hasBeverageItems : true,
            ticket: ticketPayload,
          },
        });
      } else {
        confirmedOrderIdsRef.current.delete(orderId);
        setActionFeedback({ type: "error", text: res.message || "Failed to confirm order." });
        refreshData();
      }
    } catch {
      confirmedOrderIdsRef.current.delete(orderId);
      setActionFeedback({ type: "error", text: "Network error confirming order." });
      refreshData();
    } finally {
      submittingOrderIdsRef.current.delete(orderId);
      setSubmittingOrderIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    if (submittingOrderIdsRef.current.has(orderId)) return;
    const reason = prompt("Enter reason for order rejection/cancellation:", "Customer requested cancellation");
    if (!reason) return;

    // Instant Optimistic Removal
    submittingOrderIdsRef.current.add(orderId);
    confirmedOrderIdsRef.current.add(orderId);
    setSubmittingOrderIds((prev) => new Set(prev).add(orderId));
    setPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
    setActionFeedback({ type: "success", text: "Order cancelled." });

    try {
      const res = await rejectCashierOrderAction(orderId, reason, staffName);
      if (res.success) {
        broadcastSyncEvent({
          type: "STATUS_CHANGED",
          orderId,
          status: "CANCELLED",
          timestamp: Date.now(),
        });
      } else {
        confirmedOrderIdsRef.current.delete(orderId);
        setActionFeedback({ type: "error", text: res.message || "Failed to reject order." });
        refreshData();
      }
    } catch {
      confirmedOrderIdsRef.current.delete(orderId);
      setActionFeedback({ type: "error", text: "Network error rejecting order." });
      refreshData();
    } finally {
      submittingOrderIdsRef.current.delete(orderId);
      setSubmittingOrderIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const [isClearingAll, setIsClearingAll] = useState(false);

  const handleClearAllPendingOrders = async () => {
    if (pendingOrders.length === 0 || isClearingAll) return;
    const confirmClear = window.confirm(
      `Are you sure you want to clear all ${pendingOrders.length} pending orders from the cashier queue?`
    );
    if (!confirmClear) return;

    setIsClearingAll(true);
    const orderIds = pendingOrders.map((o) => o.id);
    orderIds.forEach((id) => {
      submittingOrderIdsRef.current.add(id);
      confirmedOrderIdsRef.current.add(id);
    });
    setPendingOrders([]);

    try {
      const res = await clearAllPendingCashierOrdersAction("CANCEL", staffName);
      if (res.success) {
        broadcastSyncEvent({
          type: "STATUS_CHANGED",
          timestamp: Date.now(),
          metadata: {
            clearedCount: orderIds.length,
            status: "CANCELLED",
            staffName,
          },
        });
        setActionFeedback({
          type: "success",
          text: res.message || `Cleared ${orderIds.length} orders from queue.`,
        });
        await refreshData();
      } else {
        setActionFeedback({
          type: "error",
          text: res.message || "Failed to clear all orders.",
        });
        await refreshData();
      }
    } catch {
      setActionFeedback({
        type: "error",
        text: "Network error clearing orders.",
      });
      await refreshData();
    } finally {
      setIsClearingAll(false);
      orderIds.forEach((id) => submittingOrderIdsRef.current.delete(id));
    }
  };

  const handleOpenSettlement = (table: ActiveCashierTable) => {
    setSelectedTable(table);
    setAmountTendered(String(Math.round(table.totalPaise / 100)));
    setResultMessage(null);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable || isSubmitting) return;

    const tenderedPaise = Math.round(parseFloat(amountTendered) * 100);
    if (isNaN(tenderedPaise) || tenderedPaise < selectedTable.totalPaise) {
      setResultMessage({
        type: "error",
        text: "Tendered amount cannot be less than the total bill amount.",
      });
      return;
    }

    setIsSubmitting(true);
    setResultMessage(null);

    try {
      const res = await recordCashPaymentAction(selectedTable.sessionId, tenderedPaise, staffName);

      if (res.success) {
        const change = Math.round((res.changePaise || 0) / 100);
        setResultMessage({
          type: "success",
          text: `Table ${selectedTable.tableLabel} settled successfully!`,
          changeRupees: change,
        });
        refreshData();
      } else {
        setResultMessage({
          type: "error",
          text: res.message || "Failed to record cash payment.",
        });
      }
    } catch {
      setResultMessage({
        type: "error",
        text: "An unexpected error occurred during cash settlement.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkDelivered = async (orderId: string) => {
    setDeliveringOrderIds((prev) => new Set(prev).add(orderId));
    try {
      const res = await markOrderDeliveredAction(orderId);
      if (res.success) {
        setActionFeedback({ type: "success", text: "Order marked as Delivered & Served to Customer!" });
        setDeliveryOrders((prev) => prev.filter((o) => o.id !== orderId));
        void refreshData(true);
      } else {
        setActionFeedback({ type: "error", text: res.message || "Failed to mark order as delivered." });
      }
    } catch {
      setActionFeedback({ type: "error", text: "An error occurred while marking order delivered." });
    } finally {
      setDeliveringOrderIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const selectedTotalRupees = selectedTable ? Math.round(selectedTable.totalPaise / 100) : 0;
  const tenderedRupees = parseFloat(amountTendered) || 0;
  const changeDueRupees = Math.max(0, tenderedRupees - selectedTotalRupees);

  return (
    <div className="min-h-screen bg-[#F3E7D3] dark:bg-[#141211] text-[#241F1C] dark:text-[#FDFBF7] transition-colors duration-200">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB]/95 dark:bg-[#1C1917]/95 px-3 sm:px-6 pt-[calc(0.625rem+env(safe-area-inset-top,0px))] pb-2.5 sm:pb-3.5 backdrop-blur-md transition-colors duration-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
          {/* Brand Left */}
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            <Link
              href="/smol-backdoor"
              className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#F3E7D3] dark:bg-stone-800 text-[#725039] dark:text-stone-300 hover:bg-[#EBDDC8] dark:hover:bg-stone-700 transition cursor-pointer shrink-0"
              title="Back to staff portal"
            >
              ←
            </Link>
            <div className="relative h-8 w-8 sm:h-10 sm:w-10 shrink-0 select-none flex items-center justify-center">
              <Image
                src="/cashier-logo.png"
                alt="smol café cashier logo"
                width={40}
                height={40}
                priority
                className="h-8 w-auto sm:h-10 object-contain drop-shadow-xs dark:hidden block"
              />
              <Image
                src="/cashier-logo-dark.png"
                alt="smol café cashier logo night mode"
                width={40}
                height={40}
                priority
                className="h-8 w-auto sm:h-10 object-contain drop-shadow-[0_0_8px_rgba(168,85,247,0.4)] hidden dark:block"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm sm:text-lg font-black tracking-tight text-[#B72E35] dark:text-[#F6AD55] truncate">
                  smol café • cashier
                </span>
                <span className="hidden md:inline rounded-md border border-[#C9AE8B]/30 dark:border-stone-700 bg-[#F3E7D3] dark:bg-stone-800 px-2 py-0.5 font-mono text-[10px] text-[#725039] dark:text-stone-400 shrink-0">
                  Front-Desk Queue
                </span>
              </div>
            </div>
          </div>

          {/* Controls Right */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => refreshData()}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 rounded-xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-stone-900 px-2.5 py-1 text-xs font-mono text-[#725039] dark:text-stone-400 hover:bg-[#F3E7D3] dark:hover:bg-stone-800 active:scale-95 transition cursor-pointer"
              title="Refresh Queue & Tables"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-[#B72E35] dark:text-[#F6AD55] ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>
            <span className="flex items-center gap-1 sm:gap-1.5 rounded-full border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-stone-900 px-2 sm:px-3 py-1 text-[11px] sm:text-xs font-mono text-[#725039] dark:text-stone-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden sm:inline">Live 3s</span>
            </span>
            <Link
              href="/smol-backdoor"
              className="hidden sm:inline rounded-xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-stone-900 px-3 py-1 text-xs font-mono text-[#725039] dark:text-stone-400 hover:bg-[#F3E7D3] dark:hover:bg-stone-800 transition"
            >
              Role Portal
            </Link>

            {/* Logout Button */}
            <button
              type="button"
              onClick={async () => {
                await staffBackdoorLogoutAction();
              }}
              className="flex items-center gap-1 rounded-xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-stone-900 px-2.5 sm:px-3 py-1 text-xs font-mono text-[#725039] dark:text-stone-400 hover:text-[#B72E35] dark:hover:text-red-400 hover:border-red-300 transition cursor-pointer"
              title="Logout staff session"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>

            {/* Theme Toggle Button */}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl p-4 sm:p-6 space-y-4 sm:space-y-6">
        {actionFeedback && (
          <div
            className={`rounded-2xl p-4 text-xs font-serif ${
              actionFeedback.type === "error"
                ? "bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-900/60"
                : "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-900/60"
            }`}
          >
            {actionFeedback.text}
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-2 border-b border-[#C9AE8B]/30 dark:border-stone-800 pb-2.5 overflow-x-auto scrollbar-none">
          {/* TAB 1: ORDER CONFIRMATION QUEUE */}
          <button
            type="button"
            onClick={() => setActiveTab("queue")}
            className={`flex shrink-0 items-center gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl px-3.5 sm:px-5 py-2 sm:py-2.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "queue"
                ? "bg-[#B72E35] text-white shadow-md font-extrabold"
                : "bg-[#FAF4EB] dark:bg-stone-900 border border-[#C9AE8B]/40 dark:border-stone-800 text-[#725039] dark:text-stone-400 hover:bg-[#F3E7D3] dark:hover:bg-stone-800"
            }`}
          >
            <Bell className="h-4 w-4 shrink-0 text-[#8C6207] dark:text-[#F6AD55]" />
            <span className="hidden sm:inline">Order Queue</span>
            <span className="sm:hidden">Queue</span>
            {pendingOrders.length > 0 && (
              <span className="rounded-full bg-white px-1.5 sm:px-2 py-0.2 text-[10px] font-black text-[#B72E35] animate-bounce">
                {pendingOrders.length}
              </span>
            )}
          </button>

          {/* TAB 2: ORDER DELIVERY (Kitchen Ready) */}
          <button
            type="button"
            onClick={() => setActiveTab("delivery")}
            className={`flex shrink-0 items-center gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl px-3.5 sm:px-5 py-2 sm:py-2.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "delivery"
                ? "bg-[#1E7250] text-white shadow-md font-extrabold"
                : "bg-[#FAF4EB] dark:bg-stone-900 border border-[#C9AE8B]/40 dark:border-stone-800 text-[#725039] dark:text-stone-400 hover:bg-[#F3E7D3] dark:hover:bg-stone-800"
            }`}
          >
            <Truck className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
            <span className="hidden sm:inline">Order Delivery</span>
            <span className="sm:hidden">Delivery</span>
            {deliveryOrders.length > 0 && (
              <span className="rounded-full bg-emerald-500 text-white px-1.5 sm:px-2 py-0.2 text-[10px] font-black animate-pulse">
                {deliveryOrders.length} Ready
              </span>
            )}
          </button>

          {/* TAB 3: PAID ORDERS */}
          <button
            type="button"
            onClick={() => setActiveTab("paid")}
            className={`flex shrink-0 items-center gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl px-3.5 sm:px-5 py-2 sm:py-2.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "paid"
                ? "bg-[#75AFA7] text-white shadow-md font-extrabold"
                : "bg-[#FAF4EB] dark:bg-stone-900 border border-[#C9AE8B]/40 dark:border-stone-800 text-[#725039] dark:text-stone-400 hover:bg-[#F3E7D3] dark:hover:bg-stone-800"
            }`}
          >
            <Receipt className="h-4 w-4 shrink-0 text-[#245850] dark:text-emerald-400" />
            <span className="hidden sm:inline">Paid Orders</span>
            <span className="sm:hidden">Paid History</span>
            <span className="rounded-full bg-[#F3E7D3] dark:bg-stone-800 px-1.5 sm:px-2 py-0.2 text-[10px] font-mono text-[#725039] dark:text-stone-300">
              {paidHistory.length}
            </span>
          </button>
        </div>

        {/* TAB 1: ORDER CONFIRMATION QUEUE */}
        {activeTab === "queue" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
              <div>
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-[#241F1C] dark:text-[#FDFBF7]">
                  Incoming Cashier Approval Queue
                </h1>
                <p className="text-xs text-[#725039] dark:text-stone-400 mt-0.5">
                  Review &amp; Edit orders placed via &quot;Pay at Cashier&quot; before dispatching to Kitchen / Barista KDS
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <span className="inline-flex items-center whitespace-nowrap rounded-full bg-[#B72E35]/10 dark:bg-[#B72E35]/20 border border-[#B72E35]/30 dark:border-[#B72E35]/50 px-3 py-1 font-mono text-xs font-bold text-[#B72E35] dark:text-[#F2C84B]">
                  {pendingOrders.length} Awaiting Approval
                </span>
                {pendingOrders.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllPendingOrders}
                    disabled={isClearingAll}
                    className="inline-flex items-center whitespace-nowrap gap-1.5 rounded-full border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 px-3 py-1 text-xs font-bold text-rose-700 dark:text-rose-300 shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                    title="Clear all pending orders from queue"
                  >
                    <Trash2 className="h-3.5 w-3.5 shrink-0" />
                    <span>{isClearingAll ? "Clearing..." : "Clear All"}</span>
                  </button>
                )}
              </div>
            </div>

            {pendingOrders.length === 0 ? (
              <div className="rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] p-12 text-center text-[#725039] dark:text-stone-500 space-y-2 shadow-xs transition-colors">
                <Sparkles className="h-8 w-8 text-amber-500 mx-auto" />
                <p className="text-sm font-bold text-[#241F1C] dark:text-stone-200">No pending orders in queue</p>
                <p className="text-xs text-[#8C6D53] dark:text-stone-500">
                  All customer orders have been reviewed, edited, and dispatched to stations.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {pendingOrders.map((order) => {
                  const totalRupees = Math.round(order.totalPaise / 100);
                  const isSubmitting = submittingOrderIds.has(order.id);
                  const totalQty = order.items.reduce((s, i) => s + i.qty, 0);

                  return (
                    <div
                      key={order.id}
                      className="relative flex flex-col justify-between rounded-2xl sm:rounded-3xl border-2 border-amber-400/80 dark:border-amber-500/50 bg-gradient-to-b from-[#FFFDF9] via-[#FAF4EB] to-[#F5ECE0] dark:from-[#1E1B18] dark:via-[#1A1715] dark:to-[#141210] p-3.5 sm:p-5 shadow-lg shadow-black/5 dark:shadow-black/30 space-y-3 sm:space-y-4 animate-scale-in transition-all overflow-hidden"
                    >
                      {/* Top Accent Line */}
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500" />

                      <div className="space-y-3">
                        {/* Card Header: Live Status & Badges */}
                        <div className="flex items-center justify-between gap-2 border-b border-[#C9AE8B]/25 dark:border-stone-800/80 pb-2.5 pt-0.5">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#B72E35]/10 dark:bg-rose-500/20 border border-[#B72E35]/20 dark:border-rose-500/30 text-[#B72E35] dark:text-rose-300 font-mono text-[10px] sm:text-[11px] font-black uppercase tracking-wider min-w-0">
                            <span className="relative flex h-2 w-2 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#B72E35] dark:bg-rose-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#B72E35] dark:bg-rose-400" />
                            </span>
                            <span className="truncate">PAY AT CASHIER</span>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700/60 px-2.5 py-0.5 font-mono text-[10px] sm:text-[11px] font-extrabold text-amber-800 dark:text-amber-300 whitespace-nowrap shrink-0">
                            Awaiting Cashier Approval
                          </span>
                        </div>

                        {/* Table Number + Order Metadata + Edit Button */}
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <div className="min-w-0">
                            <h2 className="font-mono text-xl sm:text-2xl font-black text-[#241F1C] dark:text-white tracking-tight">
                              Table {order.tableLabel}
                            </h2>
                            <p className="font-mono text-[11px] sm:text-xs text-[#725039] dark:text-stone-400 flex items-center gap-1.5 mt-0.5" suppressHydrationWarning>
                              <span>Order #{order.orderNo}</span>
                              <span className="text-stone-300 dark:text-stone-600">•</span>
                              <Clock className="h-3 w-3 text-[#8C6D53] dark:text-stone-500 shrink-0" />
                              <span suppressHydrationWarning>
                                {isMounted
                                  ? new Date(order.submittedAt || Date.now()).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "Recently"}
                              </span>
                            </p>
                          </div>

                          {/* Top-Right Quick Edit Button */}
                          <button
                            type="button"
                            onClick={() => setEditingOrder(order)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[#C9AE8B]/60 dark:border-stone-700 bg-[#F3E7D3]/90 dark:bg-stone-800 px-3 py-1.5 text-xs font-bold text-[#725039] dark:text-stone-200 hover:bg-[#EBDDC8] dark:hover:bg-stone-700 active:scale-95 transition cursor-pointer shadow-xs shrink-0"
                          >
                            <Edit3 className="h-3.5 w-3.5 text-[#B72E35] dark:text-[#F6AD55]" />
                            <span>Edit Order</span>
                          </button>
                        </div>

                        {/* Special Instructions */}
                        {order.instructions && (
                          <div className="rounded-xl border border-amber-300/80 dark:border-amber-800/60 bg-amber-500/10 dark:bg-amber-950/30 p-2.5 text-xs text-amber-950 dark:text-amber-200 font-serif italic">
                            &quot;{order.instructions}&quot;
                          </div>
                        )}

                        {/* Items Breakdown Box */}
                        <div className="rounded-xl sm:rounded-2xl bg-[#F0E4D2]/40 dark:bg-stone-900/50 border border-[#C9AE8B]/25 dark:border-stone-800/80 p-2.5 sm:p-3 space-y-2">
                          <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-[#8C6D53] dark:text-stone-500 border-b border-[#C9AE8B]/20 dark:border-stone-800/60 pb-1 px-0.5">
                            <span>Items ({totalQty})</span>
                            <span>Amount</span>
                          </div>

                          <div className="space-y-1.5 font-sans text-xs divide-y divide-[#C9AE8B]/15 dark:divide-stone-800/40">
                            {order.items.map((item) => (
                              <div key={item.id} className="pt-1.5 first:pt-0 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold shrink-0 ${
                                      item.isBeverage
                                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                                        : "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border border-orange-300 dark:border-orange-800"
                                    }`}
                                  >
                                    {item.isBeverage ? <Coffee className="h-2.5 w-2.5" /> : <UtensilsCrossed className="h-2.5 w-2.5" />}
                                    <span>{item.isBeverage ? "Barista" : "Kitchen"}</span>
                                  </span>
                                  <span className="font-medium text-[#241F1C] dark:text-stone-200 truncate">
                                    <strong className="font-mono text-[#B72E35] dark:text-[#F6AD55] mr-1">{item.qty}×</strong>
                                    {item.name}
                                  </span>
                                </div>
                                <span className="font-mono font-bold text-[#725039] dark:text-stone-300 shrink-0">
                                  ₹{Math.round(item.lineSubtotal / 100)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Card Bottom / Actions */}
                      <div className="border-t border-[#C9AE8B]/30 dark:border-stone-800 pt-3 space-y-3">
                        <div className="flex items-baseline justify-between px-0.5">
                          <div>
                            <span className="block font-mono text-[9px] uppercase font-bold text-[#8C6D53] dark:text-stone-500 tracking-wider">
                              ORDER AMOUNT
                            </span>
                            <span className="font-mono text-2xl font-black text-[#B72E35] dark:text-[#F6AD55]">
                              ₹{totalRupees}
                            </span>
                          </div>

                          <span className="font-mono text-xs font-semibold text-[#8C6D53] dark:text-stone-400 bg-[#E8DAC5]/60 dark:bg-stone-800/80 px-2.5 py-1 rounded-lg border border-[#C9AE8B]/30 dark:border-stone-700/60">
                            {totalQty} {totalQty === 1 ? "item" : "items"}
                          </span>
                        </div>

                        {/* CONFIRMATION DISPATCH BUTTONS */}
                        <div className="grid grid-cols-1 gap-2">
                          {/* If order has both Food and Beverage items, offer station-wise or combined confirm */}
                          {order.hasFoodItems && order.hasBeverageItems ? (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                disabled={isSubmitting || !order.hasPendingFood}
                                onClick={() => handleInitiateConfirm(order, "KITCHEN")}
                                className={`flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2.5 text-xs font-bold shadow-xs active:scale-[0.98] transition cursor-pointer disabled:opacity-60 ${
                                  !order.hasPendingFood
                                    ? "bg-stone-300 dark:bg-stone-800 text-stone-500 cursor-not-allowed"
                                    : "bg-orange-600 hover:bg-orange-500 text-white"
                                }`}
                                title={!order.hasPendingFood ? "Food already dispatched to Kitchen" : "Send only Food items to Kitchen KDS"}
                              >
                                {isSubmitting ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : !order.hasPendingFood ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <UtensilsCrossed className="h-3.5 w-3.5" />
                                )}
                                <span>{!order.hasPendingFood ? "Kitchen Dispatched ✓" : "Kitchen (Food)"}</span>
                              </button>

                              <button
                                type="button"
                                disabled={isSubmitting || !order.hasPendingBeverage}
                                onClick={() => handleInitiateConfirm(order, "BARISTA")}
                                className={`flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2.5 text-xs font-bold shadow-xs active:scale-[0.98] transition cursor-pointer disabled:opacity-60 ${
                                  !order.hasPendingBeverage
                                    ? "bg-stone-300 dark:bg-stone-800 text-stone-500 cursor-not-allowed"
                                    : "bg-amber-600 hover:bg-amber-500 text-white"
                                }`}
                                title={!order.hasPendingBeverage ? "Drinks already dispatched to Barista" : "Send only Beverage items to Barista Desk"}
                              >
                                {isSubmitting ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : !order.hasPendingBeverage ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <Coffee className="h-3.5 w-3.5" />
                                )}
                                <span>{!order.hasPendingBeverage ? "Barista Dispatched ✓" : "Barista (Drinks)"}</span>
                              </button>

                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => handleInitiateConfirm(order, "ALL")}
                                className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-3 text-xs sm:text-sm font-extrabold shadow-md active:scale-[0.98] transition cursor-pointer disabled:opacity-50"
                              >
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                <span>
                                  {!order.hasPendingFood
                                    ? "Dispatch Remaining (Barista)"
                                    : !order.hasPendingBeverage
                                    ? "Dispatch Remaining (Kitchen)"
                                    : "Confirm All (Kitchen & Barista)"}
                                </span>
                              </button>
                            </div>
                          ) : order.hasFoodItems ? (
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => handleInitiateConfirm(order, "KITCHEN")}
                              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-3 text-xs sm:text-sm font-extrabold shadow-md active:scale-[0.98] transition cursor-pointer disabled:opacity-50"
                            >
                              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UtensilsCrossed className="h-4 w-4" />}
                              <span>Confirm for Kitchen (Food)</span>
                            </button>
                          ) : order.hasBeverageItems ? (
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => handleInitiateConfirm(order, "BARISTA")}
                              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-3 text-xs sm:text-sm font-extrabold shadow-md active:scale-[0.98] transition cursor-pointer disabled:opacity-50"
                            >
                              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coffee className="h-4 w-4" />}
                              <span>Confirm for Barista (Drinks)</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => handleInitiateConfirm(order, "ALL")}
                              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-3 text-xs sm:text-sm font-extrabold shadow-md active:scale-[0.98] transition cursor-pointer disabled:opacity-50"
                            >
                              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              <span>Confirm &amp; Dispatch Order</span>
                            </button>
                          )}

                          {/* Reject Option */}
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => handleRejectOrder(order.id)}
                            className="w-full text-center text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-500/10 py-1.5 rounded-lg transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                          >
                            Reject / Cancel Order
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ORDER DELIVERY (READY FOR SERVING) */}
        {activeTab === "delivery" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-[#241F1C] dark:text-white">
                  Order Delivery Board (Ready from Kitchen &amp; Bar)
                </h1>
                <p className="text-xs text-[#725039] dark:text-stone-400">
                  Kitchen and Barista have prepared these orders. Verify customer details and mark delivered to table.
                </p>
              </div>
              <div className="self-start sm:self-auto">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800/60 px-3 py-1 font-mono text-xs font-bold text-emerald-800 dark:text-emerald-300 shadow-xs">
                  <Truck className="h-3.5 w-3.5" />
                  <span>{deliveryOrders.length} Ready for Delivery</span>
                </span>
              </div>
            </div>

            {deliveryOrders.length === 0 ? (
              <div className="rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] p-10 text-center text-[#725039] dark:text-stone-400 space-y-3 shadow-xs transition-colors">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50">
                  <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="text-base font-bold text-[#241F1C] dark:text-stone-200">No Orders Waiting for Delivery</h2>
                <p className="text-xs max-w-sm mx-auto text-[#725039] dark:text-stone-400">
                  When Kitchen or Barista marks items as READY, they will appear here with customer contact details for instant table service.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {deliveryOrders.map((order) => {
                  const isDelivering = deliveringOrderIds.has(order.id);
                  const readyTimeStr = order.readyAt
                    ? new Date(order.readyAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "Just now";

                  return (
                    <div
                      key={order.id}
                      className="rounded-3xl border-2 border-emerald-600/40 dark:border-emerald-500/30 bg-[#FAF4EB] dark:bg-[#1A1715] p-5 shadow-sm space-y-4 hover:border-emerald-600 dark:hover:border-emerald-500 transition-all flex flex-col justify-between"
                    >
                      {/* Card Header: Table + Order # + Total */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-[#C9AE8B]/30 dark:border-stone-800 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="rounded-xl bg-[#B72E35] text-white px-3 py-1 font-serif text-sm font-black shadow-xs">
                              Table {order.tableLabel}
                            </span>
                            <span className="font-mono text-xs font-bold text-[#725039] dark:text-stone-300">
                              #{order.orderNo ? order.orderNo.toString().padStart(4, "0") : order.id.slice(0, 6)}
                            </span>
                          </div>
                          <span className="font-serif text-base font-extrabold text-[#241F1C] dark:text-stone-100">
                            ₹{order.totalRupees}
                          </span>
                        </div>

                        {/* Customer Identification Block */}
                        <div className="rounded-2xl border border-[#C9AE8B]/30 dark:border-stone-800 bg-[#F3E7D3]/60 dark:bg-stone-900/60 p-3.5 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 font-bold text-[#241F1C] dark:text-stone-200">
                              <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span className="truncate">{order.guestName}</span>
                            </div>
                            <div className="flex items-center gap-1 font-mono text-[11px] text-[#725039] dark:text-stone-400">
                              <Clock className="h-3.5 w-3.5 shrink-0" />
                              <span>Ready {readyTimeStr}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-1 border-t border-[#C9AE8B]/20 dark:border-stone-800/80">
                            <Phone className="h-3.5 w-3.5 text-[#8C6207] dark:text-[#F6AD55] shrink-0" />
                            {order.guestPhone && order.guestPhone !== "—" ? (
                              <a
                                href={`tel:${order.guestPhone}`}
                                className="font-mono text-xs font-bold text-[#8C6207] dark:text-[#F6AD55] hover:underline"
                                title="Call customer"
                              >
                                {order.guestPhone}
                              </a>
                            ) : (
                              <span className="font-mono text-xs text-stone-500 dark:text-stone-400">
                                Direct / Walk-in Guest
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Line Items List */}
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-[#725039] dark:text-stone-400">
                            Items Ready to Serve ({order.items.reduce((acc, it) => acc + it.qty, 0)})
                          </div>
                          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                            {order.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between rounded-xl bg-white/70 dark:bg-stone-900/80 px-2.5 py-1.5 text-xs border border-[#C9AE8B]/20 dark:border-stone-800"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {item.isBeverage ? (
                                    <Coffee className="h-3.5 w-3.5 text-[#B72E35] dark:text-[#F6AD55] shrink-0" />
                                  ) : (
                                    <UtensilsCrossed className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                                  )}
                                  <span className="font-medium text-[#241F1C] dark:text-stone-200 truncate">
                                    {item.name}
                                  </span>
                                </div>
                                <span className="font-mono font-bold text-[#B72E35] dark:text-[#F6AD55] shrink-0">
                                  {item.qty}×
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Special Instructions */}
                        {order.instructions && (
                          <div className="rounded-xl border border-amber-300 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-2 text-[11px] text-amber-900 dark:text-amber-300">
                            <strong>Note:</strong> {order.instructions}
                          </div>
                        )}
                      </div>

                      {/* Card Action: Mark Delivered */}
                      <button
                        type="button"
                        disabled={isDelivering}
                        onClick={() => handleMarkDelivered(order.id)}
                        className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white py-3 text-xs sm:text-sm font-extrabold shadow-md active:scale-[0.98] transition cursor-pointer disabled:opacity-50"
                      >
                        {isDelivering ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        <span>Mark Order as Delivered &amp; Served</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PAID ORDERS & SETTLEMENT AUDIT */}
        {activeTab === "paid" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-[#241F1C] dark:text-white">Today&apos;s Paid Orders &amp; Audit Log</h1>
                <p className="text-xs text-[#725039] dark:text-stone-400">
                  Closed table chits and completed payment transactions
                </p>
              </div>
              <div className="self-start sm:self-auto">
                <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800/60 px-3 py-1 font-mono text-xs font-bold text-emerald-800 dark:text-emerald-400 shadow-xs">
                  Total: ₹{paidHistory.reduce((acc, p) => acc + p.totalRupees, 0)}
                </span>
              </div>
            </div>

            {paidHistory.length === 0 ? (
              <div className="rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] p-8 text-center text-[#725039] dark:text-stone-400 space-y-3 shadow-xs transition-colors">
                <Receipt className="h-8 w-8 text-[#8C6D53] dark:text-stone-500 mx-auto" />
                <p className="text-sm font-bold text-[#241F1C] dark:text-stone-200">No settled orders yet today</p>
                <p className="text-xs text-[#8C6D53] dark:text-stone-500 max-w-sm mx-auto">
                  Completed orders and cash settlements will appear here as audit logs.
                </p>
              </div>
            ) : (
              <>
                {/* Mobile View: Responsive Cards (< sm) */}
                <div className="space-y-3 sm:hidden">
                  {paidHistory.map((rec) => (
                    <div
                      key={rec.id}
                      className="rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] p-4 shadow-xs transition-colors space-y-3"
                    >
                      {/* Top Row: Settlement ID, Table, and Payment Method */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#241F1C] dark:text-stone-200 bg-[#F3E7D3] dark:bg-stone-800 px-2 py-0.5 rounded-md border border-[#C9AE8B]/30 dark:border-stone-700">
                            {rec.id}
                          </span>
                          <span className="font-mono text-xs font-bold text-[#8C6207] dark:text-[#F6AD55]">
                            Table {rec.tableLabel}
                          </span>
                        </div>
                        {rec.paymentMethod === "UPI" ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white dark:bg-stone-800 border border-[#C9AE8B]/40 dark:border-stone-700 shadow-2xs">
                            <Image
                              src="/upi-logo-trimmed.png"
                              alt="UPI"
                              width={32}
                              height={12}
                              className="h-3 w-auto object-contain dark:hidden"
                            />
                            <Image
                              src="/upi-logo-dark.png"
                              alt="UPI"
                              width={32}
                              height={12}
                              className="h-3 w-auto object-contain hidden dark:block"
                            />
                          </span>
                        ) : rec.paymentMethod === "CARD" ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white dark:bg-stone-800 border border-[#C9AE8B]/40 dark:border-stone-700 shadow-2xs font-mono text-[10px] font-bold text-stone-800 dark:text-stone-200">
                            <Image
                              src="/icon_card_hd.png"
                              alt="Card"
                              width={16}
                              height={16}
                              className="h-3.5 w-auto object-contain drop-shadow-2xs"
                            />
                            <span>CARD</span>
                          </span>
                        ) : rec.paymentMethod === "COMPLIMENTARY" ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800/50">
                            COMPLIMENTARY
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/50">
                            CASH / COUNTER
                          </span>
                        )}
                      </div>

                      {/* Items Details List */}
                      {rec.items && rec.items.length > 0 && (
                        <div className="bg-[#F3E7D3]/60 dark:bg-stone-900/60 rounded-xl p-2.5 space-y-1 text-xs font-mono">
                          {rec.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-[#241F1C] dark:text-stone-300 text-[11px]">
                              <span>
                                <strong className="text-[#B72E35] dark:text-[#F6AD55]">{item.qty}×</strong> {item.name}
                              </span>
                              <span className="text-[#725039] dark:text-stone-400">₹{item.subtotalRupees}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Bottom Row: Timestamp, Amount, and Chit Action */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#C9AE8B]/20 dark:border-stone-800/80">
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-mono text-[#8C6D53] dark:text-stone-500">Settled At</span>
                          <span className="font-mono text-xs text-[#725039] dark:text-stone-400" suppressHydrationWarning>
                            {isMounted
                              ? new Date(rec.paidAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : "Recently"}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-serif text-lg font-bold text-[#241F1C] dark:text-white">
                            ₹{rec.totalRupees}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveReceipt({
                                orderId: rec.id,
                                tableLabel: rec.tableLabel,
                                items: rec.items || [
                                  { name: "Settled Order Items", qty: rec.itemsCount, priceRupees: Math.round(rec.totalRupees / rec.itemsCount), subtotalRupees: rec.totalRupees }
                                ],
                                subtotalRupees: Math.round(rec.totalRupees / 1.05),
                                taxRupees: Math.round(rec.totalRupees - rec.totalRupees / 1.05),
                                totalRupees: rec.totalRupees,
                                paymentMethod: rec.paymentMethod,
                                paidAt: rec.paidAt,
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-xl border border-[#C9AE8B]/40 dark:border-stone-700 bg-[#F3E7D3] dark:bg-stone-800 px-3 py-1.5 text-xs font-semibold text-[#725039] dark:text-stone-300 hover:bg-[#EBDDC8] dark:hover:bg-stone-700 active:scale-95 transition cursor-pointer"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            <span>Chit</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tablet / Desktop View */}
                <div className="hidden sm:block rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] overflow-hidden shadow-xs transition-colors">
                  <div className="overflow-x-auto scrollbar-none">
                    <table className="w-full min-w-[620px] text-left text-xs">
                      <thead className="bg-[#F3E7D3] dark:bg-stone-900 text-[10px] uppercase tracking-wider font-mono text-[#725039] dark:text-stone-400 border-b border-[#C9AE8B]/30 dark:border-stone-800">
                        <tr>
                          <th className="p-3.5 whitespace-nowrap">Order / Chit #</th>
                          <th className="p-3.5 whitespace-nowrap">Table</th>
                          <th className="p-3.5 whitespace-nowrap">Items Breakdown</th>
                          <th className="p-3.5 whitespace-nowrap">Method</th>
                          <th className="p-3.5 whitespace-nowrap">Amount</th>
                          <th className="p-3.5 whitespace-nowrap">Settled At</th>
                          <th className="p-3.5 text-right whitespace-nowrap">Receipt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#C9AE8B]/20 dark:divide-stone-800 font-mono">
                        {paidHistory.map((rec) => (
                          <tr key={rec.id} className="hover:bg-[#F3E7D3]/60 dark:hover:bg-stone-900/50 transition">
                            <td className="p-3.5 font-bold text-[#241F1C] dark:text-stone-200 whitespace-nowrap">{rec.id}</td>
                            <td className="p-3.5 text-[#8C6207] dark:text-[#F6AD55] font-bold whitespace-nowrap">Table {rec.tableLabel}</td>
                            <td className="p-3.5 max-w-[280px]">
                              {rec.items && rec.items.length > 0 ? (
                                <div className="space-y-0.5">
                                  {rec.items.map((item, idx) => (
                                    <div key={idx} className="text-[11px] text-[#241F1C] dark:text-stone-300 truncate">
                                      <strong className="text-[#B72E35] dark:text-[#F6AD55]">{item.qty}×</strong> {item.name}
                                      <span className="text-[#8C6D53] dark:text-stone-500 text-[10px] ml-1.5">(₹{item.subtotalRupees})</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-stone-400">{rec.itemsCount} items</span>
                              )}
                            </td>
                            <td className="p-3.5 whitespace-nowrap">
                              {rec.paymentMethod === "UPI" ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white dark:bg-stone-800 border border-[#C9AE8B]/40 dark:border-stone-700 shadow-2xs">
                                  <Image
                                    src="/upi-logo-trimmed.png"
                                    alt="UPI"
                                    width={32}
                                    height={12}
                                    className="h-3 w-auto object-contain dark:hidden"
                                  />
                                  <Image
                                    src="/upi-logo-dark.png"
                                    alt="UPI"
                                    width={32}
                                    height={12}
                                    className="h-3 w-auto object-contain hidden dark:block"
                                  />
                                </span>
                              ) : rec.paymentMethod === "CARD" ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white dark:bg-stone-800 border border-[#C9AE8B]/40 dark:border-stone-700 shadow-2xs font-mono text-[10px] font-bold text-stone-800 dark:text-stone-200">
                                  <Image
                                    src="/icon_card_hd.png"
                                    alt="Card"
                                    width={16}
                                    height={16}
                                    className="h-3.5 w-auto object-contain drop-shadow-2xs"
                                  />
                                  <span>CARD</span>
                                </span>
                              ) : rec.paymentMethod === "COMPLIMENTARY" ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800/50">
                                  COMPLIMENTARY
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/50">
                                  CASH
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 font-bold text-[#241F1C] dark:text-white font-serif text-sm whitespace-nowrap">₹{rec.totalRupees}</td>
                            <td className="p-3.5 text-[#725039] dark:text-stone-400 text-[11px] whitespace-nowrap" suppressHydrationWarning>
                              {isMounted
                                ? new Date(rec.paidAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : "Recently"}
                            </td>
                            <td className="p-3.5 text-right whitespace-nowrap">
                              <button
                                onClick={() => {
                                  setActiveReceipt({
                                    orderId: rec.id,
                                    tableLabel: rec.tableLabel,
                                    items: rec.items || [
                                      { name: "Settled Order Items", qty: rec.itemsCount, priceRupees: Math.round(rec.totalRupees / rec.itemsCount), subtotalRupees: rec.totalRupees }
                                    ],
                                    subtotalRupees: Math.round(rec.totalRupees / 1.05),
                                    taxRupees: Math.round(rec.totalRupees - rec.totalRupees / 1.05),
                                    totalRupees: rec.totalRupees,
                                    paymentMethod: rec.paymentMethod,
                                    paidAt: rec.paidAt,
                                  });
                                }}
                                className="inline-flex items-center gap-1 rounded-xl border border-[#C9AE8B]/40 dark:border-stone-700 bg-[#F3E7D3] dark:bg-stone-800 px-3 py-1 text-xs text-[#725039] dark:text-stone-300 hover:bg-[#EBDDC8] dark:hover:bg-stone-700 hover:text-[#241F1C] dark:hover:text-white transition cursor-pointer"
                              >
                                <Printer className="h-3 w-3" />
                                <span>Chit</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Cash Payment Settlement Modal */}
      {selectedTable && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setSelectedTable(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1C1917] p-6 shadow-2xl transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#C9AE8B]/30 dark:border-stone-800 pb-4">
              <div>
                <span className="text-xs font-bold text-[#B72E35] dark:text-[#F6AD55]">Cash Settlement</span>
                <h3 className="text-2xl font-black font-mono text-[#241F1C] dark:text-white">
                  Table {selectedTable.tableLabel}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTable(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F3E7D3] dark:bg-stone-800 text-[#725039] dark:text-stone-400 hover:bg-[#EBDDC8] dark:hover:bg-stone-700 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {resultMessage ? (
              /* Success / Result View */
              <div className="py-6 text-center space-y-4">
                <div
                  className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-2xl ${
                    resultMessage.type === "success"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                      : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-300 dark:border-red-800"
                  }`}
                >
                  {resultMessage.type === "success" ? "✓" : "✕"}
                </div>
                <h4 className="text-lg font-bold text-[#241F1C] dark:text-white">{resultMessage.text}</h4>

                {resultMessage.changeRupees !== undefined && resultMessage.changeRupees > 0 && (
                  <div className="rounded-2xl border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 p-4">
                    <span className="text-xs text-amber-900 dark:text-amber-300 font-semibold">Change to Return</span>
                    <p className="text-3xl font-black font-mono text-amber-800 dark:text-amber-200 mt-1">
                      ₹{resultMessage.changeRupees}
                    </p>
                  </div>
                )}

                <button
                  onClick={() => {
                    setSelectedTable(null);
                    setResultMessage(null);
                  }}
                  className="w-full rounded-2xl bg-[#241F1C] dark:bg-stone-800 py-3 text-xs font-bold text-[#F3E7D3] dark:text-white transition hover:bg-[#362B24] dark:hover:bg-stone-700 cursor-pointer"
                >
                  Close &amp; Done
                </button>
              </div>
            ) : (
              /* Settlement Form */
              <form onSubmit={handleRecordPayment} className="mt-5 space-y-4">
                {/* Total Bill Display */}
                <div className="flex items-center justify-between rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#F3E7D3] dark:bg-stone-900/80 p-4">
                  <span className="text-xs font-bold text-[#725039] dark:text-stone-400">Total Bill Due</span>
                  <span className="font-mono text-2xl font-black text-[#B72E35] dark:text-[#F6AD55]">
                    ₹{selectedTotalRupees}
                  </span>
                </div>

                {/* Amount Tendered Input */}
                <div>
                  <label className="block text-xs font-bold text-[#725039] dark:text-stone-400 mb-1.5">
                    Amount Tendered by Customer (₹)
                  </label>
                  <input
                    type="number"
                    min={selectedTotalRupees}
                    step="1"
                    value={amountTendered}
                    onChange={(e) => setAmountTendered(e.target.value)}
                    className="w-full rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-700 bg-[#F3E7D3] dark:bg-stone-900 px-4 py-3.5 font-mono text-xl font-bold text-[#241F1C] dark:text-white focus:border-[#B72E35] focus:outline-none"
                    autoFocus
                    required
                  />
                </div>

                {/* Change Due Calculator */}
                <div className="flex items-center justify-between rounded-2xl border border-emerald-300 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-3.5 text-xs">
                  <span className="font-semibold text-emerald-800 dark:text-emerald-300">Change Due to Customer</span>
                  <span className="font-mono text-lg font-bold text-emerald-800 dark:text-emerald-300">
                    ₹{changeDueRupees}
                  </span>
                </div>

                {/* Staff Identifier */}
                <div>
                  <label className="block text-xs font-semibold text-[#8C6D53] dark:text-stone-500 mb-1">
                    Staff Identifier
                  </label>
                  <input
                    type="text"
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    className="w-full rounded-xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#F3E7D3] dark:bg-stone-900 px-3 py-2 text-xs text-[#241F1C] dark:text-white focus:border-[#B72E35] focus:outline-none"
                    required
                  />
                </div>

                {/* Submit Settlement Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting || tenderedRupees < selectedTotalRupees}
                    className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-[#B72E35] py-4 text-base font-bold text-white shadow-xl transition hover:bg-[#9B242A] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting
                      ? "Processing Settlement..."
                      : `Record Cash ₹${selectedTotalRupees} & Close Table`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Cashier Order Editor Modal (Edit Order feature) */}
      {editingOrder && (
        <CashierOrderEditorModal
          order={editingOrder}
          isOpen={Boolean(editingOrder)}
          onClose={() => setEditingOrder(null)}
          onSaveSuccess={() => {
            setActionFeedback({ type: "success", text: "Order items and totals updated successfully!" });
            refreshData();
          }}
        />
      )}

      {/* Payment Method Confirmation Popup Modal before Dispatch */}
      {paymentPromptOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in"
          onClick={() => setPaymentPromptOrder(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl border-2 border-[#F2C84B] dark:border-amber-500/60 bg-[#FAF4EB] dark:bg-[#1C1917] p-6 shadow-2xl transition-colors space-y-5 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[#C9AE8B]/30 dark:border-stone-800 pb-3.5">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800/60 px-2.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  <Receipt className="h-3 w-3" />
                  Select Payment Method
                </span>
                <h3 className="text-xl font-black text-[#241F1C] dark:text-white flex items-center gap-2">
                  Confirm Table {paymentPromptOrder.order.tableLabel}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPaymentPromptOrder(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F3E7D3] dark:bg-stone-800 text-[#725039] dark:text-stone-400 hover:bg-[#EBDDC8] dark:hover:bg-stone-700 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Order & Dispatch Summary Banner */}
            <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#F3E7D3]/70 dark:bg-stone-900/80 p-3.5">
              <div>
                <span className="block font-mono text-[9px] uppercase font-bold text-[#8C6D53] dark:text-stone-400">
                  Order Details
                </span>
                <p className="font-mono text-xs font-black text-[#241F1C] dark:text-stone-200">
                  #{paymentPromptOrder.order.orderNo} • {paymentPromptOrder.order.items.reduce((a, b) => a + b.qty, 0)} Items
                </p>
                <p className="font-sans text-[11px] text-[#725039] dark:text-stone-400">
                  Target: <strong className="text-emerald-700 dark:text-emerald-400">
                    {paymentPromptOrder.stationTarget === "KITCHEN"
                      ? "Kitchen (Food)"
                      : paymentPromptOrder.stationTarget === "BARISTA"
                      ? "Barista (Drinks)"
                      : "Kitchen & Barista"}
                  </strong>
                </p>
              </div>
              <div className="text-right">
                <span className="block font-mono text-[9px] uppercase font-bold text-[#8C6D53] dark:text-stone-400">
                  Total Payable
                </span>
                <p className="font-mono text-2xl font-black text-[#B72E35] dark:text-[#F6AD55]">
                  ₹{Math.round(paymentPromptOrder.order.totalPaise / 100)}
                </p>
              </div>
            </div>

            {/* Payment Method Selector (4 Big Rich Cards) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#725039] dark:text-stone-300">
                Choose How Guest Paid:
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  {
                    id: "UPI" as const,
                    label: "UPI / QR Code",
                    sub: "GPay, PhonePe, Paytm",
                    icon: Smartphone,
                    activeClass: "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 shadow-md",
                  },
                  {
                    id: "CASH" as const,
                    label: "Cash / Counter",
                    sub: "Direct Cash Received",
                    icon: Banknote,
                    activeClass: "border-amber-600 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 shadow-md",
                  },
                  {
                    id: "CARD" as const,
                    label: "POS / Card",
                    sub: "Credit / Debit Swipe",
                    icon: CreditCard,
                    activeClass: "border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 shadow-md",
                  },
                  {
                    id: "COMPLIMENTARY" as const,
                    label: "Complimentary",
                    sub: "House / Owner Promo",
                    icon: Gift,
                    activeClass: "border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 shadow-md",
                  },
                ].map((item) => {
                  const isSelected = paymentPromptOrder.selectedMethod === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setPaymentPromptOrder((prev) =>
                          prev ? { ...prev, selectedMethod: item.id } : null
                        )
                      }
                      className={`flex flex-col items-start p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                        isSelected
                          ? item.activeClass
                          : "border-[#C9AE8B]/40 dark:border-stone-800 bg-[#F3E7D3]/40 dark:bg-stone-900/50 hover:bg-[#EBDDC8]/60 dark:hover:bg-stone-800 text-[#241F1C] dark:text-stone-300"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <Icon className="h-4 w-4 shrink-0" />
                        {isSelected && (
                          <span className="h-2 w-2 rounded-full bg-current animate-pulse" />
                        )}
                      </div>
                      <span className="text-xs font-black">{item.label}</span>
                      <span className="text-[10px] opacity-75">{item.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPaymentPromptOrder(null)}
                className="rounded-2xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-[#F3E7D3] dark:bg-stone-800 px-4 py-3 text-xs font-bold text-[#725039] dark:text-stone-300 hover:bg-[#EBDDC8] dark:hover:bg-stone-700 transition cursor-pointer shrink-0"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleConfirmOrder(
                    paymentPromptOrder.order.id,
                    paymentPromptOrder.stationTarget,
                    paymentPromptOrder.selectedMethod
                  )
                }
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-[#B72E35] hover:bg-[#9B242A] text-white px-3 sm:px-4 py-3 text-xs sm:text-sm font-bold shadow-lg active:scale-[0.98] transition cursor-pointer min-w-0"
              >
                <Check className="h-4 w-4 shrink-0" />
                <span className="truncate">Confirm &amp; Dispatch ({paymentPromptOrder.selectedMethod})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JSON Table Tag Inspector Modal */}
      {inspectingTag && (
        <JsonTagInspectorModal
          tag={inspectingTag}
          onClose={() => setInspectingTag(null)}
        />
      )}

      {/* UPI Payment Gateway Drawer */}
      {activeUpiTable && (
        <UpiPaymentDrawer
          tableLabel={activeUpiTable.tableLabel}
          amountPaise={activeUpiTable.totalPaise}
          onClose={() => setActiveUpiTable(null)}
          onPaymentSuccess={(res) => {
            setActiveUpiTable(null);
            setPaidHistory((prev) => [
              {
                id: res.transactionId || `SETTLE-${Math.floor(1000 + Math.random() * 9000)}`,
                tableLabel: activeUpiTable.tableLabel,
                totalRupees: Math.round(activeUpiTable.totalPaise / 100),
                paymentMethod: "UPI",
                paidAt: res.paidAt,
                itemsCount: activeUpiTable.orderCount || 1,
              },
              ...prev,
            ]);
            refreshData();
          }}
        />
      )}

      {/* Digital Receipt / Tax Chit Modal */}
      {activeReceipt && (
        <DigitalReceiptModal
          receipt={activeReceipt}
          onClose={() => setActiveReceipt(null)}
        />
      )}
    </div>
  );
};
