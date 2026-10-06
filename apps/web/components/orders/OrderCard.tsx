"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import type { CustomerOrderDetails } from "@/app/orders/actions";
import { OrderStatusProgress } from "./OrderStatusProgress";
import { Clock, Receipt } from "lucide-react";
import { OrderReceiptModal } from "./OrderReceiptModal";
import type { InvoiceReceiptData } from "@/lib/print";

interface OrderCardProps {
  order: CustomerOrderDetails;
  tableLabel?: string;
  guestName?: string;
}

interface StatusCopy {
  title: string;
  subtitle: string;
  badgeColor: string;
}

function getStatusCopy(status: string): StatusCopy {
  switch (status) {
    case "PENDING_CONFIRMATION":
    case "SUBMITTED":
    case "DRAFT":
      return {
        title: "Awaiting Cashier Approval",
        subtitle: "Order sent to cashier desk! Verification & payment pending.",
        badgeColor:
          "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700/50",
      };
    case "CONFIRMED":
    case "ACCEPTED":
      return {
        title: "Order Confirmed",
        subtitle: "Payment successful (PAID)! Order confirmed and sent to kitchen.",
        badgeColor:
          "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/50",
      };
    case "PREPARING":
      return {
        title: "Preparing Your Order",
        subtitle: "Your coffee is brewing and your food is on the kitchen grill.",
        badgeColor:
          "bg-[#F2C84B]/30 text-[#725039] dark:text-[#F2C84B] border-[#C9AE8B]",
      };
    case "READY":
      return {
        title: "Order is Ready!",
        subtitle:
          "Fresh & piping hot! Staff is delivering directly to your table.",
        badgeColor:
          "bg-[#75AFA7]/30 text-[#1C463F] dark:text-[#75AFA7] border-[#75AFA7]/60",
      };
    case "COMPLETED":
    case "SERVED":
    case "CLOSED":
      return {
        title: "Delivered to Table",
        subtitle: "Delivered to your table. Hope you enjoy your time at smol café!",
        badgeColor:
          "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-700/60 shadow-2xs",
      };
    case "CANCELLED":
    case "REJECTED":
      return {
        title: "Order Cancelled by Cashier",
        subtitle: "This order was cancelled by the cashier desk.",
        badgeColor:
          "bg-[#B72E35]/15 text-[#B72E35] border-[#B72E35]/30 dark:bg-red-950/40 dark:text-red-300",
      };
    default:
      return {
        title: "Processing Order",
        subtitle: "Your order is in progress.",
        badgeColor: "bg-white/60 text-[#725039] border-white/60 dark:bg-white/10 dark:text-[#FAF4EB]",
      };
  }
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Just now";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m ago`;
}

export const OrderCard: React.FC<OrderCardProps> = ({ order, tableLabel = "01", guestName }) => {
  const [showItems, setShowItems] = useState(true);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [timeAgo, setTimeAgo] = useState<string>(() => formatRelativeTime(order.submittedAt));
  const copy = getStatusCopy(order.status);
  const totalRupees = Math.round(order.totalPaise / 100);
  const canEdit = order.status === "PENDING_CONFIRMATION" || order.status === "DRAFT";

  useEffect(() => {
    setTimeAgo(formatRelativeTime(order.submittedAt));
    const timer = setInterval(() => {
      setTimeAgo(formatRelativeTime(order.submittedAt));
    }, 30000);
    return () => clearInterval(timer);
  }, [order.submittedAt]);

  const receiptData: InvoiceReceiptData = {
    orderId: order.id,
    orderNo: order.orderNo,
    tableLabel,
    guestName,
    items: order.items.map((i) => ({
      name: i.name,
      qty: i.qty,
      priceRupees: Math.round(i.unitPricePaise / 100),
      subtotalRupees: Math.round(i.lineSubtotal / 100),
    })),
    subtotalRupees: Math.round(order.subtotalPaise / 100),
    taxRupees: Math.round(order.taxPaise / 100),
    totalRupees: totalRupees,
    paymentMethod: "UPI",
    paidAt: order.submittedAt || new Date().toISOString(),
    orderStatus: order.status,
  };

  return (
    <>
      <div className="group relative overflow-hidden rounded-3xl border border-white/80 dark:border-white/15 bg-white/60 dark:bg-[#1A1412]/80 backdrop-blur-[24px] backdrop-saturate-[180%] p-5 sm:p-6 shadow-[0_16px_40px_rgba(74,46,27,0.08),inset_0_1.5px_1px_rgba(255,255,255,0.95)] dark:shadow-[0_20px_48px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.12)] transition-all duration-300 hover:shadow-xl space-y-3.5">
        {/* Header: Order No & Status Badge */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-extrabold text-[#241F1C] dark:text-[#FAF4EB]">
                Order #{order.orderNo}
              </span>
              <span className="text-[#C9AE8B]">•</span>
              <span
                suppressHydrationWarning
                className="text-xs text-[#725039] dark:text-[#C9AE8B] font-medium"
              >
                {timeAgo}
              </span>
            </div>
            <h3 className="mt-1 font-serif text-lg font-bold tracking-tight text-[#241F1C] dark:text-[#FAF4EB] drop-shadow-2xs">
              {copy.title}
            </h3>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10.5px] font-mono font-bold uppercase tracking-wider ${copy.badgeColor}`}
            >
              {order.status === "CONFIRMED" ? "CONFIRMED" : order.status.replace("_", " ")}
            </span>
          </div>
        </div>

        {/* Verification Notice & Customer Edit Button */}
        {canEdit ? (
          <div className="flex items-center justify-between rounded-2xl border border-[#F2C84B]/60 dark:border-amber-500/40 bg-[#F2C84B]/15 dark:bg-amber-950/20 p-3 text-xs backdrop-blur-xs">
            <div className="text-[#725039] dark:text-amber-200">
              <span className="font-bold">Pending Confirmation</span>
              <p className="text-[11px] text-[#725039]/80 dark:text-amber-300/80">
                Cashier is verifying. You can edit items now:
              </p>
            </div>
            <Link
              href={`/smol-menu?editOrder=${order.id}`}
              className="rounded-xl bg-[#B72E35] px-3 py-1.5 font-mono text-xs font-bold text-white shadow-xs hover:bg-[#9E242B] active:scale-95 transition"
            >
              Edit Order
            </Link>
          </div>
        ) : (order.status === "CONFIRMED" || order.status === "ACCEPTED" || order.status === "PREPARING") ? (
          <div className="rounded-xl border border-white/60 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] p-2.5 text-[11px] text-[#725039] dark:text-[#C9AE8B] font-serif italic text-center backdrop-blur-xs">
            Order confirmed. Preparation has started and editing is locked.
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <p className="font-serif text-xs leading-relaxed text-[#725039] dark:text-[#C9AE8B]">
            {copy.subtitle}
          </p>

          {/* Honest ETA Range Badge */}
          {(order.status === "PENDING_CONFIRMATION" ||
            order.status === "CONFIRMED" ||
            order.status === "ACCEPTED" ||
            order.status === "PREPARING") &&
            order.etaMinMinutes &&
            order.etaMaxMinutes && (
              <div className="flex-shrink-0 ml-2 flex items-center gap-1 rounded-full bg-[#F2C84B]/20 dark:bg-amber-950/30 border border-[#C9AE8B] dark:border-amber-500/40 px-2.5 py-1 text-[11px] font-mono font-bold text-[#725039] dark:text-amber-200 shadow-2xs">
                <Clock className="h-3 w-3 text-[#B72E35] dark:text-[#FF5B52]" />
                <span>
                  {order.etaMinMinutes}–{order.etaMaxMinutes} min
                </span>
              </div>
            )}
        </div>

        {/* 5-Step Visual Stepper */}
        <div className="mt-4 border-t border-[#C9AE8B]/25 dark:border-white/10 pt-2">
          <OrderStatusProgress status={order.status} />
        </div>

        {/* Items Toggle & Breakdown */}
        <div className="mt-3 border-t border-[#C9AE8B]/25 dark:border-white/10 pt-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowItems((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-serif font-bold text-[#725039] dark:text-[#C9AE8B] transition hover:text-[#241F1C] dark:hover:text-[#FAF4EB] cursor-pointer"
            >
              <span>
                {order.items.length} {order.items.length === 1 ? "item" : "items"} (₹{totalRupees})
              </span>
              <span className="text-[#C9AE8B] text-[10px]">{showItems ? "▲" : "▼"}</span>
            </button>

            {/* View Bill / Invoice Button with Frosted Glass styling */}
            <button
              type="button"
              onClick={() => setShowReceiptModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/80 dark:border-white/15 bg-white/70 dark:bg-white/10 backdrop-blur-md px-3 py-1.5 text-[11px] font-mono font-bold text-[#725039] dark:text-[#FAF4EB] hover:bg-white dark:hover:bg-white/20 shadow-xs active:scale-95 transition cursor-pointer"
            >
              <Receipt className="h-3.5 w-3.5 text-[#B72E35] dark:text-[#C084FC]" />
              <span>Bill / Invoice</span>
            </button>
          </div>

          {showItems && (
            <div className="mt-3 divide-y divide-stone-200/50 dark:divide-white/10 rounded-2xl border border-white/70 dark:border-white/10 bg-white/55 dark:bg-white/[0.04] backdrop-blur-md p-3.5 sm:p-4 text-xs shadow-[0_4px_12px_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center rounded-md bg-[#B72E35]/10 dark:bg-purple-500/20 text-[#B72E35] dark:text-purple-300 font-mono font-bold px-1.5 py-0.5 text-[10.5px]">
                      {item.qty}x
                    </span>
                    <span className="font-serif font-medium text-[#241F1C] dark:text-[#FAF4EB] capitalize text-xs sm:text-[13px]">
                      {item.name.toLowerCase()}
                    </span>
                  </div>
                  <span className="font-mono font-semibold text-[#241F1C] dark:text-[#FAF4EB]">
                    ₹{Math.round(item.lineSubtotal / 100)}
                  </span>
                </div>
              ))}

              <div className="flex items-center justify-between pt-2.5 font-bold text-[#241F1C] dark:text-[#FAF4EB] border-t border-stone-200/60 dark:border-white/10 text-sm">
                <span className="font-serif">Total</span>
                <span className="font-mono text-base font-extrabold text-[#B72E35] dark:text-[#C084FC] drop-shadow-2xs">
                  ₹{totalRupees}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Chit Modal */}
      {showReceiptModal && (
        <OrderReceiptModal
          receipt={receiptData}
          onClose={() => setShowReceiptModal(false)}
        />
      )}
    </>
  );
};
