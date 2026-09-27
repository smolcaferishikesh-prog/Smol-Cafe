"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  CheckCircle2,
  Sparkles,
  Receipt,
  Coffee,
  Plus,
  Wifi,
  Copy,
  Check,
  X,
  Clock,
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { DigitalReceiptModal, type ReceiptData } from "./DigitalReceiptModal";

export interface PostPaymentCelebrationModalProps {
  orderId?: string;
  orderNo?: number;
  tableLabel: string;
  zone?: string;
  totalRupees: number;
  items?: Array<{ name: string; qty: number; priceRupees: number; subtotalRupees: number }>;
  transactionId?: string;
  appName?: string;
  onClose: () => void;
}

const DESSERT_SUGGESTIONS = [
  {
    id: "item_croissant_butter",
    name: "Flaky Butter Croissant",
    desc: "Golden layers with French butter & flake salt",
    priceRupees: 140,
    pricePaise: 14000,
    tag: "Fresh Bake",
  },
  {
    id: "item_cinnamon_bun",
    name: "Cinnamon Almond Bun",
    desc: "Warm morning brioche with spiced glaze",
    priceRupees: 180,
    pricePaise: 18000,
    tag: "Chef's Special",
  },
  {
    id: "item_chocolate_babka",
    name: "Sourdough Chocolate Babka",
    desc: "Valrhona cocoa swirl with toasted hazelnuts",
    priceRupees: 190,
    pricePaise: 19000,
    tag: "House Favorite",
  },
  {
    id: "item_pour_over",
    name: "Ratnagiri Pour Over",
    desc: "Single-origin manual brew with hazelnut finish",
    priceRupees: 220,
    pricePaise: 22000,
    tag: "Second Cup",
  },
];

export const PostPaymentCelebrationModal: React.FC<PostPaymentCelebrationModalProps> = ({
  orderId = `ORD-${Date.now().toString().slice(-6)}`,
  orderNo,
  tableLabel,
  zone = "Café",
  totalRupees,
  items = [],
  transactionId = `UPI/2026/${Math.floor(100000000 + Math.random() * 900000000)}`,
  appName = "UPI Instant",
  onClose,
}) => {
  const { addItem, openCart } = useCart();
  const [showReceipt, setShowReceipt] = useState(false);
  const [copiedWifi, setCopiedWifi] = useState(false);
  const [addedItemName, setAddedItemName] = useState<string | null>(null);

  const pointsEarned = Math.max(10, Math.round(totalRupees / 10));

  const handleCopyWifi = () => {
    navigator.clipboard.writeText("smolcoffee2026");
    setCopiedWifi(true);
    setTimeout(() => setCopiedWifi(false), 2000);
  };

  const handleQuickAddDessert = (dessert: (typeof DESSERT_SUGGESTIONS)[number]) => {
    addItem({
      id: dessert.id,
      categoryId: "desserts",
      name: dessert.name,
      status: "AVAILABLE",
      description: dessert.desc,
      pricePaise: dessert.pricePaise,
      imageUrl: null,
      metadata: {
        dietary: "Vegetarian",
      },
    });

    setAddedItemName(dessert.name);
    setTimeout(() => {
      setAddedItemName(null);
    }, 2500);
  };

  const defaultReceiptItems =
    items.length > 0
      ? items
      : [{ name: "Artisanal Table Order", qty: 1, priceRupees: totalRupees, subtotalRupees: totalRupees }];

  const receiptData: ReceiptData = {
    orderId,
    orderNo,
    tableLabel,
    zone,
    items: defaultReceiptItems,
    subtotalRupees: Math.round(totalRupees / 1.05),
    taxRupees: Math.round(totalRupees - totalRupees / 1.05),
    totalRupees,
    paymentMethod: "UPI",
    transactionId,
    paidAt: new Date().toISOString(),
    merchantName: "smol café Tapovan",
    gstin: "05AAACH7409R1ZZ",
  };

  if (showReceipt) {
    return (
      <DigitalReceiptModal
        receipt={receiptData}
        onClose={() => setShowReceipt(false)}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-[#241F1C]/35 dark:bg-black/45 backdrop-blur-md transition-opacity duration-200 p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] sm:max-h-[88vh] w-full max-w-lg sm:max-w-[430px] flex-col rounded-t-[2.5rem] sm:rounded-[2.5rem] border border-[#E2D7C7] dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1E1A17] text-[#241F1C] dark:text-[#F3E7D3] shadow-2xl overflow-hidden animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Handle */}
        <div className="mx-auto mt-2.5 h-1 w-12 rounded-full bg-[#C9AE8B]/40 dark:bg-stone-700 sm:hidden" />

        {/* Sticky Top Header Bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-5 pt-3 pb-2.5 bg-[#FAF4EB]/95 dark:bg-[#1E1A17]/95 backdrop-blur-xs border-b border-[#E2D7C7] dark:border-stone-800/80 transition-colors">
          <div className="flex items-center gap-2">
            <Image
              src="/logo-transparent.png"
              alt="smol café"
              width={26}
              height={38}
              className="h-8 w-auto object-contain dark:hidden"
              priority
            />
            <Image
              src="/logo-dark-transparent.png"
              alt="smol café"
              width={26}
              height={38}
              className="h-8 w-auto object-contain hidden dark:block"
              priority
            />
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 px-2.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wider">
              PAYMENT VERIFIED &amp; SETTLED
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EFE7DC] dark:bg-stone-800 text-[#786F66] dark:text-stone-400 hover:bg-[#E2D6C5] dark:hover:bg-stone-700 active:scale-95 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
          {/* Celebratory Hero Card */}
          <div className="text-center space-y-1.5 pt-1 pb-1">
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/70 border-2 border-emerald-300/80 dark:border-emerald-700/60 text-emerald-600 dark:text-emerald-400 shadow-inner">
              <CheckCircle2 className="h-10 w-10 animate-bounce stroke-[2.5]" />
              <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#FCD34D] text-[#78350F] shadow-sm animate-pulse">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
            </div>

            <h2 className="font-serif text-3xl font-bold tracking-tight text-[#241F1C] dark:text-white pt-1">
              ₹{totalRupees} Received!
            </h2>

            <p className="font-serif italic text-xs text-[#725039] dark:text-[#C9AE8B]">
              Paid via {appName} • Table {tableLabel} ({zone})
            </p>
            <div className="font-mono text-[11px] text-[#8C7E72] dark:text-stone-400 uppercase tracking-wide">
              Txn ID: {transactionId}
            </div>
          </div>

          {/* Smol Club Loyalty Points Card (Coming Soon) */}
          <div className="rounded-2xl border border-[#FDE68A] dark:border-amber-800/40 bg-[#FFFBEB] dark:bg-amber-950/25 p-4 space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FCD34D] text-[#78350F] text-sm font-bold shadow-xs">
                  ★
                </div>
                <div>
                  <span className="block font-mono text-[10px] uppercase font-bold text-[#78350F] dark:text-amber-300 tracking-wider">
                    SMOL CLUB LOYALTY • COMING SOON
                  </span>
                  <span className="font-serif text-sm font-bold text-[#241F1C] dark:text-white">
                    Patron Perks &amp; Rewards Launching Soon
                  </span>
                </div>
              </div>
              <span className="rounded-full bg-[#B72E35] text-white px-2.5 py-0.5 font-mono text-[10px] font-bold shadow-xs">
                Coming Soon 🚀
              </span>
            </div>

            <div className="border-t border-[#FDE68A]/80 dark:border-amber-900/50 pt-2.5 flex items-center justify-between text-xs text-[#78350F] dark:text-stone-300">
              <span>Tier Status: <strong>Regular Patron Pass</strong></span>
              <span className="font-mono text-[11px] text-[#B72E35] dark:text-[#F87171] font-bold">
                +{pointsEarned} Points Reserved
              </span>
            </div>
          </div>

          {/* Primary Actions: Digital Receipt & Track Kitchen Order */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setShowReceipt(true)}
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-[#E2D7C7] dark:border-stone-700 bg-white dark:bg-stone-900/80 py-3 px-3 font-serif text-xs font-bold text-[#241F1C] dark:text-stone-200 shadow-xs hover:bg-[#F3E7D3]/40 dark:hover:bg-stone-800 transition active:scale-98 cursor-pointer"
            >
              <Receipt className="h-4 w-4 text-[#B72E35] dark:text-[#FF6B6B]" />
              <span className="truncate">View Digital Tax Chit →</span>
            </button>

            <Link
              href="/orders"
              onClick={onClose}
              className="flex items-center justify-center gap-1.5 rounded-2xl bg-[#B72E35] hover:bg-[#9E242B] py-3 px-3 font-serif text-xs font-bold text-white shadow-md active:scale-98 transition cursor-pointer"
            >
              <Clock className="h-4 w-4 shrink-0" />
              <span className="truncate">Track Kitchen Prep Live →</span>
            </Link>
          </div>

          {/* Toast alert if dessert was added */}
          {addedItemName && (
            <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-100 dark:bg-emerald-950/80 p-3 text-xs text-emerald-900 dark:text-emerald-300 flex items-center justify-between animate-scale-in">
              <span className="font-serif">
                ✓ <strong>{addedItemName}</strong> added to your table order!
              </span>
              <button
                onClick={() => {
                  onClose();
                  openCart();
                }}
                className="font-bold underline text-emerald-800 dark:text-emerald-200 hover:text-emerald-950 ml-2 cursor-pointer"
              >
                Open Cart
              </button>
            </div>
          )}

          {/* "Fancy a Sweet Treat While You Wait?" - Re-order / Add Dessert */}
          <div className="rounded-3xl border border-[#E2D7C7] dark:border-stone-800 bg-white dark:bg-[#1A1614] p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coffee className="h-4 w-4 text-[#B72E35] dark:text-[#FF6B6B]" />
                <h3 className="font-serif text-sm font-bold text-[#241F1C] dark:text-white">
                  Fancy a Sweet Treat While You Wait?
                </h3>
              </div>
              <span className="rounded-full bg-[#FAF4EB] dark:bg-stone-800 border border-[#E2D7C7] dark:border-stone-700 px-2.5 py-0.5 text-[10px] font-mono text-[#725039] dark:text-stone-400">
                Quick Add
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {DESSERT_SUGGESTIONS.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-2xl border border-[#E2D7C7]/80 dark:border-stone-800 bg-[#FAF4EB]/60 dark:bg-stone-900/40 hover:bg-[#FAF4EB] dark:hover:bg-stone-900 transition"
                >
                  <div className="space-y-0.5 pr-1 min-w-0 flex-1">
                    <span className="inline-block text-[9px] font-mono font-bold text-[#B72E35] dark:text-[#FF6B6B] uppercase">
                      {item.tag}
                    </span>
                    <p className="font-serif text-xs font-bold text-[#241F1C] dark:text-stone-200 truncate">
                      {item.name}
                    </p>
                    <p className="font-serif font-bold text-xs text-[#241F1C] dark:text-white">
                      ₹{item.priceRupees}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleQuickAddDessert(item)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#B72E35] text-white hover:bg-[#9E242B] active:scale-90 transition shadow-xs cursor-pointer ml-1"
                    title={`Add ${item.name} to table`}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Cafe Wi-Fi & Ambiance Perks */}
          <div className="flex items-center justify-between rounded-2xl border border-[#E2D7C7] dark:border-stone-800 bg-[#F3E7D3]/40 dark:bg-stone-900/40 p-3.5 text-xs text-[#725039] dark:text-stone-400">
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-[#B72E35] dark:text-[#FF6B6B]" />
              <div>
                <span className="block font-bold text-[#241F1C] dark:text-stone-200">
                  Café High-Speed Wi-Fi
                </span>
                <span className="font-mono text-[11px]">Pass: smolcoffee2026</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyWifi}
              className="flex items-center gap-1 rounded-lg border border-[#C9AE8B]/40 dark:border-stone-700 bg-white dark:bg-stone-800 px-2.5 py-1 text-[11px] font-mono text-[#241F1C] dark:text-stone-300 hover:bg-[#FAF4EB] transition cursor-pointer"
            >
              {copiedWifi ? (
                <>
                  <Check className="h-3 w-3 text-emerald-600" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
