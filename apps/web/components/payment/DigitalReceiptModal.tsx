"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { X, Printer, CheckCircle, Clock } from "lucide-react";

export interface ReceiptItem {
  name: string;
  qty: number;
  priceRupees: number;
  subtotalRupees: number;
}

export interface ReceiptData {
  orderId: string;
  orderNo?: number;
  tableLabel: string;
  zone?: string;
  guestCount?: number;
  items: ReceiptItem[];
  subtotalRupees: number;
  taxRupees: number;
  totalRupees: number;
  paymentMethod: "UPI" | "CASH" | "CARD" | "COMPLIMENTARY" | "CASHIER" | string;
  paymentStatus?: "PAID" | "PENDING";
  transactionId?: string;
  paidAt: string;
  merchantName?: string;
  gstin?: string;
}

interface DigitalReceiptModalProps {
  receipt: ReceiptData;
  onClose: () => void;
}

export const DigitalReceiptModal: React.FC<DigitalReceiptModalProps> = ({ receipt, onClose }) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const isPending = receipt.paymentStatus === "PENDING" || receipt.paymentMethod === "CASHIER";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#241F1C]/40 dark:bg-black/50 p-4 backdrop-blur-md animate-fade-in print:p-0 print:bg-white"
      onClick={onClose}
    >
      <div
        ref={receiptRef}
        className="w-full max-w-sm rounded-3xl border border-[#E2D7C7] dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1E1A17] p-6 shadow-2xl text-[#241F1C] dark:text-[#F3E7D3] transition-all animate-scale-in print:border-none print:shadow-none print:max-w-none print:w-full print:bg-white print:text-black"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar (hidden in print) */}
        <div className="flex items-center justify-between border-b border-[#E2D7C7] dark:border-stone-800 pb-3 print:hidden">
          {isPending ? (
            <span className="font-mono text-xs font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              Order Estimate • Pay at Counter
            </span>
          ) : (
            <span className="font-mono text-xs font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Payment Settled
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 rounded-xl bg-stone-200/80 dark:bg-stone-800 px-2.5 py-1 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-300 dark:hover:bg-stone-700 transition cursor-pointer"
              title="Print Receipt Chit"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-200/80 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-300 dark:hover:bg-stone-700 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Receipt Body (Designed as Authentic Cafe Thermal Slip) */}
        <div className="pt-4 space-y-4 font-mono text-xs">
          {/* Cafe Header */}
          <div className="text-center space-y-1">
            <div className="mx-auto flex justify-center pb-1">
              {/* Light Mode Logo */}
              <Image
                src="/logo-transparent.png"
                alt="smol café logo"
                width={60}
                height={88}
                className="h-16 w-auto object-contain drop-shadow-xs dark:hidden print:block"
                priority
              />
              {/* Dark Mode Neon Logo */}
              <Image
                src="/logo-dark-transparent.png"
                alt="smol café dark logo"
                width={60}
                height={88}
                className="h-16 w-auto object-contain hidden dark:block print:hidden drop-shadow-[0_0_12px_rgba(168,85,247,0.35)]"
                priority
              />
            </div>
            <h2 className="font-serif text-2xl font-black tracking-tight text-[#241F1C] dark:text-white lowercase">
              smol café
            </h2>
            <p className="text-[11px] text-[#725039] dark:text-[#C9AE8B]">Tapovan, Rishikesh, Uttarakhand</p>
            <p className="text-[10px] text-stone-500 dark:text-stone-400">GSTIN: {receipt.gstin || "05AAECS1482M1ZB"}</p>
          </div>

          <div className="border-t border-b border-dashed border-stone-400 dark:border-stone-700 py-2.5 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-stone-500 dark:text-stone-400">Order ID:</span>
              <span className="font-bold text-[#241F1C] dark:text-white">
                #{receipt.orderNo || (receipt.orderId.startsWith("ORD-") ? receipt.orderId.replace("ORD-", "") : receipt.orderId.slice(-6)).toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500 dark:text-stone-400">Table &amp; Zone:</span>
              <span className="font-bold text-[#B72E35] dark:text-[#A78BFA]">
                Table {receipt.tableLabel} ({receipt.zone || "Indoor"})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500 dark:text-stone-400">Date &amp; Time:</span>
              <span className="text-[#241F1C] dark:text-stone-300">
                {new Date(receipt.paidAt).toLocaleString("en-IN", { hour12: true })}
              </span>
            </div>
            {receipt.transactionId ? (
              <div className="flex justify-between text-[10px] text-stone-500 dark:text-stone-400 truncate">
                <span>Txn Ref:</span>
                <span className="font-mono">{receipt.transactionId}</span>
              </div>
            ) : isPending ? (
              <div className="flex justify-between text-[10px] text-amber-700 dark:text-amber-400">
                <span>Payment Status:</span>
                <span className="font-semibold">Pay at Cashier Counter</span>
              </div>
            ) : null}
          </div>

          {/* Line Items Table */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase">
              <span>Item</span>
              <span>Qty x Price</span>
              <span>Total</span>
            </div>
            <div className="border-b border-stone-300 dark:border-stone-700" />

            {receipt.items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs py-0.5">
                <div className="max-w-[55%] truncate font-sans font-medium text-[#241F1C] dark:text-white">
                  {item.name}
                </div>
                <div className="text-stone-500 dark:text-stone-400 text-[11px]">
                  {item.qty} x ₹{item.priceRupees}
                </div>
                <div className="font-bold text-[#241F1C] dark:text-white">₹{item.subtotalRupees}</div>
              </div>
            ))}
          </div>

          {/* Subtotal, Taxes, Total */}
          <div className="border-t border-dashed border-stone-400 dark:border-stone-700 pt-2 space-y-1 text-xs">
            <div className="flex justify-between text-stone-600 dark:text-stone-300">
              <span>Item Subtotal</span>
              <span>₹{receipt.subtotalRupees}</span>
            </div>
            <div className="flex justify-between text-stone-600 dark:text-stone-300 text-[11px]">
              <span>CGST (2.5%) + SGST (2.5%)</span>
              <span>₹{receipt.taxRupees}</span>
            </div>
            <div className="flex justify-between border-t border-stone-800 dark:border-stone-600 pt-1.5 font-bold text-sm text-[#241F1C] dark:text-white">
              <span>{isPending ? "TOTAL PAYABLE" : "TOTAL PAID"}</span>
              <span className="text-[#B72E35] dark:text-[#A78BFA] font-serif text-base">₹{receipt.totalRupees}</span>
            </div>
            <div className="flex justify-between items-center text-[10px] text-stone-600 dark:text-stone-400 pt-0.5">
              <div className="flex items-center gap-1.5">
                <span>Method:</span>
                {isPending ? (
                  <span className="font-semibold text-amber-800 dark:text-amber-300">
                    Pay at Cashier Desk (Cash / UPI / Card)
                  </span>
                ) : receipt.paymentMethod === "UPI" ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 shadow-2xs">
                    <Image
                      src="/upi-logo-trimmed.png"
                      alt="UPI"
                      width={28}
                      height={10}
                      className="h-2.5 w-auto object-contain dark:hidden print:block"
                    />
                    <Image
                      src="/upi-logo-dark.png"
                      alt="UPI"
                      width={28}
                      height={10}
                      className="h-2.5 w-auto object-contain hidden dark:block print:hidden"
                    />
                  </span>
                ) : receipt.paymentMethod === "CARD" ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 shadow-2xs font-mono text-[9px] font-bold text-stone-800 dark:text-stone-200">
                    <Image
                      src="/icon_card_hd.png"
                      alt="Card"
                      width={14}
                      height={14}
                      className="h-3 w-auto object-contain drop-shadow-2xs"
                    />
                    <span>CARD</span>
                  </span>
                ) : (
                  <span className="font-bold">{receipt.paymentMethod}</span>
                )}
              </div>
              <span className={`font-bold ${isPending ? "text-amber-700 dark:text-amber-400" : "text-emerald-800 dark:text-emerald-400"}`}>
                {isPending ? "PAYMENT PENDING" : "PAID IN FULL"}
              </span>
            </div>
          </div>

          {/* Thermal Slip Footer */}
          <div className="pt-3 text-center space-y-1 text-[10px] text-stone-500 dark:text-stone-400 font-sans border-t border-dashed border-stone-400 dark:border-stone-700">
            <p className="font-serif italic text-[#725039] dark:text-[#C9AE8B]">
              Thank you for visiting smol café.
            </p>
            <p>small place. long stay.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
