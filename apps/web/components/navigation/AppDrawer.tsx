"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";


import {
  Home,
  BookOpen,
  Armchair,
  Package,
  Receipt,
  Music,
  Calendar,
  Gift,
  ChefHat,
  CreditCard,
  Zap,
  Edit3,
  DollarSign,
  Ticket,
  Trophy,
  BarChart2,
  X,
  Coffee,
  Download,
} from "lucide-react";

interface AppDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tableLabel?: string;
}

export const AppDrawer: React.FC<AppDrawerProps> = ({
  isOpen,
  onClose,
  tableLabel,
}) => {
  const pathname = usePathname();

  if (!isOpen) return null;

  const navSections = [
    {
      title: "Dine & Experience",
      items: [
        { name: "Home", href: "/", icon: Home, desc: "Daily specials & bento cards" },
        { name: "Smol Menu", href: "/menu", icon: BookOpen, desc: "Artisanal comfort items & pairings" },
        { name: "Your Table", href: "/table", icon: Armchair, desc: `Table ${tableLabel || "01"} seated round` },
        { name: "Live Order Status", href: "/orders", icon: Package, desc: "Live kitchen brewing tracker" },
        { name: "Settle Up / Bill", href: "/bill", icon: Receipt, desc: "UPI, Cards, Wallets & digital receipt" },
        { name: "Café Jukebox", href: "/music", icon: Music, desc: "Now playing, song requests & votes" },
        { name: "Community Events", href: "/events", icon: Calendar, desc: "Jam sessions, chess & game nights" },
        { name: "Smol Loyalty Pass (Coming Soon)", href: "/profile", icon: Gift, desc: "Smol Club Rewards & Patron Pass launching soon" },
      ],
    },
    {
      title: "Staff Floor Ops",
      items: [
        { name: "Kitchen Display (KDS)", href: "/kitchen", icon: ChefHat, desc: "Live order queue & ticket states" },
        { name: "Cashier Desk", href: "/cashier", icon: CreditCard, desc: "Table map, cash billing & invoices" },
      ],
    },
    {
      title: "Admin Control Tower",
      items: [
        { name: "Admin Dashboard", href: "/admin", icon: Zap, desc: "Master café management center" },
        { name: "Blackboard Announcements", href: "/admin/blackboard", icon: Edit3, desc: "Daily chalkboard chits & specials" },
        { name: "Procurement & Stock POs", href: "/admin/procurement", icon: Package, desc: "Ingredient inventory & purchase orders" },
        { name: "Category Budgets", href: "/admin/budgets", icon: DollarSign, desc: "Monthly expense limits & burn rates" },
        { name: "Events Manager", href: "/admin/events", icon: Ticket, desc: "Create events & attendee RSVPs" },
        { name: "Loyalty Rewards Config", href: "/admin/rewards", icon: Trophy, desc: "Points multiplier & reward catalog" },
        { name: "Jukebox Admin", href: "/admin/music", icon: Music, desc: "Manage music queue & requests" },
        { name: "System Observability", href: "/admin/observability", icon: BarChart2, desc: "Webhooks, RPCs & server health" },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative z-50 flex h-full w-[85%] max-w-sm flex-col border-r border-[#C9AE8B]/40 bg-[#FAF4EB] shadow-2xl animate-in slide-in-from-left duration-300 ease-out">
        {/* Header */}
        <div className="border-b border-[#C9AE8B]/40 p-4 flex items-center justify-between bg-[#F3E7D3]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#B72E35] text-white font-serif font-bold text-lg shadow-sm hover-lift">
              s
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-[#B72E35] lowercase tracking-tight">
                smol café
              </h2>
              <p className="font-serif italic text-xs text-[#725039]">
                Rishikesh • All Features
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#725039] hover:bg-black/5 active:scale-95 transition-transform"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* Quick Table Switcher Bar */}
        <div className="border-b border-[#C9AE8B]/30 bg-[#FAF4EB] px-4 py-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-[11px] font-bold text-[#725039] uppercase">
              Seated Table:
            </span>
            <div className="flex items-center gap-1 overflow-x-auto py-0.5 max-w-[220px]">
              {Array.from(new Set(["01", "02", "03", "04", "05", "06", ...(tableLabel ? [tableLabel.padStart(2, "0")] : [])])).map((label) => {
                const isSelected = tableLabel === label || (!tableLabel && label === "01");
                return (
                  <Link
                    key={label}
                    href={`/t/table-${label}`}
                    onClick={onClose}
                    className={`shrink-0 rounded-md px-2 py-0.5 font-mono text-xs font-bold transition-all duration-150 active:scale-95 ${
                      isSelected
                        ? "bg-[#B72E35] text-white shadow-xs scale-105"
                        : "border border-[#C9AE8B]/50 bg-[#F3E7D3] text-[#241F1C] hover:bg-[#EFE7DC]"
                    }`}
                  >
                    T{label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scrollable Navigation Links */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-2">
              <h3 className="font-serif text-xs font-bold text-[#725039] uppercase tracking-wider px-1">
                {section.title}
              </h3>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`group flex items-start gap-3 rounded-xl p-2.5 transition-all duration-150 active:scale-[0.98] ${
                        isActive
                          ? "bg-[#B72E35]/10 text-[#B72E35] font-bold"
                          : "text-[#241F1C] hover:bg-[#F3E7D3]"
                      }`}
                    >
                      <item.icon className="h-5 w-5 shrink-0 mt-0.5 transition-transform group-hover:scale-110 text-[#B72E35]" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className={`font-serif text-sm font-bold ${isActive ? "text-white" : "text-[#1C1917]"}`}>
                            {item.name}
                          </p>
                          {isActive && (
                            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                          )}
                        </div>
                        <p className={`font-serif italic text-xs truncate ${isActive ? "text-white/80" : "text-[#786F66]"}`}>
                          {item.desc}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>


        {/* App Install Action */}
        <div className="p-3 border-t border-[#C9AE8B]/30 bg-[#FAF4EB]">
          <button
            type="button"
            onClick={() => {
              onClose();
              window.dispatchEvent(new CustomEvent("open-install-prompt"));
            }}
            className="w-full flex items-center justify-between p-2.5 rounded-xl border border-[#B72E35]/30 bg-[#B72E35]/10 hover:bg-[#B72E35]/15 text-[#B72E35] transition-colors text-left group"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#B72E35] text-white">
                <Download className="h-4 w-4 shrink-0" />
              </div>
              <div>
                <span className="font-serif text-sm font-bold block leading-tight text-[#241F1C]">install smol app</span>
                <span className="font-serif italic text-[11px] text-[#725039]">add to home screen</span>
              </div>
            </div>
            <span className="text-[10px] uppercase font-mono tracking-wider bg-[#B72E35] text-white px-2 py-0.5 rounded font-semibold">
              Install
            </span>
          </button>
        </div>

        {/* Footer */}
        <div className="border-t border-[#E8DFD3] bg-[#F5EFEB] p-3 text-center">
          <p className="font-serif text-[11px] text-[#786F66]">
            smol café v0.1 • 100% Functional App
          </p>
        </div>
      </div>
    </div>
  );
};
