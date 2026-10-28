"use client";

import React, { useState } from "react";
import { X, Receipt, Printer, Download, Clock, ChevronRight, FileText, CheckCircle2 } from "lucide-react";
import type { CustomerOrderDetails } from "@/app/orders/actions";
import { OrderReceiptModal } from "./OrderReceiptModal";
import { printHtmlContent, generateThermalReceiptHtml, type InvoiceReceiptData } from "@/lib/print";

interface PastBillsModalProps {
  orders: CustomerOrderDetails[];
  tableLabel: string;
  guestName?: string;
  onClose: () => void;
}

export const PastBillsModal: React.FC<PastBillsModalProps> = ({
  orders,
  tableLabel,
  guestName,
  onClose,
}) => {
  const [selectedReceipt, setSelectedReceipt] = useState<InvoiceReceiptData | null>(null);

  const totalSpentPaise = orders.reduce(
    (sum, o) =>
      sum +
      (o.totalPaise ||
        (o as any).total_snapshot ||
        ((o as any).totalRupees !== undefined ? (o as any).totalRupees * 100 : 0)),
    0
  );
  const totalSpentRupees = Math.round(totalSpentPaise / 100);

  const handlePrintConsolidated = () => {
    const allItems = orders.flatMap((o) =>
      o.items.map((i) => ({
        name: i.name,
        qty: i.qty,
        priceRupees:
          (i as any).priceRupees ?? (i.unitPricePaise ? Math.round(i.unitPricePaise / 100) : 0),
        subtotalRupees:
          (i as any).subtotalRupees ?? (i.lineSubtotal ? Math.round(i.lineSubtotal / 100) : 0),
      }))
    );

    const consolidatedSubtotalRupees = Math.round(
      orders.reduce(
        (sum, o) =>
          sum +
          (o.subtotalPaise ||
            (o as any).subtotal_snapshot ||
            ((o as any).subtotalRupees !== undefined ? (o as any).subtotalRupees * 100 : 0)),
        0
      ) / 100
    ) || Math.round(totalSpentRupees / 1.05);

    const consolidatedTaxRupees = Math.round(
      orders.reduce(
        (sum, o) =>
          sum +
          (o.taxPaise ||
            (o as any).tax_snapshot ||
            ((o as any).taxRupees !== undefined ? (o as any).taxRupees * 100 : 0)),
        0
      ) / 100
    ) || Math.max(0, totalSpentRupees - consolidatedSubtotalRupees);

    const consolidatedReceipt: InvoiceReceiptData = {
      orderId: `SESSION-T${tableLabel}`,
      orderNo: orders[0]?.orderNo,
      tableLabel,
      guestName,
      items: allItems,
      subtotalRupees: consolidatedSubtotalRupees,
      taxRupees: consolidatedTaxRupees,
      totalRupees: totalSpentRupees,
      paymentMethod: "UPI",
      paidAt: orders[0]?.submittedAt || new Date().toISOString(),
    };

    const html = generateThermalReceiptHtml(consolidatedReceipt);
    printHtmlContent(html, `Consolidated_Bill_Table_${tableLabel}`);
  };

  const openOrderReceipt = (order: CustomerOrderDetails) => {
    const orderTotalRupees =
      (order as any).totalRupees !== undefined
        ? (order as any).totalRupees
        : order.totalPaise
        ? Math.round(order.totalPaise / 100)
        : (order as any).total_snapshot
        ? Math.round((order as any).total_snapshot / 100)
        : 0;

    const orderSubtotalRupees =
      (order as any).subtotalRupees !== undefined
        ? (order as any).subtotalRupees
        : order.subtotalPaise
        ? Math.round(order.subtotalPaise / 100)
        : (order as any).subtotal_snapshot
        ? Math.round((order as any).subtotal_snapshot / 100)
        : Math.round(orderTotalRupees / 1.05);

    const orderTaxRupees =
      (order as any).taxRupees !== undefined
        ? (order as any).taxRupees
        : order.taxPaise
        ? Math.round(order.taxPaise / 100)
        : (order as any).tax_snapshot
        ? Math.round((order as any).tax_snapshot / 100)
        : Math.max(0, orderTotalRupees - orderSubtotalRupees);

    setSelectedReceipt({
      orderId: order.id,
      orderNo: order.orderNo,
      tableLabel,
      guestName,
      items: order.items.map((i) => ({
        name: i.name,
        qty: i.qty,
        priceRupees:
          (i as any).priceRupees ?? (i.unitPricePaise ? Math.round(i.unitPricePaise / 100) : 0),
        subtotalRupees:
          (i as any).subtotalRupees ?? (i.lineSubtotal ? Math.round(i.lineSubtotal / 100) : 0),
      })),
      subtotalRupees: orderSubtotalRupees,
      taxRupees: orderTaxRupees,
      totalRupees: orderTotalRupees,
      paymentMethod: "UPI",
      paidAt: order.submittedAt || new Date().toISOString(),
      orderStatus: order.status,
    });
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-md max-h-[85vh] overflow-hidden rounded-3xl border border-[#C9AE8B]/40 dark:border-white/10 bg-[#FAF4EB] dark:bg-[#1C1816] shadow-2xl text-[#241F1C] dark:text-[#FAF4EB] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#C9AE8B]/30 dark:border-white/10 px-5 py-4 bg-[#F3E7D3]/60 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#B72E35] text-white shadow-xs">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold">Past Bills &amp; Invoices</h3>
                <p className="font-mono text-[11px] text-[#725039] dark:text-[#C9AE8B]">
                  Table {tableLabel} • {orders.length} {orders.length === 1 ? "Round" : "Rounds"}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-stone-600 dark:text-stone-300 hover:bg-black/10 dark:hover:bg-white/20 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Session Overview Summary */}
          <div className="p-5 border-b border-[#C9AE8B]/20 dark:border-white/5 bg-[#F3E7D3]/30 dark:bg-black/20 flex items-center justify-between">
            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#725039] dark:text-[#C9AE8B]">
                Session Total Spent
              </span>
              <div className="font-serif text-2xl font-black text-[#B72E35] dark:text-[#FF5B52]">
                ₹{totalSpentRupees}
              </div>
            </div>

            {orders.length > 0 && (
              <button
                onClick={handlePrintConsolidated}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#241F1C] dark:bg-white text-white dark:text-[#241F1C] px-3 py-2 text-xs font-serif font-bold shadow-xs hover:opacity-90 active:scale-95 transition"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print All Rounds</span>
              </button>
            )}
          </div>

          {/* List of Orders */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {orders.length === 0 ? (
              <div className="py-12 text-center text-stone-500 space-y-2">
                <FileText className="h-10 w-10 mx-auto opacity-40" />
                <p className="font-serif text-sm">No bills generated yet for this session.</p>
              </div>
            ) : (
              orders.map((order, idx) => {
                const roundNum = orders.length - idx;
                const orderRupees =
                  (order as any).totalRupees !== undefined
                    ? (order as any).totalRupees
                    : order.totalPaise
                    ? Math.round(order.totalPaise / 100)
                    : (order as any).total_snapshot
                    ? Math.round((order as any).total_snapshot / 100)
                    : 0;
                const orderTime = order.submittedAt
                  ? new Date(order.submittedAt).toLocaleTimeString("en-IN", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })
                  : "Recently";

                return (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-[#C9AE8B]/30 dark:border-white/10 bg-[#FAF4EB] dark:bg-white/[0.03] p-4 shadow-2xs hover:border-[#B72E35]/40 transition space-y-2.5"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#241F1C] dark:text-white">
                            #SMOL {order.orderNo.toString().padStart(4, "0")}
                          </span>
                          <span className="text-[10px] font-mono bg-[#75AFA7]/20 text-[#1C463F] dark:text-[#75AFA7] px-1.5 py-0.5 rounded font-bold">
                            Round {roundNum}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-[#725039] dark:text-[#C9AE8B] mt-0.5 font-mono">
                          <Clock className="h-3 w-3 text-stone-400" />
                          <span>{orderTime}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-mono text-sm font-black text-[#B72E35] dark:text-[#FF5B52]">
                          ₹{orderRupees}
                        </span>
                        <span className="block text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
                          PAID (UPI)
                        </span>
                      </div>
                    </div>

                    {/* Items preview */}
                    <div className="text-xs text-[#5A3825] dark:text-[#C9AE8B] font-serif border-t border-dashed border-[#C9AE8B]/30 dark:border-white/10 pt-2 flex flex-wrap gap-x-2 gap-y-1">
                      {order.items.map((it) => (
                        <span key={it.id} className="inline-flex items-center gap-1">
                          <span className="font-mono font-bold">{it.qty}x</span>
                          <span className="capitalize">{it.name.toLowerCase()}</span>
                        </span>
                      ))}
                    </div>

                    {/* View Invoice Button */}
                    <div className="pt-1 flex justify-end">
                      <button
                        onClick={() => openOrderReceipt(order)}
                        className="inline-flex items-center gap-1 text-xs font-serif font-bold text-[#B72E35] dark:text-[#FF6B6B] hover:underline cursor-pointer"
                      >
                        <span>View &amp; Print Invoice</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Child Modal for Single Order Receipt */}
      {selectedReceipt && (
        <OrderReceiptModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </>
  );
};
