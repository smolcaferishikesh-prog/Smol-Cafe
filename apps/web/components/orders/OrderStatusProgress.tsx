"use client";

import React from "react";
import type { OrderStatus } from "@smol-cafe/db";
import { Clock, Check, ChefHat, Bell, Sparkles, XCircle } from "lucide-react";

interface OrderStatusProgressProps {
  status: OrderStatus;
}

const STEPS = [
  { key: "PAID", label: "Paid", icon: Check },
  { key: "CONFIRMED", label: "Confirmed", icon: Check },
  { key: "PREPARING", label: "Preparing", icon: ChefHat },
  { key: "READY", label: "Ready", icon: Bell },
  { key: "SERVED", label: "Delivered", icon: Sparkles },
];

function getStepIndex(status: OrderStatus): number {
  switch (status) {
    case "DRAFT":
    case "PENDING_CONFIRMATION":
    case "SUBMITTED":
      return 1;
    case "CONFIRMED":
    case "ACCEPTED":
      return 1;
    case "PREPARING":
      return 2;
    case "READY":
      return 3;
    case "COMPLETED":
    case "SERVED":
    case "CLOSED":
      return 4;
    case "CANCELLED":
    case "REJECTED":
      return -1;
    default:
      return 1;
  }
}

export const OrderStatusProgress: React.FC<OrderStatusProgressProps> = ({ status }) => {
  const currentIndex = getStepIndex(status);
  const isCancelled = status === "CANCELLED" || status === "REJECTED";

  if (isCancelled) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50/80 p-3.5 text-center text-xs font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
        <XCircle className="h-4 w-4 shrink-0" />
        <span>Order Cancelled by Cashier</span>
      </div>
    );
  }

  const progressPercent =
    currentIndex <= 0
      ? 0
      : (Math.min(currentIndex, STEPS.length - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="w-full py-4">
      <div className="relative flex items-center justify-between">
        {/* Background Recessed Glass Channel Track */}
        <div className="absolute left-[18px] right-[18px] top-[18px] -translate-y-1/2 h-[7px] rounded-full bg-black/[0.08] dark:bg-white/[0.07] border border-black/5 dark:border-white/10 shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.15)] -z-0 overflow-hidden" />

        {/* Liquid Energy Progress Fill Tube with Specular Shine */}
        <div
          className="absolute left-[18px] top-[18px] -translate-y-1/2 h-[7px] rounded-full bg-gradient-to-r from-[#EF4444] via-[#B72E35] to-[#781016] dark:from-[#C084FC] dark:via-[#9333EA] dark:to-[#6B21A8] shadow-[0_2px_10px_rgba(183,46,53,0.5),inset_0_1px_1.5px_rgba(255,255,255,0.75)] dark:shadow-[0_0_14px_rgba(168,85,247,0.85),0_0_24px_rgba(168,85,247,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.85)] transition-all duration-700 ease-[cubic-bezier(0.25,1,0.35,1)] -z-0 overflow-hidden"
          style={{
            width: `calc((100% - 36px) * ${progressPercent / 100})`,
          }}
        >
          {/* Internal Specular Core Shine Filament */}
          <div className="h-[2px] w-full bg-gradient-to-r from-white/90 via-white/50 to-white/20 rounded-full mt-[0.5px] opacity-90" />
        </div>

        {STEPS.map((step, idx) => {
          const isDone = idx <= currentIndex;
          const isCurrent = idx === currentIndex;

          return (
            <div key={step.key} className="relative z-10 flex flex-col items-center">
              {/* Outer Ambient Breathing Halo for the Current Active Node */}
              {isCurrent && (
                <span className="absolute -top-1.5 -left-1.5 h-12 w-12 rounded-full bg-[#B72E35]/20 dark:bg-purple-500/25 blur-xs animate-pulse pointer-events-none" />
              )}

              {/* Node Glass Orb */}
              <div
                className={`relative flex h-9 w-9 items-center justify-center rounded-full text-xs font-mono font-bold transition-all duration-500 ease-[cubic-bezier(0.25,1,0.35,1)] ${
                  isCurrent
                    ? "bg-gradient-to-b from-[#EF4444] via-[#B72E35] to-[#6E0F14] dark:from-[#C084FC] dark:via-[#9333EA] dark:to-[#581C87] text-white ring-4 ring-[#B72E35]/30 dark:ring-purple-500/40 scale-110 shadow-[0_6px_16px_rgba(183,46,53,0.5),inset_0_1.5px_1.5px_rgba(255,255,255,0.85),inset_0_-2px_4px_rgba(0,0,0,0.35)] dark:shadow-[0_0_20px_rgba(168,85,247,0.75),inset_0_1.5px_1.5px_rgba(255,255,255,0.85),inset_0_-2px_4px_rgba(0,0,0,0.45)] border border-white/70 dark:border-purple-300/60"
                    : isDone
                      ? "bg-gradient-to-b from-[#EF4444] via-[#B72E35] to-[#6E0F14] dark:from-[#C084FC] dark:via-[#9333EA] dark:to-[#581C87] text-white shadow-[0_3px_10px_rgba(183,46,53,0.35),inset_0_1.5px_1.5px_rgba(255,255,255,0.75),inset_0_-2px_4px_rgba(0,0,0,0.3)] dark:shadow-[0_0_12px_rgba(168,85,247,0.4),inset_0_1.5px_1.5px_rgba(255,255,255,0.75),inset_0_-2px_4px_rgba(0,0,0,0.4)] border border-white/55 dark:border-purple-300/45"
                      : "bg-[#FAF4EB]/80 dark:bg-[#1A1412]/80 backdrop-blur-md text-[#725039]/50 dark:text-[#C9AE8B]/40 border border-[#C9AE8B]/40 dark:border-white/10 shadow-[inset_0_1px_3px_rgba(0,0,0,0.08)]"
                }`}
              >
                {/* Curved Specular Glass Arc Highlight */}
                {isDone && (
                  <span className="absolute inset-x-1.5 top-0.5 h-[42%] rounded-full bg-gradient-to-b from-white/75 via-white/20 to-transparent pointer-events-none" />
                )}

                <span className="relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
                  {isDone ? <step.icon className="h-4 w-4 stroke-[2.2]" /> : idx + 1}
                </span>
              </div>

              {/* Step Label */}
              <span
                className={`mt-2 text-[11px] tracking-tight font-serif transition-all duration-300 ${
                  isCurrent
                    ? "font-bold text-[#B72E35] dark:text-purple-300 drop-shadow-2xs scale-105"
                    : isDone
                      ? "text-[#241F1C] dark:text-purple-200/90 font-semibold"
                      : "text-[#725039]/55 dark:text-[#C9AE8B]/40 font-normal"
                }`}
              >
                {step.label.toLowerCase()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
