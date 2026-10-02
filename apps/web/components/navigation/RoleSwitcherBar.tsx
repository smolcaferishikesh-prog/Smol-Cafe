"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Coffee, ChefHat, CreditCard, Shield, QrCode } from "lucide-react";
import { TableScannerModal } from "@/components/table/TableScannerModal";

export const RoleSwitcherBar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [currentTable, setCurrentTable] = useState<string>("01");

  useEffect(() => {
    // Check if table cookie or localStorage is set
    try {
      const stored = localStorage.getItem("smol_current_table");
      if (stored) setCurrentTable(stored);
    } catch {
      // ignore
    }
  }, []);

  const roles = [
    {
      id: "customer",
      name: "Customer",
      icon: Coffee,
      href: "/menu",
      active: pathname === "/" || pathname?.startsWith("/menu") || pathname?.startsWith("/table") || pathname?.startsWith("/orders") || pathname?.startsWith("/bill"),
      badge: `Table ${currentTable}`,
    },
    {
      id: "kitchen",
      name: "Kitchen KDS",
      icon: ChefHat,
      href: "/kitchen",
      active: pathname?.startsWith("/kitchen"),
      badge: "KDS Queue",
    },
    {
      id: "barista",
      name: "Barista",
      icon: Coffee,
      href: "/barista",
      active: pathname?.startsWith("/barista"),
      badge: "Brews & Espresso",
    },
    {
      id: "cashier",
      name: "Cashier POS",
      icon: CreditCard,
      href: "/cashier",
      active: pathname?.startsWith("/cashier"),
      badge: "POS & Settlement",
    },
    {
      id: "admin",
      name: "Admin Tower",
      icon: Shield,
      href: "/admin",
      active: pathname?.startsWith("/admin"),
      badge: "Operations Hub",
    },
  ];

  return (
    <>
      <aside aria-label="Portal Mode Switcher" className="sticky top-0 z-40 w-full border-b border-[#241F1C]/10 bg-[#241F1C] text-[#F3E7D3] shadow-md backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-1.5 text-xs">
          {/* Brand & Sync Beacon */}
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="flex items-center gap-1.5 font-serif font-bold text-white tracking-tight hover:text-[#F2C84B] transition"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#B72E35] text-[10px] font-black text-white">
                s
              </span>
              <span className="hidden sm:inline">smol café</span>
            </Link>

            <span className="hidden md:flex items-center gap-1.5 rounded-full border border-stone-700 bg-stone-900/80 px-2 py-0.5 text-[10px] font-mono text-stone-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              Live Sync
            </span>
          </div>

          {/* Role Navigation Pills */}
          <nav aria-label="Role Navigation" className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            {roles.map((r) => {
              const Icon = r.icon;
              return (
                <Link
                  key={r.id}
                  href={r.href}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-medium transition-all text-xs whitespace-nowrap ${
                    r.active
                      ? "bg-[#B72E35] text-white shadow-xs font-semibold"
                      : "text-stone-300 hover:bg-stone-800 hover:text-white"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{r.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Action: Table Scanner Button */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsScannerOpen(true)}
              className="flex items-center gap-1 rounded-lg border border-[#C9AE8B]/40 bg-[#FAF4EB]/10 px-2 py-1 text-[11px] font-medium text-[#F2C84B] hover:bg-[#FAF4EB]/20 transition active:scale-95"
              title="Scan or Change Table QR"
            >
              <QrCode className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Table {currentTable}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Table Scanner Modal */}
      {isScannerOpen && (
        <TableScannerModal
          currentTable={currentTable}
          onClose={() => setIsScannerOpen(false)}
          onSelectTable={(tableLabel) => {
            setCurrentTable(tableLabel);
            if (typeof window !== "undefined") {
              localStorage.setItem("smol_current_table", tableLabel);
            }
            setIsScannerOpen(false);
            router.push(`/table/${tableLabel}`);
          }}
        />
      )}
    </>
  );
};
