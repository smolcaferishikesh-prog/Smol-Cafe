"use client";

import React from "react";
import { useCart } from "@/context/CartContext";

export const FloatingCartBar: React.FC = () => {
  const { totalCount, subtotalPaise, openCart } = useCart();
  const [guestName, setGuestName] = React.useState("");

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("smol_guest_name");
      if (saved) setGuestName(saved);
    }
  }, []);

  if (totalCount === 0) return null;

  // Match CartDrawer & server 5% restaurant GST
  const taxPaise = Math.round(subtotalPaise * 0.05);
  const totalRupees = Math.round((subtotalPaise + taxPaise) / 100);

  return (
    <aside
      aria-label="Cart summary"
      className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] sm:bottom-[calc(6.25rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-40 px-3 pointer-events-none select-none animate-fade-in-up"
    >
      <div className="relative pointer-events-auto mx-auto max-w-[335px] sm:max-w-[355px]">
        {/* Ambient Backlight Glow Diffusion */}
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-red-600/15 via-[#B72E35]/20 to-amber-600/15 dark:from-purple-600/25 dark:via-purple-800/35 dark:to-purple-600/25 blur-xl -z-10 opacity-90" />

        {/* Liquid Ruby (Light) / Amethyst Purple (Dark) Glass Bar */}
        <div className="group relative overflow-hidden flex items-center justify-between rounded-2xl bg-gradient-to-b from-[#E03A43]/75 via-[#B72E35]/85 to-[#7D1217]/95 dark:from-[#A855F7]/75 dark:via-[#7E22CE]/85 dark:to-[#4C1D95]/95 px-3.5 py-2 sm:px-4 sm:py-2.5 text-white backdrop-blur-[20px] backdrop-saturate-[180%] border border-white/55 dark:border-purple-300/40 shadow-[0_12px_32px_rgba(183,46,53,0.45),inset_0_1.5px_1.5px_rgba(255,255,255,0.85),inset_0_-1.5px_2px_rgba(0,0,0,0.4),inset_0_0_16px_rgba(255,140,140,0.35)] dark:shadow-[0_12px_36px_rgba(126,34,206,0.55),inset_0_1.5px_1.5px_rgba(255,255,255,0.85),inset_0_-1.5px_2px_rgba(0,0,0,0.5),inset_0_0_18px_rgba(192,132,252,0.45)] transition-all">
          {/* Curved Specular Glass Gloss Reflection */}
          <span className="absolute inset-x-3 top-0.5 h-[42%] rounded-full bg-gradient-to-b from-white/50 via-white/15 to-transparent pointer-events-none opacity-90" />

          <div className="relative z-10 flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-[#B72E35] dark:text-[#7E22CE] shadow-md shrink-0">
              {totalCount}
            </div>
            <div className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
              <span className="text-[9.5px] text-white/85 font-mono uppercase tracking-wider block leading-none">
                {guestName ? `${guestName}'s Order` : "Your Order"}
              </span>
              <p className="font-serif text-base font-bold tracking-tight leading-tight mt-0.5">
                ₹{totalRupees}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openCart}
            className="relative z-10 flex items-center gap-1.5 rounded-xl bg-white/20 hover:bg-white/30 dark:bg-white/15 dark:hover:bg-white/25 border border-white/30 backdrop-blur-md px-3.5 py-1.5 font-serif text-xs font-bold text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)] transition active:scale-95 touch-manipulation cursor-pointer drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]"
          >
            <span>View Cart</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
