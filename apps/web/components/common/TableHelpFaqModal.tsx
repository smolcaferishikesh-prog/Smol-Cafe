"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  HelpCircle,
  Wifi,
  Copy,
  Check,
  UtensilsCrossed,
  CreditCard,
  Bell,
  ArrowLeftRight,
  X,
  ChevronDown,
} from "lucide-react";
import { getUpiConfig } from "@/lib/upi";

interface TableHelpFaqModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableLabel?: string;
  onOpenCallStaff?: () => void;
}

export const TableHelpFaqModal: React.FC<TableHelpFaqModalProps> = ({
  isOpen,
  onClose,
  tableLabel = "01",
  onOpenCallStaff,
}) => {
  const router = useRouter();
  const [copiedWifi, setCopiedWifi] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>("ordering");

  if (!isOpen) return null;

  const config = getUpiConfig();
  const wifiSsid = config.wifiSsid || "smol_cafe_guest";
  const wifiPassword = config.wifiPassword || "slowcoffeewarmvibes";

  const handleCopyWifi = () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(wifiPassword);
      }
      setCopiedWifi(true);
      setTimeout(() => setCopiedWifi(false), 2000);
    } catch {
      // fallback
    }
  };

  const toggleSection = (section: string) => {
    setOpenSection((prev) => (prev === section ? null : section));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-[#FAF4EB] dark:bg-[#1E1916] p-5 sm:p-6 text-left shadow-2xl border border-[#C9AE8B]/50 dark:border-white/10 text-[#241F1C] dark:text-[#F3E7D3] animate-scale-in max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#C9AE8B]/30 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 dark:bg-purple-500/20 text-amber-700 dark:text-purple-300">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-[#241F1C] dark:text-[#FAF4EB] leading-tight">
                Table {tableLabel} Help
              </h3>
              <p className="text-[11px] font-mono text-[#725039] dark:text-[#C9AE8B]">
                Cafe guide &amp; quick answers
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help modal"
            className="rounded-full p-1.5 text-[#725039] hover:bg-[#C9AE8B]/30 dark:text-[#C9AE8B] dark:hover:bg-white/10 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 py-3 space-y-2.5 pr-0.5">
          {/* FAQ 1: How does table ordering work? */}
          <div className="rounded-2xl border border-[#C9AE8B]/40 dark:border-white/10 bg-white/70 dark:bg-[#251E1B] overflow-hidden transition">
            <button
              type="button"
              onClick={() => toggleSection("ordering")}
              className="w-full flex items-center justify-between p-3.5 text-left font-serif text-xs font-bold text-[#241F1C] dark:text-[#FAF4EB] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4 text-[#B72E35] dark:text-purple-400 shrink-0" />
                <span>How to place an order?</span>
              </span>
              <ChevronDown
                className={`h-4 w-4 text-stone-400 transition-transform ${
                  openSection === "ordering" ? "rotate-180" : ""
                }`}
              />
            </button>
            {openSection === "ordering" && (
              <div className="px-3.5 pb-3.5 pt-1 text-[11.5px] text-[#5C534B] dark:text-[#C5BAAF] font-sans leading-relaxed border-t border-[#C9AE8B]/20 dark:border-white/5 space-y-1.5">
                <p>1. Browse the live digital menu &amp; add your favorite dishes to the cart.</p>
                <p>2. Enter your name and tap <strong>Place Order</strong>.</p>
                <p>3. Kitchen prepares it fresh and staff serves it directly to <strong>Table {tableLabel}</strong>.</p>
              </div>
            )}
          </div>

          {/* FAQ 2: Cafe Wi-Fi Credentials */}
          <div className="rounded-2xl border border-[#C9AE8B]/40 dark:border-white/10 bg-white/70 dark:bg-[#251E1B] overflow-hidden transition">
            <button
              type="button"
              onClick={() => toggleSection("wifi")}
              className="w-full flex items-center justify-between p-3.5 text-left font-serif text-xs font-bold text-[#241F1C] dark:text-[#FAF4EB] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Cafe Wi-Fi Network</span>
              </span>
              <ChevronDown
                className={`h-4 w-4 text-stone-400 transition-transform ${
                  openSection === "wifi" ? "rotate-180" : ""
                }`}
              />
            </button>
            {openSection === "wifi" && (
              <div className="px-3.5 pb-3.5 pt-1 text-[11.5px] text-[#5C534B] dark:text-[#C5BAAF] font-sans leading-relaxed border-t border-[#C9AE8B]/20 dark:border-white/5 space-y-2">
                <div className="flex items-center justify-between bg-[#F3E7D3]/70 dark:bg-stone-900 p-2 rounded-xl text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-stone-500 block">Wi-Fi Name</span>
                    <span className="font-bold text-[#241F1C] dark:text-white">{wifiSsid}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-[#F3E7D3]/70 dark:bg-stone-900 p-2 rounded-xl text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-stone-500 block">Password</span>
                    <span className="font-bold text-[#241F1C] dark:text-white">{wifiPassword}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyWifi}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#B72E35] dark:bg-purple-600 text-white text-[11px] font-bold hover:opacity-90 active:scale-95 transition cursor-pointer"
                  >
                    {copiedWifi ? (
                      <>
                        <Check className="h-3 w-3" />
                        <span>Copied!</span>
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
            )}
          </div>

          {/* FAQ 3: Billing & Payments */}
          <div className="rounded-2xl border border-[#C9AE8B]/40 dark:border-white/10 bg-white/70 dark:bg-[#251E1B] overflow-hidden transition">
            <button
              type="button"
              onClick={() => toggleSection("payment")}
              className="w-full flex items-center justify-between p-3.5 text-left font-serif text-xs font-bold text-[#241F1C] dark:text-[#FAF4EB] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>How to pay the bill?</span>
              </span>
              <ChevronDown
                className={`h-4 w-4 text-stone-400 transition-transform ${
                  openSection === "payment" ? "rotate-180" : ""
                }`}
              />
            </button>
            {openSection === "payment" && (
              <div className="px-3.5 pb-3.5 pt-1 text-[11.5px] text-[#5C534B] dark:text-[#C5BAAF] font-sans leading-relaxed border-t border-[#C9AE8B]/20 dark:border-white/5 space-y-1">
                <p>• You can pay via <strong>UPI QR</strong> directly on your phone after dining.</p>
                <p>• Cash, cards, and counter payments are also warmly accepted at the cashier desk.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions: Switch table or Call staff */}
        <div className="pt-3 border-t border-[#C9AE8B]/30 dark:border-white/10 space-y-2 shrink-0">
          {onOpenCallStaff && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCallStaff();
              }}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#B72E35] dark:bg-purple-600 text-white px-4 py-2.5 text-xs font-bold shadow-md hover:bg-[#91242C] dark:hover:bg-purple-500 transition active:scale-98 cursor-pointer"
            >
              <Bell className="h-4 w-4" />
              <span>Still need a person? Call Staff</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onClose();
              router.push("/");
            }}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#C9AE8B]/60 dark:border-stone-700 bg-transparent px-3 py-1.5 text-[11px] font-mono text-[#725039] dark:text-[#C9AE8B] hover:bg-[#FAF4EB] dark:hover:bg-[#251E1B] transition cursor-pointer"
          >
            <ArrowLeftRight className="h-3 w-3" />
            <span>Wrong Table? Re-scan or Switch</span>
          </button>
        </div>
      </div>
    </div>
  );
};
