"use client";

import React from "react";
import Image from "next/image";
import { X, Printer, Download, CheckCircle, ExternalLink, Star } from "lucide-react";
import { printHtmlContent, generateThermalReceiptHtml, type InvoiceReceiptData } from "@/lib/print";
import { SMOL_CAFE_MAPS_URL } from "@/lib/constants";

interface OrderReceiptModalProps {
  receipt: InvoiceReceiptData;
  onClose: () => void;
}

export const OrderReceiptModal: React.FC<OrderReceiptModalProps> = ({ receipt, onClose }) => {
  const handlePrint = () => {
    const html = generateThermalReceiptHtml(receipt);
    printHtmlContent(html, `Receipt_${receipt.orderNo || receipt.orderId.slice(0, 6)}`);
  };

  const orderNumStr = receipt.orderNo
    ? `#SMOL ${receipt.orderNo.toString().padStart(4, "0")}`
    : `#${receipt.orderId.slice(0, 8).toUpperCase()}`;

  const formattedDate = new Date(receipt.paidAt).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm max-h-[92vh] overflow-y-auto rounded-3xl border border-[#C9AE8B]/40 dark:border-white/10 bg-[#FAF4EB] dark:bg-[#1E1A17] p-5 shadow-2xl text-[#241F1C] dark:text-[#F3E7D3] transition-all animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-[#C9AE8B]/30 dark:border-white/10 pb-3">
          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
            <CheckCircle className="h-4 w-4" />
            <span>Tax Invoice / Paid</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 rounded-xl bg-[#B72E35] px-2.5 py-1 text-xs font-serif font-bold text-white shadow-xs hover:bg-[#91242C] transition active:scale-95 cursor-pointer"
              title="Print Receipt"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Bill</span>
            </button>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-200/80 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-300 dark:hover:bg-stone-700 transition cursor-pointer"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Thermal Slip Body */}
        <div className="pt-4 space-y-4 font-mono text-xs">
          {/* Cafe Header */}
          <div className="text-center space-y-1">
            <div className="mx-auto flex justify-center pb-1">
              <Image
                src="/logo-transparent.png"
                alt="smol café logo"
                width={50}
                height={75}
                className="h-14 w-auto object-contain dark:hidden"
                priority
              />
              <Image
                src="/table-header-logo-dark-v2.png"
                alt="smol café logo"
                width={50}
                height={75}
                className="h-14 w-auto object-contain hidden dark:block"
                priority
              />
            </div>
            <h2 className="font-serif text-2xl font-black tracking-tight text-[#241F1C] dark:text-white lowercase">
              smol café
            </h2>
            <a
              href={SMOL_CAFE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-[#725039] dark:text-[#C9AE8B] hover:underline inline-flex items-center gap-1"
            >
              <span>Tapovan, Rishikesh, Uttarakhand</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-70" />
            </a>
            <p className="text-[9.5px] text-stone-500 dark:text-stone-400">
              GSTIN: {receipt.gstin || "05AAECS1482M1ZB"} • FSSAI: {receipt.fssaiLic || "22624039000124"}
            </p>
          </div>

          {/* Meta Details Box */}
          <div className="rounded-2xl border border-dashed border-[#C9AE8B]/60 dark:border-white/15 bg-[#F3E7D3]/50 dark:bg-white/[0.03] p-3 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-stone-600 dark:text-stone-400">Invoice No:</span>
              <span className="font-bold text-[#241F1C] dark:text-white">{orderNumStr}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-600 dark:text-stone-400">Table:</span>
              <span className="font-bold text-[#B72E35] dark:text-[#FF6B6B]">Table {receipt.tableLabel}</span>
            </div>
            {receipt.guestName && (
              <div className="flex justify-between">
                <span className="text-stone-600 dark:text-stone-400">Guest:</span>
                <span className="font-bold text-[#241F1C] dark:text-white">{receipt.guestName}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-stone-600 dark:text-stone-400">Date &amp; Time:</span>
              <span className="text-[#241F1C] dark:text-stone-300">{formattedDate}</span>
            </div>
            {receipt.transactionId && (
              <div className="flex justify-between text-[10px] text-stone-500 dark:text-stone-400 truncate">
                <span>Txn Ref:</span>
                <span className="font-mono truncate max-w-[160px]">{receipt.transactionId}</span>
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider">
              <span>Item</span>
              <span>Qty x Rate</span>
              <span>Amount</span>
            </div>
            <div className="border-b border-[#C9AE8B]/40 dark:border-white/10" />

            {receipt.items.map((item, idx) => (
              <div key={idx} className="flex items-start justify-between py-1 border-b border-dashed border-[#C9AE8B]/20 dark:border-white/5">
                <div className="max-w-[55%] font-sans">
                  <div className="font-semibold text-xs text-[#241F1C] dark:text-white capitalize">
                    {item.name.toLowerCase()}
                  </div>
                  {item.modifiers && item.modifiers.length > 0 && (
                    <div className="text-[10px] text-[#725039] dark:text-[#C9AE8B] italic">
                      {item.modifiers.join(", ")}
                    </div>
                  )}
                </div>
                <div className="text-stone-600 dark:text-stone-400 text-[11px] pt-0.5">
                  {item.qty} x ₹{item.priceRupees}
                </div>
                <div className="font-bold text-[#241F1C] dark:text-white pt-0.5">
                  ₹{item.subtotalRupees}
                </div>
              </div>
            ))}
          </div>

          {/* Subtotal, Taxes, Total */}
          <div className="border-t border-dashed border-[#C9AE8B]/60 dark:border-white/15 pt-2.5 space-y-1 text-xs">
            <div className="flex justify-between text-stone-600 dark:text-stone-400">
              <span>Item Subtotal</span>
              <span>₹{receipt.subtotalRupees}</span>
            </div>
            <div className="flex justify-between text-stone-600 dark:text-stone-400 text-[11px]">
              <span>CGST (2.5%)</span>
              <span>₹{(receipt.taxRupees / 2).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-stone-600 dark:text-stone-400 text-[11px]">
              <span>SGST (2.5%)</span>
              <span>₹{(receipt.taxRupees / 2).toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t-2 border-[#241F1C] dark:border-white/20 pt-2 font-bold text-sm text-[#241F1C] dark:text-white">
              <span className="font-serif font-black">TOTAL AMOUNT</span>
              <span className="text-[#B72E35] dark:text-[#FF5B52] font-mono text-base">
                ₹{receipt.totalRupees}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px] text-emerald-700 dark:text-emerald-400 pt-1">
              <span>Payment Mode:</span>
              <span className="font-bold uppercase tracking-wider">{receipt.paymentMethod} (PAID)</span>
            </div>
          </div>

          {/* Google Maps Review & Rating CTA */}
          <div className="pt-2">
            <a
              href={SMOL_CAFE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-2xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 p-2.5 text-xs text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition shadow-2xs group"
            >
              <div className="flex items-center gap-2 font-medium">
                <Image
                  src="/google-maps-icon.png"
                  alt="Google Maps"
                  width={24}
                  height={24}
                  className="h-6 w-6 rounded-md object-contain shadow-2xs shrink-0"
                />
                <span className="font-serif font-semibold text-[#241F1C] dark:text-amber-100">
                  Loved your visit? Review on Google
                </span>
              </div>
              <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400 shrink-0">
                <span className="text-[11px] font-bold underline group-hover:no-underline">Rate Us</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </div>
            </a>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#241F1C] dark:bg-white text-white dark:text-[#241F1C] py-2.5 text-xs font-serif font-bold shadow-xs hover:opacity-90 transition active:scale-98"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Thermal Slip</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#C9AE8B] dark:border-white/20 bg-white/60 dark:bg-white/5 py-2.5 text-xs font-serif font-bold text-[#725039] dark:text-[#F3E7D3] shadow-xs hover:bg-[#F3E7D3] transition active:scale-98"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Save as PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
