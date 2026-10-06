"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { TableJsonTag, createTableJsonTag } from "@/lib/table-tag";
import type { AdminOrderRecord } from "@/app/admin/actions";
import type { OrderStatus } from "@smol-cafe/db";
import {
  Check,
  Copy,
  X,
  Receipt,
  Armchair,
  Clock,
  CreditCard,
  ChefHat,
  Sparkles,
  Code,
  Layers,
  ArrowRight,
} from "lucide-react";

interface OrderDetailsInspectorModalProps {
  order?: AdminOrderRecord | null;
  tag?: TableJsonTag | null;
  onClose: () => void;
  onUpdateStatus?: (orderId: string, status: OrderStatus) => Promise<void>;
}

export const OrderDetailsInspectorModal: React.FC<OrderDetailsInspectorModalProps> = ({
  order,
  tag,
  onClose,
  onUpdateStatus,
}) => {
  const [activeTab, setActiveTab] = useState<"details" | "raw">("details");
  const [copied, setCopied] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Resolved values
  const tableNumber = order?.tableLabel || tag?.table_number || "01";
  const zoneName = order?.zone || tag?.zone || "Café";
  const resolvedTag = tag || createTableJsonTag(tableNumber);
  const jsonString = JSON.stringify(
    order
      ? {
          order_id: order.id,
          order_no: order.orderNo,
          table: order.tableLabel,
          zone: order.zone,
          status: order.status,
          payment: {
            method: order.paymentMethod,
            status: order.paymentStatus,
            amount: `₹${order.totalRupees}`,
          },
          items: order.itemsDetail.length > 0 ? order.itemsDetail : order.items,
          created_at: order.rawCreatedAt || new Date().toISOString(),
          pos_tag: resolvedTag,
        }
      : resolvedTag,
    null,
    2
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "READY":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";
      case "PREPARING":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800";
      case "ACCEPTED":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-800";
      case "SERVED":
      case "COMPLETED":
        return "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300 dark:border-purple-800";
      default:
        return "bg-[#F3E7D3] text-[#725039] dark:bg-stone-800 dark:text-stone-300 border-[#C9AE8B]/40 dark:border-stone-700";
    }
  };

  const statusSteps: Array<{ key: OrderStatus; label: string }> = [
    { key: "SUBMITTED", label: "Placed" },
    { key: "ACCEPTED", label: "Accepted" },
    { key: "PREPARING", label: "Kitchen" },
    { key: "READY", label: "Ready" },
    { key: "SERVED", label: "Delivered" },
  ];

  const currentStatusIndex = statusSteps.findIndex(
    (s) => s.key === (order?.status || "SUBMITTED")
  );

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 dark:bg-black/85 p-4 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1C1816] p-5 sm:p-6 shadow-2xl text-[#241F1C] dark:text-[#FDFBF7] transition-all animate-scale-in max-h-[92vh] overflow-y-auto flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between border-b border-[#C9AE8B]/30 dark:border-stone-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#B72E35] to-[#8C1D23] text-white shadow-md">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg sm:text-xl font-bold text-[#241F1C] dark:text-white tracking-tight">
                  {order ? `Order #${order.orderNo}` : `Table ${tableNumber} Details`}
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border ${getStatusColor(
                    order?.status
                  )}`}
                >
                  {order?.status || "ACTIVE"}
                </span>
              </div>
              <p className="font-serif italic text-xs text-[#725039] dark:text-[#C9AE8B]">
                Table {tableNumber} • {zoneName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#C9AE8B]/30 dark:border-stone-700 bg-[#F3E7D3] dark:bg-stone-800 text-[#725039] dark:text-stone-400 hover:text-[#241F1C] dark:hover:text-white transition cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Toggle: Formatted Details vs Raw Metadata */}
        <div className="flex rounded-xl bg-[#EFE3D3] dark:bg-[#141210] p-1 text-xs font-medium my-4 border border-[#C9AE8B]/30 dark:border-stone-800">
          <button
            onClick={() => setActiveTab("details")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition cursor-pointer ${
              activeTab === "details"
                ? "bg-[#FAF4EB] dark:bg-[#2A2420] font-bold text-[#B72E35] dark:text-[#F2C84B] shadow-xs border border-[#C9AE8B]/30 dark:border-white/10"
                : "text-[#725039] dark:text-stone-400 hover:text-[#241F1C] dark:hover:text-white"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Order Summary &amp; Bill</span>
          </button>
          <button
            onClick={() => setActiveTab("raw")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition cursor-pointer ${
              activeTab === "raw"
                ? "bg-[#FAF4EB] dark:bg-[#2A2420] font-bold text-[#B72E35] dark:text-[#F2C84B] shadow-xs border border-[#C9AE8B]/30 dark:border-white/10"
                : "text-[#725039] dark:text-stone-400 hover:text-[#241F1C] dark:hover:text-white"
            }`}
          >
            <Code className="h-3.5 w-3.5" />
            <span>POS JSON Metadata</span>
          </button>
        </div>

        {/* Tab 1: Clean Formatted Details View */}
        {activeTab === "details" && (
          <div className="space-y-4">
            {/* Live Progress Pipeline */}
            {order && (
              <div className="rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#F3E7D3]/60 dark:bg-[#141211] p-3.5">
                <div className="flex items-center justify-between text-[11px] font-mono mb-2 text-[#725039] dark:text-[#C9AE8B]">
                  <span className="font-bold uppercase">Order Pipeline</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                    {order.status}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1 text-center">
                  {statusSteps.map((step, idx) => {
                    const isCompleted = idx <= (currentStatusIndex >= 0 ? currentStatusIndex : 0);
                    const isCurrent = idx === currentStatusIndex;
                    return (
                      <div key={step.key} className="flex flex-col items-center gap-1">
                        <div
                          className={`h-2 w-full rounded-full transition-all ${
                            isCurrent
                              ? "bg-[#B72E35] animate-pulse"
                              : isCompleted
                                ? "bg-emerald-500"
                                : "bg-[#C9AE8B]/30 dark:bg-stone-800"
                          }`}
                        />
                        <span
                          className={`text-[9.5px] font-mono truncate ${
                            isCurrent
                              ? "font-bold text-[#B72E35] dark:text-[#F2C84B]"
                              : isCompleted
                                ? "text-emerald-800 dark:text-emerald-400"
                                : "text-[#725039]/60 dark:text-stone-600"
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick 4-Grid Key Info Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#201C19] p-3 space-y-0.5">
                <div className="flex items-center gap-1.5 text-[#725039] dark:text-stone-400 text-[10px] font-mono uppercase">
                  <Armchair className="h-3 w-3 text-[#B72E35] dark:text-[#F2C84B]" />
                  <span>Table</span>
                </div>
                <div className="font-serif text-base font-bold text-[#241F1C] dark:text-white">
                  Table {tableNumber}
                </div>
                <p className="text-[10px] text-[#8C6D53] dark:text-stone-500 truncate">{zoneName}</p>
              </div>

              <div className="rounded-xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#201C19] p-3 space-y-0.5">
                <div className="flex items-center gap-1.5 text-[#725039] dark:text-stone-400 text-[10px] font-mono uppercase">
                  <CreditCard className="h-3 w-3 text-[#48BB78]" />
                  <span>Payment</span>
                </div>
                <div className="flex items-center gap-1.5 pt-0.5">
                  {(order?.paymentMethod || "UPI") === "UPI" ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white dark:bg-stone-800 border border-[#C9AE8B]/40 dark:border-stone-700 shadow-2xs">
                      <Image
                        src="/upi-logo-trimmed.png"
                        alt="UPI"
                        width={32}
                        height={12}
                        className="h-3.5 w-auto object-contain dark:hidden"
                      />
                      <Image
                        src="/upi-logo-dark.png"
                        alt="UPI"
                        width={32}
                        height={12}
                        className="h-3.5 w-auto object-contain hidden dark:block"
                      />
                    </span>
                  ) : order?.paymentMethod === "CARD" ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white dark:bg-stone-800 border border-[#C9AE8B]/40 dark:border-stone-700 shadow-2xs font-mono text-[11px] font-bold text-stone-800 dark:text-stone-200">
                      <Image
                        src="/icon_card_hd.png"
                        alt="Card"
                        width={16}
                        height={16}
                        className="h-4 w-auto object-contain drop-shadow-2xs"
                      />
                      <span>CARD</span>
                    </span>
                  ) : order?.paymentMethod === "CASH" ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/50">
                      CASH
                    </span>
                  ) : order?.paymentMethod === "COMPLIMENTARY" ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800/50">
                      COMPLIMENTARY
                    </span>
                  ) : (
                    <span className="font-serif text-base font-bold text-[#241F1C] dark:text-white truncate">
                      {order?.paymentMethod}
                    </span>
                  )}
                </div>
                <p
                  className={`text-[10px] font-bold truncate ${
                    order?.paymentStatus?.includes("PENDING") || order?.paymentStatus?.includes("UNPAID")
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-700 dark:text-emerald-400"
                  }`}
                >
                  {order?.paymentStatus || "PAID"}
                </p>
              </div>

              <div className="rounded-xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#201C19] p-3 space-y-0.5">
                <div className="flex items-center gap-1.5 text-[#725039] dark:text-stone-400 text-[10px] font-mono uppercase">
                  <Clock className="h-3 w-3 text-[#ED8936]" />
                  <span>Time</span>
                </div>
                <div className="font-serif text-base font-bold text-[#241F1C] dark:text-white truncate">
                  {order?.createdAt || "Just now"}
                </div>
                <p className="text-[10px] text-[#8C6D53] dark:text-stone-500">Live sync</p>
              </div>

              <div className="rounded-xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#201C19] p-3 space-y-0.5">
                <div className="flex items-center gap-1.5 text-[#725039] dark:text-stone-400 text-[10px] font-mono uppercase">
                  <ChefHat className="h-3 w-3 text-[#4299E1]" />
                  <span>Mode</span>
                </div>
                <div className="font-serif text-base font-bold text-[#241F1C] dark:text-white">
                  Dine-In
                </div>
                <p className="text-[10px] text-[#8C6D53] dark:text-stone-500">Table QR</p>
              </div>
            </div>

            {/* Ordered Items Breakdown */}
            <div className="rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#201C19] overflow-hidden shadow-xs">
              <div className="bg-[#F3E7D3] dark:bg-[#161311] px-4 py-2.5 border-b border-[#C9AE8B]/30 dark:border-stone-800 flex items-center justify-between">
                <span className="font-serif text-xs font-bold text-[#241F1C] dark:text-white uppercase tracking-wider">
                  Ordered Items &amp; Quantity
                </span>
                <span className="font-mono text-[10px] text-[#725039] dark:text-stone-400">
                  {order?.itemsDetail?.length || order?.items?.length || 1} Item(s)
                </span>
              </div>

              <div className="divide-y divide-[#C9AE8B]/20 dark:divide-stone-800 p-2 sm:p-3 space-y-1">
                {order && order.itemsDetail && order.itemsDetail.length > 0 ? (
                  order.itemsDetail.map((it, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-2 px-2 hover:bg-[#F3E7D3]/40 dark:hover:bg-stone-800/40 rounded-xl transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#B72E35]/15 font-mono text-xs font-bold text-[#B72E35] dark:text-[#F2C84B]">
                          {it.qty}x
                        </span>
                        <div className="min-w-0">
                          <p className="font-serif text-sm font-bold text-[#241F1C] dark:text-white truncate">
                            {it.name}
                          </p>
                          <p className="text-[10px] font-mono text-[#725039] dark:text-stone-400">
                            ₹{it.priceRupees} each
                          </p>
                        </div>
                      </div>
                      <span className="font-serif font-bold text-sm text-[#241F1C] dark:text-white">
                        ₹{it.subtotalRupees}
                      </span>
                    </div>
                  ))
                ) : (
                  (order?.items || ["Artisanal Flat White (x2)", "Bun Makkhan (x1)"]).map(
                    (itStr, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-2 px-2 hover:bg-[#F3E7D3]/40 dark:hover:bg-stone-800/40 rounded-xl transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#B72E35]/15 font-mono text-xs font-bold text-[#B72E35] dark:text-[#F2C84B]">
                            1x
                          </span>
                          <span className="font-serif text-sm font-bold text-[#241F1C] dark:text-white">
                            {itStr}
                          </span>
                        </div>
                      </div>
                    )
                  )
                )}
              </div>

              {/* Bill Totals Summary */}
              {order && (
                <div className="bg-[#F3E7D3]/60 dark:bg-[#161311] p-3.5 border-t border-[#C9AE8B]/30 dark:border-stone-800 space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-[#725039] dark:text-stone-400">
                    <span>Subtotal</span>
                    <span>₹{Math.round(order.totalRupees * 0.95)}</span>
                  </div>
                  <div className="flex justify-between text-[#725039] dark:text-stone-400">
                    <span>GST (5% Cafe Tax)</span>
                    <span>₹{Math.max(1, Math.round(order.totalRupees * 0.05))}</span>
                  </div>
                  <div className="flex justify-between text-[#241F1C] dark:text-white font-serif text-base font-bold pt-1 border-t border-[#C9AE8B]/30 dark:border-stone-800">
                    <span>Total Amount Paid</span>
                    <span className="text-[#B72E35] dark:text-[#F2C84B]">₹{order.totalRupees}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Status Action Buttons (If handler supplied) */}
            {order && onUpdateStatus && (
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#C9AE8B]/30 dark:border-stone-800">
                <span className="text-xs font-mono text-[#725039] dark:text-stone-400">
                  Update Status:
                </span>
                <div className="flex items-center gap-1.5">
                  {(["ACCEPTED", "PREPARING", "READY", "SERVED"] as OrderStatus[]).map((st) => (
                    <button
                      key={st}
                      disabled={isUpdating || order.status === st}
                      onClick={async () => {
                        setIsUpdating(true);
                        try {
                          await onUpdateStatus(order.id, st);
                        } finally {
                          setIsUpdating(false);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition cursor-pointer ${
                        order.status === st
                          ? "bg-[#B72E35] text-white shadow-xs"
                          : "border border-[#C9AE8B]/40 dark:border-stone-700 bg-[#FAF4EB] dark:bg-stone-800 text-[#725039] dark:text-stone-300 hover:bg-[#EFE3D3] dark:hover:bg-stone-700"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Raw POS JSON Metadata */}
        {activeTab === "raw" && (
          <div className="space-y-3">
            <div className="relative rounded-2xl border border-[#C9AE8B]/30 dark:border-stone-800 bg-[#141211] p-4 text-white">
              <pre className="max-h-72 overflow-x-auto font-mono text-xs text-amber-100/90 leading-relaxed scrollbar-thin">
                {jsonString}
              </pre>

              <button
                onClick={handleCopy}
                className="absolute top-3 right-3 flex items-center gap-1.5 rounded-lg border border-stone-700 bg-stone-800/90 px-2.5 py-1 text-xs text-stone-300 hover:bg-stone-700 hover:text-white transition cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-[#725039] dark:text-stone-400 font-serif italic">
              Synchronized internal POS metadata tag traveling across Kitchen GDS, Cashier Desk, and Admin Tower.
            </p>
          </div>
        )}

        {/* Footer Close Button */}
        <div className="mt-4 pt-3 border-t border-[#C9AE8B]/30 dark:border-stone-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#241F1C] dark:bg-stone-800 text-[#F3E7D3] dark:text-white text-xs font-mono font-bold hover:bg-[#3D3530] dark:hover:bg-stone-700 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
