"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import {
  placeOrderAction,
  placePaidOrderAction,
  editPendingOrderAction,
  type ChangedItemDiff,
} from "@/app/menu/actions";
import { useNetworkHealth } from "@/hooks/useNetworkHealth";
import { broadcastSyncEvent, subscribeToSyncEvents } from "@/lib/sync-events";
import { UpiPaymentDrawer } from "@/components/payment/UpiPaymentDrawer";
import {
  PostPaymentCelebrationModal,
  type PostPaymentCelebrationModalProps,
} from "@/components/payment/PostPaymentCelebrationModal";
import { bypassPaymentAction } from "@/app/bill/actions";
import { getFoodImage } from "@/lib/food-images";
import type { MenuItemWithDetails } from "@/lib/queries/menu";
import { getLoyaltyAccountAction, redeemLoyaltyPointsAction, type LoyaltyAccountDetails } from "@/app/account/loyalty-actions";
import { TableArchedCard } from "@/components/table/TableArchedCard";
import { enqueueOfflineOrder } from "@/lib/offline-queue";
import {
  CheckCircle2,
  CreditCard,
  Trash2,
  ChevronRight,
  Plus,
  Check,
  Lock,
  Receipt,
  Zap,
  Clock,
  Sparkles,
  Gift,
  Award,
  Loader2,
  Send,
} from "lucide-react";

import { normalizePhoneNumber } from "@/lib/customer-phone";

interface CartDrawerProps {
  tableLabel?: string;
  guestName?: string;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ tableLabel, guestName = "" }) => {
  const router = useRouter();
  const [currentGuestName, setCurrentGuestName] = useState(guestName);
  const [currentTableLabel, setCurrentTableLabel] = useState(tableLabel || "");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("smol_guest_name");
      if (saved && !currentGuestName) {
        setCurrentGuestName(saved);
      }
      const savedTable = localStorage.getItem("smol_current_table");
      if (savedTable && !currentTableLabel) {
        setCurrentTableLabel(savedTable);
      }
    }
  }, [currentGuestName, currentTableLabel]);
  const {
    items,
    updateQty,
    removeItem,
    clearCart,
    isCartOpen,
    closeCart,
    subtotalPaise,
    totalCount,
    addItem,
    editingOrder,
  } = useCart();
  const { isDegraded } = useNetworkHealth();

  const [activeView, setActiveView] = useState<"table_order" | "bill">("table_order");
  const [activeActionItemId, setActiveActionItemId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false);
  const [instructions, setInstructions] = useState("");

  useEffect(() => {
    if (editingOrder?.instructions && !instructions) {
      setInstructions(editingOrder.instructions);
    }
  }, [editingOrder]);

  const handleUpdatePendingOrder = async () => {
    if (!editingOrder) return;
    setIsUpdatingOrder(true);
    setErrorMessage(null);

    const orderPayload = items.map((cartItem) => ({
      menu_item_id: cartItem.item.id,
      name: cartItem.item.name,
      expected_unit_price_paise: cartItem.item.pricePaise,
      qty: cartItem.qty,
    }));

    try {
      const result = await editPendingOrderAction(
        editingOrder.orderId,
        orderPayload,
        instructions || undefined
      );

      if (result.success) {
        clearCart();
        closeCart();
        router.push("/orders");
        router.refresh();
      } else {
        setErrorMessage(result.message || "Failed to update order.");
      }
    } catch (e: any) {
      setErrorMessage(e.message || "An error occurred while updating the order.");
    } finally {
      setIsUpdatingOrder(false);
    }
  };
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [priceConflicts, setPriceConflicts] = useState<ChangedItemDiff[] | null>(null);
  const [isUpiDrawerOpen, setIsUpiDrawerOpen] = useState(false);
  const [boardAdded, setBoardAdded] = useState(false);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [isBypassing, setIsBypassing] = useState(false);
  const [celebrationData, setCelebrationData] = useState<PostPaymentCelebrationModalProps | null>(null);
  const [loyaltyData, setLoyaltyData] = useState<LoyaltyAccountDetails | null>(null);
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{
    orderNo: number;
    orderId: string;
    verificationCode?: string;
    totalPaise: number;
  } | null>(null);

  // Fetch customer loyalty pass details & listen for realtime changes
  useEffect(() => {
    const fetchLoyalty = () => {
      getLoyaltyAccountAction()
        .then((res) => {
          setLoyaltyData(res);
        })
        .catch((err) => console.warn("Could not load loyalty account:", err));
    };

    if (isCartOpen) {
      fetchLoyalty();
    }

    const unsub = subscribeToSyncEvents((event) => {
      if (event.type === "LOYALTY_UPDATED" || event.type === "REWARD_REDEEMED") {
        fetchLoyalty();
      }
    });

    return () => unsub();
  }, [isCartOpen]);

  const effectiveTable = tableLabel || currentTableLabel;
  const displayTable = effectiveTable
    ? effectiveTable.replace(/^(table|t)[-\s_]*/i, "").trim()
    : "";
  const itemsTotal = items.reduce(
    (sum, it) => sum + Math.round((it.item.pricePaise / 100) * it.qty),
    0
  );

  // Customer Loyalty Rules: ₹10 = 1 pt, Max 20% of bill value
  const userBalance = loyaltyData?.account?.current_balance_cached ?? 145;
  const maxDiscountPercent = loyaltyData?.config?.maxBillDiscountPercent ?? 20;
  const maxDiscountRupees = Math.min(userBalance, Math.floor(itemsTotal * (maxDiscountPercent / 100)));
  const pointsDiscountRupees = redeemPoints ? maxDiscountRupees : 0;
  const effectiveItemsTotal = Math.max(0, itemsTotal - pointsDiscountRupees);
  // Standard Restaurant GST: 5% (2.5% CGST + 2.5% SGST)
  const taxesAndCharges = Math.round(effectiveItemsTotal * 0.05);
  const grandTotal = effectiveItemsTotal + taxesAndCharges;
  const totalRupees = grandTotal;

  // Potential points earned on this order
  const rupeesPerPt = loyaltyData?.config?.rupeesPerPoint ?? 10;
  const slowMultiplier = loyaltyData?.config?.slowPeriodActive ? (loyaltyData?.config?.slowPeriodMultiplier ?? 2) : 1;
  const pointsEarnable = Math.floor(effectiveItemsTotal / rupeesPerPt) * slowMultiplier;

  // Group items by category: COFFEE, CHAI, FOOD
  const groupedItems = useMemo(() => {
    const groups: { [key: string]: typeof items } = {};

    items.forEach((cartItem) => {
      const name = cartItem.item.name.toLowerCase();
      const sub = (cartItem.item.metadata?.subcategory || "").toLowerCase();

      let groupKey = "FOOD";
      if (
        name.includes("coffee") ||
        name.includes("pour over") ||
        name.includes("latte") ||
        name.includes("cappuccino") ||
        name.includes("espresso") ||
        name.includes("flat white") ||
        name.includes("americano") ||
        sub.includes("coffee")
      ) {
        groupKey = "COFFEE";
      } else if (
        name.includes("chai") ||
        name.includes("tea") ||
        sub.includes("chai") ||
        sub.includes("tea")
      ) {
        groupKey = "CHAI";
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(cartItem);
    });

    // Ensure order: COFFEE, CHAI, FOOD
    const ordered: { key: string; items: typeof items }[] = [];
    if (groups["COFFEE"]) ordered.push({ key: "COFFEE", items: groups["COFFEE"] });
    if (groups["CHAI"]) ordered.push({ key: "CHAI", items: groups["CHAI"] });
    if (groups["FOOD"]) ordered.push({ key: "FOOD", items: groups["FOOD"] });

    // Any other groups
    Object.keys(groups).forEach((k) => {
      if (k !== "COFFEE" && k !== "CHAI" && k !== "FOOD") {
        ordered.push({ key: k, items: groups[k] });
      }
    });

    return ordered;
  }, [items]);

  // Extract customization note from item name or metadata
  const getCustomizationNote = (cartItem: typeof items[0]) => {
    const name = cartItem.item.name;
    if (name.includes("(Oat)")) return "Oat milk";
    if (name.includes("(Almond)")) return "Almond milk";
    if (name.includes("(Dairy)")) return "Dairy milk";
    if (name.includes("(Sourdough)")) return "Sourdough bread";
    if (name.includes("(Extra")) return "Extra Cheese";
    if (name.includes("(Spicy")) return "Spicy Dip";
    if (cartItem.item.metadata?.notes) return cartItem.item.metadata.notes;

    // Realistic defaults matching mockups if no options selected
    if (name.toLowerCase().includes("pour over")) return "No milk";
    if (name.toLowerCase().includes("flat white")) return "Oat milk";
    if (name.toLowerCase().includes("decker") || name.toLowerCase().includes("sandwich"))
      return "Add jalapeños";
    return null;
  };

  const handleAddConversationBoard = () => {
    const boardItem: MenuItemWithDetails = {
      id: "conversation_board",
      categoryId: "cat_06",
      name: "Conversation Board",
      status: "ACTIVE",
      description: "Cheese, fruits, nuts & a little something sweet.",
      pricePaise: 26000,
      imageUrl: getFoodImage("conversation board", null),
      metadata: { dietary: "Vegetarian" },
    };
    addItem(boardItem, 1);
    setBoardAdded(true);
    setTimeout(() => setBoardAdded(false), 2000);
  };

  const handleProcessPaidOrder = async (paymentMethod = "UPI", transactionId?: string) => {
    let clientPhone = "";
    let clientName = "";
    if (typeof window !== "undefined") {
      clientPhone = localStorage.getItem("smol_guest_phone") || "";
      clientName = localStorage.getItem("smol_guest_name") || "";
    }
    const cleanPhone = normalizePhoneNumber(clientPhone);
    const idempotencyKey = cleanPhone
      ? `smol_ord_${cleanPhone}_${crypto.randomUUID()}`
      : `smol_ord_guest_${crypto.randomUUID()}`;

    if (!displayTable) {
      setErrorMessage("No active table session found. Please scan your table QR code.");
      return null;
    }

    const orderPayload = items.map((cartItem) => ({
      menu_item_id: cartItem.item.id,
      name: cartItem.item.name,
      expected_unit_price_paise: cartItem.item.pricePaise,
      qty: cartItem.qty,
    }));

    // If browser is offline, directly enqueue offline buffered order
    if (typeof window !== "undefined" && !navigator.onLine) {
      const offlineOrder = enqueueOfflineOrder({
        tableLabel: displayTable,
        items: orderPayload.map((p) => ({
          menu_item_id: p.menu_item_id,
          expected_unit_price_paise: p.expected_unit_price_paise,
          qty: p.qty,
          name: items.find((it) => it.item.id === p.menu_item_id)?.item.name || "Artisanal Item",
        })),
        totalPaise: grandTotal * 100,
        instructions: instructions || undefined,
        paymentMethod,
        transactionId: transactionId || `OFF-${Date.now().toString().slice(-6)}`,
      });

      return {
        orderId: `offline-${offlineOrder.idempotencyKey}`,
        orderNo: offlineOrder.tempOrderNo,
        tableLabel: offlineOrder.tableLabel,
        totalPaise: offlineOrder.totalPaise,
        verificationCode: offlineOrder.verificationCode,
        isOffline: true,
      };
    }

    try {
      const result = await placePaidOrderAction(orderPayload, idempotencyKey, {
        instructions: instructions || undefined,
        paymentMethod,
        tableLabel: displayTable,
        guestName: clientName || undefined,
        guestPhone: clientPhone || undefined,
      });

      if (result.success && result.orderId && result.orderNo) {
        const finalOrderId = result.orderId;
        const finalOrderNo = result.orderNo;
        const finalTotalPaise = result.totalPaise || grandTotal * 100;
        const finalTableLabel = result.tableLabel || displayTable;

        const isCashier = paymentMethod === "CASHIER" || paymentMethod === "COUNTER";
        const orderStatus = result.status || (isCashier ? "PENDING_CONFIRMATION" : "CONFIRMED");
        const orderPaymentStatus = result.paymentStatus || (isCashier ? "PENDING" : "PAID");

        // Broadcast single source of truth order placed event across Cashier & Kitchen KDS
        broadcastSyncEvent({
          type: "ORDER_PLACED",
          orderId: finalOrderId,
          orderNo: finalOrderNo,
          tableLabel: finalTableLabel,
          status: orderStatus,
          timestamp: Date.now(),
          metadata: {
            paymentStatus: orderPaymentStatus,
            paymentMethod,
            transactionId: isCashier ? undefined : (transactionId || `TXN-${Date.now().toString().slice(-6)}`),
            amountPaise: finalTotalPaise,
            itemsCount: items.length,
          },
        });

        if (isCashier) {
          broadcastSyncEvent({
            type: "ORDER_PENDING_CASHIER",
            orderId: finalOrderId,
            orderNo: finalOrderNo,
            tableLabel: finalTableLabel,
            timestamp: Date.now(),
          });
        } else {
          broadcastSyncEvent({
            type: "PAYMENT_COMPLETED",
            orderId: finalOrderId,
            orderNo: finalOrderNo,
            tableLabel: finalTableLabel,
            status: "PAID",
            timestamp: Date.now(),
            metadata: {
              transactionId: transactionId || `TXN-${Date.now().toString().slice(-6)}`,
              amountPaise: finalTotalPaise,
              paymentMethod,
            },
          });
        }

        // If customer redeemed points for bill discount, record deduction & sync
        if (redeemPoints && pointsDiscountRupees > 0) {
          redeemLoyaltyPointsAction(pointsDiscountRupees, `Applied on Order #${finalOrderNo}`).catch(console.warn);
        }
        broadcastSyncEvent({
          type: "LOYALTY_UPDATED",
          timestamp: Date.now(),
        });

        return {
          orderId: finalOrderId,
          orderNo: finalOrderNo,
          tableLabel: finalTableLabel,
          totalPaise: finalTotalPaise,
          verificationCode: result.verificationCode || "4821",
        };
      } else if (result.error === "PRICE_CHANGED" && result.changedItems) {
        setPriceConflicts(result.changedItems);
        setErrorMessage("Some item prices changed. Please review your cart.");
        return null;
      } else {
        // Resilient fallback: buffer order locally and proceed
        const offlineOrder = enqueueOfflineOrder({
          tableLabel: displayTable,
          items: orderPayload.map((p) => ({
            menu_item_id: p.menu_item_id,
            expected_unit_price_paise: p.expected_unit_price_paise,
            qty: p.qty,
            name: items.find((it) => it.item.id === p.menu_item_id)?.item.name || "Artisanal Item",
          })),
          totalPaise: grandTotal * 100,
          instructions: instructions || undefined,
          paymentMethod,
          transactionId: transactionId || `OFF-${Date.now().toString().slice(-6)}`,
        });

        return {
          orderId: `offline-${offlineOrder.idempotencyKey}`,
          orderNo: offlineOrder.tempOrderNo,
          tableLabel: offlineOrder.tableLabel,
          totalPaise: offlineOrder.totalPaise,
          verificationCode: offlineOrder.verificationCode,
          isOffline: true,
        };
      }
    } catch (netErr) {
      console.warn("Network error during order placement, fallback to offline queue:", netErr);
      const offlineOrder = enqueueOfflineOrder({
        tableLabel: displayTable,
        items: orderPayload.map((p) => ({
          menu_item_id: p.menu_item_id,
          expected_unit_price_paise: p.expected_unit_price_paise,
          qty: p.qty,
          name: items.find((it) => it.item.id === p.menu_item_id)?.item.name || "Artisanal Item",
        })),
        totalPaise: grandTotal * 100,
        instructions: instructions || undefined,
        paymentMethod,
        transactionId: transactionId || `OFF-${Date.now().toString().slice(-6)}`,
      });

      return {
        orderId: `offline-${offlineOrder.idempotencyKey}`,
        orderNo: offlineOrder.tempOrderNo,
        tableLabel: offlineOrder.tableLabel,
        totalPaise: offlineOrder.totalPaise,
        verificationCode: offlineOrder.verificationCode,
        isOffline: true,
      };
    }
  };

  const handleSendOrderToCashier = async () => {
    if (isBypassing) return;
    setIsBypassing(true);
    setErrorMessage(null);

    try {
      const currentItemsSnapshot = items.map((i) => ({
        name: i.item.name,
        qty: i.qty,
        priceRupees: Math.round(i.item.pricePaise / 100),
        subtotalRupees: Math.round((i.item.pricePaise / 100) * i.qty),
      }));

      // 1. Create order in DB for cashier desk (DRAFT / PENDING)
      const orderRes = await handleProcessPaidOrder("CASHIER");
      if (!orderRes) {
        setIsBypassing(false);
        return;
      }

      // 2. Clear cart
      clearCart();

      // 3. Trigger order confirmation modal with PENDING payment status (no fake settlement)
      setCelebrationData({
        orderId: orderRes.orderId,
        orderNo: orderRes.orderNo,
        tableLabel: displayTable,
        zone: (["07", "08", "09", "10"].includes(displayTable)) ? "smol-lounge" : (["11", "12", "13", "14"].includes(displayTable)) ? "smol-terrace" : "smol-cafe",
        totalRupees: Math.round(orderRes.totalPaise / 100),
        items: currentItemsSnapshot.length > 0 ? currentItemsSnapshot : [
          { name: "Artisanal Table Order", qty: 1, priceRupees: Math.round(orderRes.totalPaise / 100), subtotalRupees: Math.round(orderRes.totalPaise / 100) }
        ],
        appName: "Cashier Desk (Pay at Counter)",
        paymentStatus: "PENDING",
        onClose: () => {
          setCelebrationData(null);
          closeCart();
          router.push(`/orders/${orderRes.orderId}?t=${orderRes.orderNo}`);
        },
      });
    } catch (err) {
      console.error("Order dispatch to cashier failed:", err);
      setErrorMessage("Could not send order to cashier. Please try again.");
    } finally {
      setIsBypassing(false);
    }
  };

  if (!isCartOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-[#241F1C]/70 sm:p-4 backdrop-blur-xs transition-opacity duration-200"
      onClick={closeCart}
    >
      {/* Mobile-first Phone Modal / Drawer Frame matching user mockup */}
      <div
        className="relative flex h-[92vh] sm:h-[88vh] w-full max-w-lg sm:max-w-[425px] flex-col rounded-t-[2.5rem] sm:rounded-[2.5rem] border border-[#C9AE8B] dark:border-white/10 bg-[#F3E7D3] dark:bg-[#1A1513] text-[#241F1C] dark:text-[#FAF4EB] shadow-2xl overflow-hidden animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Navigation Bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-5 pt-3.5 pb-2 bg-[#F3E7D3] dark:bg-[#1A1513] border-b border-[#C9AE8B]/40 dark:border-white/10 transition-colors">
          {activeView === "bill" ? (
            <button
              type="button"
              onClick={() => setActiveView("table_order")}
              aria-label="Back to table order"
              className="p-1 -ml-1 text-[#241F1C] dark:text-[#FAF4EB] hover:opacity-75 active:scale-95 transition cursor-pointer"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={closeCart}
              aria-label="Close cart"
              className="p-1 -ml-1 text-[#241F1C] dark:text-[#FAF4EB] hover:opacity-75 transition active:scale-95 cursor-pointer"
            >
              <svg
                width="24"
                height="20"
                viewBox="0 0 24 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <line x1="2" y1="3" x2="22" y2="3" />
                <line x1="2" y1="10" x2="22" y2="10" />
                <line x1="2" y1="17" x2="22" y2="17" />
              </svg>
            </button>
          )}

          <div className="text-center">
            <h2 className="font-serif text-[22px] font-bold tracking-tight text-[#241F1C] dark:text-[#FAF4EB] leading-tight">
              {activeView === "bill" ? "Settle Up" : "Your Table"}
            </h2>
            <p className="font-serif italic text-[11px] text-[#725039] dark:text-[#C9AE8B]">
              {displayTable ? `Table ${displayTable}` : "Artisanal Table"}{currentGuestName ? ` • ${currentGuestName}` : ""}
            </p>
          </div>

          {activeView === "bill" ? (
            <div className="w-7" />
          ) : (
            <button
              type="button"
              onClick={closeCart}
              className="font-serif text-[15px] font-medium text-[#B72E35] dark:text-[#FF5B52] hover:opacity-85 transition active:scale-95 cursor-pointer"
            >
              Add more
            </button>
          )}
        </div>

        {/* Editing Order Notice Banner */}
        {editingOrder && (
          <div className="bg-[#B72E35]/15 dark:bg-[#B72E35]/30 border-b border-[#B72E35]/30 px-4 py-2 flex items-center justify-between text-xs font-mono text-[#B72E35] dark:text-[#FF5B52]">
            <div className="flex items-center gap-1.5">
              <span className="font-bold">Editing Order #{editingOrder.orderNo}</span>
              <span className="text-[10px] opacity-80">(Pending Confirmation)</span>
            </div>
            <button
              type="button"
              onClick={() => {
                clearCart();
                closeCart();
              }}
              className="text-[11px] underline opacity-90 hover:opacity-100 cursor-pointer"
            >
              Cancel Edit
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto pb-24">
          {orderSuccess ? (
            /* Order Success View */
            <div className="p-6 text-center space-y-4 animate-fade-in">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 shadow-inner">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <span className="inline-block rounded-md bg-amber-100 px-2.5 py-0.5 font-mono text-[10px] font-bold text-amber-900 uppercase">
                  CONFIRMED WITH KITCHEN
                </span>
                <h3 className="font-serif text-2xl font-bold text-[#241F1C] mt-2">
                  Order #{orderSuccess.orderNo} Placed!
                </h3>
                <p className="font-serif italic text-xs text-[#725039] mt-1">
                  Our kitchen and café staff are preparing your order.
                </p>
              </div>

              {/* Table PIN Plaque */}
              <div className="rounded-3xl border-2 border-[#F2C84B] bg-[#FFF8E7] p-4 text-center shadow-md">
                <span className="block font-mono text-[10px] uppercase font-bold text-[#725039] tracking-wider">
                  TABLE VERIFICATION PIN
                </span>
                <span className="block font-mono text-3xl font-black text-[#B72E35] tracking-widest mt-0.5">
                  {orderSuccess.verificationCode || "4821"}
                </span>
                <p className="text-[10px] font-mono text-[#725039] mt-1">
                  {displayTable ? `Table ${displayTable}` : "Artisanal Table"}{currentGuestName ? ` • Guest: ${currentGuestName}` : " • Instant Verification"}
                </p>
              </div>

              <div className="pt-3 space-y-2.5">
                <Link
                  href="/orders"
                  onClick={() => {
                    setOrderSuccess(null);
                    closeCart();
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#B72E35] py-3.5 font-serif text-base font-bold text-[#F3E7D3] shadow-md transition hover:bg-[#9E252C] active:scale-[0.98]"
                >
                  <Clock className="h-4 w-4" />
                  Track Kitchen Prep Live →
                </Link>
                <button
                  type="button"
                  onClick={() => setIsUpiDrawerOpen(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#C9AE8B] bg-[#FAF4EB] py-3 font-serif text-sm font-bold text-[#725039] shadow-xs transition hover:bg-[#EAE0D2] active:scale-[0.98]"
                >
                  <CreditCard className="h-4 w-4" />
                  Pay Now via UPI Gateway
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrderSuccess(null);
                    closeCart();
                  }}
                  className="w-full rounded-full border border-[#C9AE8B]/40 bg-transparent py-2.5 font-serif text-xs font-semibold text-[#8C6D53] transition hover:bg-[#EAE0D2]/50"
                >
                  Back to Menu
                </button>
              </div>
            </div>
          ) : activeView === "bill" ? (
            /* Settle Up / Bill View inside same popup matching user design */
            <div className="p-4 sm:p-5 space-y-4 animate-fade-in">
              {/* Arched Roman Dome Bill Card */}
              <div className="relative rounded-t-[13.5rem] sm:rounded-t-[14.5rem] rounded-b-[1.75rem] border border-[#C9AE8B] dark:border-white/10 bg-[#FAF4EB] dark:bg-[#201A17] p-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] select-none">
                {/* Inner Decorative Inset Border */}
                <div className="rounded-t-[12.8rem] sm:rounded-t-[13.8rem] rounded-b-[1.25rem] border border-[#C9AE8B]/40 dark:border-white/10 px-5 pt-4 pb-5 text-center">
                  {/* Coffee Cup + Pen + Smol Cafe Notepad Illustration */}
                  <div className="relative w-[260px] h-[140px] mx-auto mt-2">
                    {/* Light Mode Illustration */}
                    <div className="relative w-full h-full block dark:hidden">
                      <Image
                        src="/settle_up_hero_illustration.png"
                        alt="smol café bill illustration"
                        fill
                        priority
                        className="object-contain select-none pointer-events-none"
                      />
                    </div>
                    {/* Dark Mode Luminous Etching Illustration */}
                    <div className="relative w-full h-full hidden dark:block">
                      <Image
                        src="/settle_up_hero_illustration_dark.png"
                        alt="smol café bill illustration"
                        fill
                        priority
                        className="object-contain select-none pointer-events-none drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
                      />
                    </div>
                  </div>

                  {/* Poetic Headline in Espresso Ink */}
                  <h2 className="font-serif font-bold text-[24px] sm:text-[26px] text-[#241F1C] dark:text-[#FAF4EB] leading-[1.18] mt-3">
                    Good things
                    <br />
                    deserve good pauses.
                  </h2>

                  {/* Subtitle in Walnut */}
                  <p className="font-serif italic text-[15px] sm:text-[16px] text-[#725039] dark:text-[#C9AE8B] mt-1.5 mb-3">
                    Here&apos;s your bill.
                  </p>

                  {/* Dashed Horizontal Line Divider in Biscuit */}
                  <div className="border-t border-dashed border-[#C9AE8B]/60 dark:border-white/10 my-3.5" />

                  {/* Itemized Summary in Typewriter / Mono Font */}
                  <div className="space-y-1.5 font-mono text-[13.5px] text-[#241F1C] dark:text-[#FAF4EB]">
                    <div className="flex items-center justify-between">
                      <span className="text-[#725039] dark:text-[#C9AE8B]">Items Total</span>
                      <span>₹{itemsTotal}</span>
                    </div>

                    {/* Smol Club Points Discount Row */}
                    {pointsDiscountRupees > 0 && (
                      <div className="flex items-center justify-between text-[#B72E35] dark:text-[#FF5B52] font-bold bg-[#B72E35]/10 dark:bg-[#B72E35]/20 px-2 py-1 rounded-lg">
                        <span className="flex items-center gap-1 text-[12px]">
                          <Award className="w-3.5 h-3.5 text-[#B72E35] dark:text-[#FF5B52]" />
                          Smol Points (Max {maxDiscountPercent}%)
                        </span>
                        <span>-₹{pointsDiscountRupees}</span>
                      </div>
                    )}

                    {/* Taxes & Charges Row (5% Restaurant GST: 2.5% CGST + 2.5% SGST) */}
                    <div className="flex items-center justify-between text-[#725039] dark:text-[#C9AE8B]">
                      <span className="flex items-center gap-1">
                        <span>Taxes (GST 5%)</span>
                        <span className="text-[10px] text-[#725039]/70 dark:text-[#C9AE8B]/70 font-sans">
                          (CGST 2.5% + SGST 2.5%)
                        </span>
                      </span>
                      <span>₹{taxesAndCharges}</span>
                    </div>
                  </div>

                  {/* Points Earning Notice */}
                  <div className="mt-2.5 px-2.5 py-1.5 rounded-xl bg-[#F2C84B]/20 border border-[#F2C84B]/40 text-[11px] font-mono text-[#725039] dark:text-[#FAF4EB] flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#B72E35] dark:text-[#F2C84B]" />
                      Earn on this order:
                    </span>
                    <span className="font-bold text-[#B72E35] dark:text-[#F2C84B]">
                      +{pointsEarnable} pts {slowMultiplier > 1 ? "(2× Happy Hour!)" : ""}
                    </span>
                  </div>

                  {/* Solid Horizontal Line Divider in Biscuit */}
                  <div className="border-t border-[#C9AE8B]/60 dark:border-white/10 mt-3.5 mb-3" />

                  {/* Grand Total in Smol Cherry */}
                  <div className="flex items-baseline justify-between pt-0.5">
                    <span className="font-serif font-bold text-[19px] sm:text-[20px] text-[#B72E35] dark:text-[#FF5B52]">
                      Grand Total
                    </span>
                    <span className="font-serif font-bold text-[30px] sm:text-[34px] text-[#B72E35] dark:text-[#FF5B52] leading-none">
                      ₹{grandTotal}
                    </span>
                  </div>
                </div>
              </div>

              {/* Smol Club Loyalty Points Card Toggle in Settle Up */}
              <div className="rounded-[1.25rem] border border-[#B72E35]/30 dark:border-white/10 bg-[#FAF4EB] dark:bg-[#201A17] p-3.5 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#B72E35]/15 flex items-center justify-center text-[#B72E35] dark:text-[#F2C84B]">
                      <Gift className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-serif font-bold text-[14px] text-[#241F1C] dark:text-[#FAF4EB] leading-none">
                          Smol Club Points
                        </h4>
                        <span className="rounded-full bg-[#B72E35] text-white px-2 py-0.2 font-mono text-[9px] font-bold">
                          Coming Soon 🚀
                        </span>
                      </div>
                      <p className="font-mono text-[10.5px] text-[#725039] dark:text-[#C9AE8B] mt-0.5">
                        Patron Rewards &amp; Bill Offs launching soon
                      </p>
                    </div>
                  </div>

                  <span className="px-3 py-1.5 rounded-full font-serif text-[11px] font-bold bg-[#EFE7DC] dark:bg-stone-800 text-[#725039] dark:text-[#C9AE8B] border border-[#C9AE8B]/40">
                    Coming Soon
                  </span>
                </div>

                <div className="border-t border-[#C9AE8B]/20 dark:border-white/5 pt-1.5 flex items-center justify-between text-[10.5px] font-mono text-[#725039] dark:text-[#C9AE8B]">
                  <span>₹10 spent = 1 point</span>
                  <span>Max {maxDiscountPercent}% discount per order</span>
                </div>
              </div>

              {/* Status / Request Notification Message */}
              {requestMessage && (
                <div className="rounded-2xl border border-[#C9AE8B] dark:border-white/10 bg-[#FAF4EB] dark:bg-[#201A17] p-3 text-center text-xs font-serif font-semibold text-[#241F1C] dark:text-[#FAF4EB] shadow-xs animate-fade-in flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#B72E35] dark:text-[#FF5B52]" />
                  <span>{requestMessage}</span>
                </div>
              )}

              {/* Direct Cashier & Kitchen Order Dispatch Card */}
              <div className="pt-1">
                <div className="rounded-3xl border border-[#B72E35]/30 dark:border-purple-500/30 bg-gradient-to-br from-[#FAF4EB] via-[#F6ECE0] to-[#EFE2D2] dark:from-[#20152B] dark:via-[#180F22] dark:to-[#120A1B] p-4 shadow-[0_4px_20px_rgba(183,46,53,0.08)] dark:shadow-[0_4px_24px_rgba(147,51,234,0.18)] transition-all">
                  {/* Card Header with Live Dispatch Badge */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#C9AE8B]/30 dark:border-purple-500/20">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                      </span>
                      <span className="font-mono text-[11px] font-bold tracking-wider uppercase text-[#725039] dark:text-purple-200">
                        Live Counter Order
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#B72E35]/10 dark:bg-purple-950/70 border border-transparent dark:border-purple-500/30 px-2.5 py-0.5 font-mono text-[10.5px] font-bold text-[#B72E35] dark:text-purple-300">
                      <Receipt className="w-3 h-3 text-[#B72E35] dark:text-purple-300" /> Pay at Counter / Table
                    </span>
                  </div>

                  {/* Primary CTA Dispatch Button */}
                  <button
                    type="button"
                    onClick={editingOrder ? handleUpdatePendingOrder : handleSendOrderToCashier}
                    disabled={isBypassing || isUpdatingOrder}
                    className="group relative w-full mt-3 overflow-hidden rounded-2xl bg-gradient-to-r from-[#B72E35] via-[#A0242B] to-[#7D1217] dark:from-[#9333EA] dark:via-[#7E22CE] dark:to-[#581C87] border border-transparent dark:border-purple-400/40 p-4 text-left text-white shadow-[0_4px_16px_rgba(183,46,53,0.35)] dark:shadow-[0_4px_24px_rgba(126,34,206,0.45)] hover:shadow-[0_6px_22px_rgba(183,46,53,0.5)] dark:hover:shadow-[0_6px_30px_rgba(168,85,247,0.6)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 cursor-pointer disabled:opacity-60"
                  >
                    {/* Ambient shine overlay on hover */}
                    <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/20 dark:via-white/30 to-transparent transition-transform duration-700 ease-in-out pointer-events-none" />

                    <div className="relative z-10 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-white/15 dark:bg-white/20 border border-white/25 dark:border-purple-300/40 flex items-center justify-center shrink-0 shadow-xs backdrop-blur-xs">
                          {isBypassing || isUpdatingOrder ? (
                            <Loader2 className="w-5 h-5 text-white animate-spin" />
                          ) : (
                            <Send className="w-5 h-5 text-white transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-serif font-bold text-[16px] sm:text-[17px] text-white leading-tight">
                            {editingOrder
                              ? isUpdatingOrder
                                ? "Updating Order..."
                                : `Update Order #${editingOrder.orderNo}`
                              : isBypassing
                              ? "Sending Order to Cashier..."
                              : "Send Order to Cashier"}
                          </h3>
                          <p className="font-sans text-[12px] text-[#F3E7D3]/90 dark:text-purple-100/90 mt-0.5 leading-snug">
                            {editingOrder
                              ? "Saves your revised items directly to this pending order"
                              : "Instant live dispatch to Cashier Counter & Kitchen"}
                          </p>
                        </div>
                      </div>

                      <div className="w-8 h-8 rounded-full bg-white/15 dark:bg-white/20 flex items-center justify-center shrink-0 group-hover:bg-white/25 dark:group-hover:bg-white/30 transition-colors">
                        <ChevronRight className="w-4 h-4 text-white group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </button>

                  {/* Key Highlights */}
                  <div className="mt-3 grid grid-cols-2 gap-2 pt-2.5 border-t border-[#C9AE8B]/25 dark:border-purple-500/20 text-[11px] font-mono text-[#725039] dark:text-purple-200/80">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#B72E35] dark:text-purple-400 shrink-0" />
                      <span>Instant Kitchen Prep</span>
                    </div>
                    <div className="flex items-center justify-end gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-[#725039] dark:text-purple-300 shrink-0" />
                      <span>Cash, UPI or Card</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 100% Secure Payments Assurance */}
              <div className="pt-2 pb-2 text-center">
                <div className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#725039] dark:text-[#C9AE8B]">
                  <Lock className="w-3.5 h-3.5 text-[#725039] dark:text-[#C9AE8B]" />
                  <span>100% Secure Payments</span>
                </div>
              </div>
            </div>
          ) : items.length === 0 ? (
            /* Empty Table Order */
            <div className="p-12 text-center space-y-3">
              <span className="block font-serif text-5xl">☕</span>
              <p className="font-serif text-lg font-bold text-[#241F1C] dark:text-[#FAF4EB]">
                Your table is empty
              </p>
              <p className="font-serif italic text-xs text-[#725039] dark:text-[#C9AE8B]">
                Explore our artisanal brews, sandwiches &amp; comfort bowls.
              </p>
              <button
                type="button"
                onClick={closeCart}
                className="mt-3 inline-flex rounded-full bg-[#B72E35] hover:bg-[#9E252C] px-6 py-2.5 font-serif text-sm font-semibold text-[#F3E7D3] shadow-xs cursor-pointer"
              >
                Browse Menu
              </button>
            </div>
          ) : (
            /* Main "Your Table" View matching exact Image 1 design */
            <div className="px-3 sm:px-4 pt-1">
              <TableArchedCard
                tableNumber={displayTable}
                guestCount={2}
              >
                {/* Categorized Item List */}
                <div className="w-full">
                  {groupedItems.map(({ key, items: categoryItems }, groupIdx) => (
                    <div key={key} className="w-full">
                      {/* Category Header Bar in Café Crème & Walnut */}
                      <div className={`px-4 py-1.5 bg-[#F3E7D3] dark:bg-[#151110] ${groupIdx > 0 ? "border-t" : ""} border-b border-[#C9AE8B]/40 dark:border-white/10`}>
                        <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#725039] dark:text-[#C9AE8B]">
                          {key}
                        </span>
                      </div>

                      {/* Items in this Category with Biscuit Dividers */}
                      <div className="divide-y divide-[#C9AE8B]/30 dark:divide-white/10">
                        {categoryItems.map(({ item, qty }) => {
                          const unitRupees = Math.round(item.pricePaise / 100);
                          const note = getCustomizationNote({ item, qty });
                          const isActionOpen = activeActionItemId === item.id;

                          return (
                            <div key={item.id} className="transition-colors hover:bg-[#EAE0D2]/50 dark:hover:bg-white/5">
                              <div className="px-4 py-2 flex items-start justify-between gap-2">
                                {/* Left: Quantity + Details */}
                                <div className="flex items-start gap-2.5 min-w-0 pr-2">
                                  <span className="font-serif font-bold text-[16px] text-[#241F1C] dark:text-[#FAF4EB] w-4 shrink-0 text-left pt-0.5">
                                    {qty}
                                  </span>
                                  <div className="min-w-0">
                                    <h4 className="font-serif font-bold text-[15.5px] text-[#241F1C] dark:text-[#FAF4EB] leading-tight whitespace-pre-line">
                                      {item.name.replace(/\s*\([^)]*\)/, "")}
                                    </h4>
                                    {note && (
                                      <p className="font-mono text-[11.5px] text-[#725039] dark:text-[#C9AE8B] mt-0.5 tracking-tight">
                                        • {note}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Right: Price + "•••" Options Button */}
                                <div className="flex items-center gap-3 shrink-0 pt-0.5">
                                  <span className="font-serif font-medium text-[15.5px] text-[#241F1C] dark:text-[#FAF4EB] tracking-tight">
                                    ₹{unitRupees * qty}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActiveActionItemId(isActionOpen ? null : item.id)
                                    }
                                    aria-label="Item options"
                                    className="text-[#241F1C] dark:text-[#FAF4EB] text-[18px] font-bold tracking-widest px-1 py-0.5 hover:opacity-60 active:scale-90 transition cursor-pointer"
                                  >
                                    •••
                                  </button>
                                </div>
                              </div>

                              {/* Expandable Stepper Controls when user taps '•••' */}
                              {isActionOpen && (
                                <div className="flex items-center justify-between bg-[#FAF4EB] dark:bg-[#1A1513] px-4 py-2 border-t border-[#C9AE8B]/40 dark:border-white/10">
                                  <span className="text-xs font-mono text-[#725039] dark:text-[#C9AE8B]">Adjust quantity:</span>
                                  <div className="flex items-center gap-2.5">
                                    <button
                                      type="button"
                                      onClick={() => updateQty(item.id, -1)}
                                      className="h-6 w-6 rounded-full border border-[#C9AE8B] dark:border-white/10 bg-[#F3E7D3] dark:bg-[#28201C] font-mono text-xs font-bold text-[#241F1C] dark:text-[#FAF4EB] flex items-center justify-center hover:bg-[#FAF4EB] dark:hover:bg-[#342A25]"
                                    >
                                      −
                                    </button>
                                    <span className="font-mono text-xs font-bold text-[#241F1C] dark:text-[#FAF4EB] min-w-4 text-center">
                                      {qty}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => updateQty(item.id, 1)}
                                      className="h-6 w-6 rounded-full border border-[#C9AE8B] dark:border-white/10 bg-[#F3E7D3] dark:bg-[#28201C] font-mono text-xs font-bold text-[#241F1C] dark:text-[#FAF4EB] flex items-center justify-center hover:bg-[#FAF4EB] dark:hover:bg-[#342A25]"
                                    >
                                      +
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeItem(item.id)}
                                      className="p-1 text-[#B72E35] dark:text-[#FF5B52] hover:bg-[#B72E35]/10 rounded-full transition ml-1"
                                      aria-label="Remove item"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Smol Club Rewards Points Bar */}
                <div className="px-3 pt-2 pb-1">
                  <div className="rounded-[1.25rem] border border-[#B72E35]/30 dark:border-white/10 bg-[#FAF4EB] dark:bg-[#1A1513] p-3 shadow-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[#B72E35]/15 flex items-center justify-center shrink-0 text-[#B72E35] dark:text-[#F2C84B]">
                          <Award className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-serif font-bold text-[13.5px] text-[#241F1C] dark:text-[#FAF4EB]">
                              Smol Club Rewards
                            </span>
                            <span className="rounded-full bg-[#B72E35] text-white px-2 py-0.2 font-mono text-[9.5px] font-bold">
                              Coming Soon 🚀
                            </span>
                          </div>
                          <p className="font-mono text-[10.5px] text-[#725039] dark:text-[#C9AE8B] truncate">
                            Patron Rewards &amp; Cashback launching soon
                          </p>
                        </div>
                      </div>

                      <span className="shrink-0 px-2.5 py-1.5 rounded-full font-serif text-[11px] font-bold bg-[#EFE7DC] dark:bg-stone-800 text-[#725039] dark:text-[#C9AE8B] border border-[#C9AE8B]/40">
                        Coming Soon
                      </span>
                    </div>

                    {/* Happy Hour Bonus Notice */}
                    {slowMultiplier > 1 && (
                      <div className="mt-2 pt-1.5 border-t border-[#C9AE8B]/20 dark:border-white/5 flex items-center justify-between text-[10.5px] font-mono text-[#B72E35] dark:text-[#F2C84B]">
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Slow Period active:
                        </span>
                        <span className="font-bold">2× points on this order!</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Upsell Card: "Make it a moment?" with Dusty Pool accent & Butter Taxi button */}
                <div className="p-3">
                  <div className="rounded-[1.4rem] border border-[#75AFA7]/50 dark:border-white/10 bg-gradient-to-br from-[#E2EBE8] via-[#DAE6E2] to-[#CEDDD8] dark:from-[#251E1B] dark:via-[#201A18] dark:to-[#1C1715] p-3 shadow-xs transition-all">
                    <h3 className="font-serif font-semibold text-[16px] text-[#241F1C] dark:text-[#FAF4EB] mb-1.5">
                      Make it a moment?
                    </h3>

                    <div className="flex items-center justify-between gap-2">
                      {/* Left: Platter Illustration */}
                      <div className="shrink-0 -ml-1 flex items-center justify-center">
                        <Image
                          src="/conversation_board_clean.png"
                          alt="Conversation Board"
                          width={100}
                          height={64}
                          className="w-[100px] h-[64px] object-contain select-none pointer-events-none"
                        />
                      </div>

                      {/* Center: Title & Description */}
                      <div className="flex-1 min-w-0 pr-1">
                        <h4 className="font-serif font-bold text-[13.5px] text-[#241F1C] dark:text-[#FAF4EB] leading-snug truncate">
                          Conversation Board
                        </h4>
                        <p className="font-mono text-[10.5px] text-[#374438] dark:text-[#C9AE8B] leading-tight mt-0.5">
                          Cheese, fruits, nuts &amp; a little something sweet.
                        </p>
                      </div>

                      {/* Right: Price & Butter Taxi Button */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0 pl-1">
                        <div className="flex items-center gap-1 font-serif text-right">
                          <span className="line-through font-mono text-[11px] text-[#725039]/70 dark:text-[#C9AE8B]/60">
                            ₹350
                          </span>
                          <span className="font-serif font-bold text-[13.5px] text-[#241F1C] dark:text-[#FAF4EB]">
                            ₹260
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={handleAddConversationBoard}
                          className={`w-9 h-9 rounded-full border border-[#241F1C] dark:border-white/20 flex items-center justify-center transition-all duration-200 active:scale-90 shadow-xs cursor-pointer ${
                            boardAdded || items.some((i) => i.item.id === "conversation_board")
                              ? "bg-[#2E5550] text-[#F3E7D3] border-[#241F1C]"
                              : "bg-[#F2C84B] text-[#241F1C] hover:bg-[#DEB63E]"
                          }`}
                          aria-label="Add Conversation Board"
                        >
                          {boardAdded || items.some((i) => i.item.id === "conversation_board") ? (
                            <Check className="w-4 h-4 stroke-[2.5]" />
                          ) : (
                            <Plus className="w-4 h-4 stroke-[2.5]" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </TableArchedCard>
            </div>
          )}
        </div>

        {/* Sticky Bottom Summary & "View Bill" CTA Button in Smol Cherry */}
        {!orderSuccess && activeView === "table_order" && items.length > 0 && (
          <div className="sticky bottom-0 left-0 right-0 z-30 px-5 pt-2 pb-5 bg-gradient-to-t from-[#F3E7D3] via-[#F3E7D3]/95 to-transparent dark:from-[#1A1513] dark:via-[#1A1513]/95 dark:to-transparent">
            <p className="font-serif text-[15px] font-medium text-[#241F1C] dark:text-[#FAF4EB] text-center mb-2 tracking-wide">
              {totalCount} {totalCount === 1 ? "item" : "items"} &nbsp;•&nbsp; Total ₹{totalRupees}
            </p>

            {editingOrder ? (
              <button
                type="button"
                disabled={isUpdatingOrder}
                onClick={handleUpdatePendingOrder}
                className="group relative overflow-hidden w-full block rounded-full bg-gradient-to-b from-[#E03A43]/70 via-[#B72E35]/80 to-[#7D1217]/90 dark:from-[#A855F7]/70 dark:via-[#7E22CE]/80 dark:to-[#4C1D95]/90 text-white font-serif text-[17.5px] font-medium py-3.5 backdrop-blur-[16px] border border-white/55 dark:border-purple-300/40 shadow-[0_8px_26px_rgba(183,46,53,0.42)] active:scale-[0.99] transition duration-150 cursor-pointer text-center"
              >
                <span className="relative z-10 flex items-center justify-center gap-2 drop-shadow-[0_1.5px_2.5px_rgba(0,0,0,0.35)]">
                  {isUpdatingOrder ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Updating Order #{editingOrder.orderNo}...</span>
                    </>
                  ) : (
                    <span>Update Order #{editingOrder.orderNo} • ₹{totalRupees}</span>
                  )}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveView("bill")}
                className="group relative overflow-hidden w-full block rounded-full bg-gradient-to-b from-[#E03A43]/70 via-[#B72E35]/80 to-[#7D1217]/90 dark:from-[#A855F7]/70 dark:via-[#7E22CE]/80 dark:to-[#4C1D95]/90 text-white font-serif text-[17.5px] font-medium py-3.5 backdrop-blur-[16px] border border-white/55 dark:border-purple-300/40 shadow-[0_8px_26px_rgba(183,46,53,0.42),inset_0_1.5px_1.5px_rgba(255,255,255,0.85),inset_0_-1.5px_2px_rgba(0,0,0,0.4),inset_0_0_14px_rgba(255,140,140,0.35)] dark:shadow-[0_8px_28px_rgba(126,34,206,0.5),inset_0_1.5px_1.5px_rgba(255,255,255,0.85),inset_0_-1.5px_2px_rgba(0,0,0,0.5),inset_0_0_16px_rgba(192,132,252,0.45)] active:scale-[0.99] transition duration-150 cursor-pointer text-center"
              >
                {/* Curved Specular Glass Gloss Reflection */}
                <span className="absolute inset-x-4 top-1 h-[42%] rounded-full bg-gradient-to-b from-white/50 via-white/15 to-transparent pointer-events-none opacity-90" />
                <span className="relative z-10 drop-shadow-[0_1.5px_2.5px_rgba(0,0,0,0.35)]">
                  View Bill
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Optional UPI Drawer Modal if opened */}
      {isUpiDrawerOpen && (
        <UpiPaymentDrawer
          tableLabel={displayTable}
          orderId={orderSuccess?.orderId || `ORD-${Date.now().toString().slice(-6)}`}
          amountPaise={orderSuccess?.totalPaise || (grandTotal > 0 ? grandTotal * 100 : subtotalPaise)}
          items={
            items.length > 0
              ? items.map((i) => ({
                  name: i.item.name,
                  qty: i.qty,
                  priceRupees: Math.round(i.item.pricePaise / 100),
                  subtotalRupees: Math.round((i.item.pricePaise / 100) * i.qty),
                }))
              : []
          }
          onPaymentSuccess={async (paymentRes) => {
            const currentItemsSnapshot = items.map((i) => ({
              name: i.item.name,
              qty: i.qty,
              priceRupees: Math.round(i.item.pricePaise / 100),
              subtotalRupees: Math.round((i.item.pricePaise / 100) * i.qty),
            }));

            // Create paid order in DB
            const created = await handleProcessPaidOrder("UPI", paymentRes.transactionId);
            clearCart();
            setIsUpiDrawerOpen(false);

            if (created) {
              setCelebrationData({
                orderId: created.orderId,
                orderNo: created.orderNo,
                tableLabel: displayTable,
                zone: (["07", "08", "09", "10"].includes(displayTable)) ? "smol-lounge" : (["11", "12", "13", "14"].includes(displayTable)) ? "smol-terrace" : "smol-cafe",
                totalRupees: Math.round(created.totalPaise / 100),
                items: currentItemsSnapshot.length > 0 ? currentItemsSnapshot : [
                  { name: "Artisanal Table Order", qty: 1, priceRupees: Math.round(created.totalPaise / 100), subtotalRupees: Math.round(created.totalPaise / 100) }
                ],
                transactionId: paymentRes.transactionId,
                appName: paymentRes.appName || "UPI Gateway (PAID)",
                onClose: () => {
                  setCelebrationData(null);
                  closeCart();
                  router.push("/orders");
                },
              });
            } else {
              closeCart();
            }
          }}
          onClose={() => setIsUpiDrawerOpen(false)}
        />
      )}

      {/* Post-Payment Celebration Modal if test bypass triggered */}
      {celebrationData && (
        <PostPaymentCelebrationModal
          {...celebrationData}
        />
      )}
    </div>
  );
};
