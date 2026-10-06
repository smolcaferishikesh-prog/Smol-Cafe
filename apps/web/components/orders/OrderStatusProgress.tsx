"use client";

import React from "react";
import type { OrderStatus } from "@smol-cafe/db";
import {
  BadgeCheck,
  ClipboardCheck,
  Flame,
  BellRing,
  Sparkles,
  XCircle,
} from "lucide-react";

interface OrderStatusProgressProps {
  status: OrderStatus;
}

const STEPS = [
  {
    key: "PAID",
    label: "Paid",
    icon: BadgeCheck,
    description: "Payment settled",
  },
  {
    key: "CONFIRMED",
    label: "Confirmed",
    icon: ClipboardCheck,
    description: "Verified by Cashier",
  },
  {
    key: "PREPARING",
    label: "Preparing",
    icon: Flame,
    description: "Cooking & Brewing",
  },
  {
    key: "READY",
    label: "Ready",
    icon: BellRing,
    description: "Piping Hot & Ready",
  },
  {
    key: "SERVED",
    label: "Delivered",
    icon: Sparkles,
    description: "Served at Table",
  },
];

function getStepIndex(status: OrderStatus): number {
  switch (status) {
    case "DRAFT":
    case "PENDING_CONFIRMATION":
    case "SUBMITTED":
      return -1;
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
      return -1;
  }
}

export const OrderStatusProgress: React.FC<OrderStatusProgressProps> = ({ status }) => {
  const currentIndex = getStepIndex(status);
  const isCancelled = status === "CANCELLED" || status === "REJECTED";

  if (isCancelled) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-red-200/80 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/40 p-3.5 text-center text-xs font-semibold text-red-700 dark:text-red-300 shadow-xs">
        <XCircle className="h-4 w-4 shrink-0 text-red-500" />
        <span>Order Cancelled / Rejected by Cashier</span>
      </div>
    );
  }

  const progressPercent =
    currentIndex < 0
      ? 0
      : (Math.min(currentIndex, STEPS.length - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="w-full py-3 select-none">
      <div className="relative flex items-center justify-between">
        {/* Recessed Mechanical Metallic Track with Inset Shadow */}
        <div className="absolute left-[18px] right-[18px] top-[18px] -translate-y-1/2 h-[8px] rounded-full bg-stone-300/40 dark:bg-black/60 border border-stone-400/30 dark:border-white/10 shadow-[inset_0_2px_4px_rgba(0,0,0,0.25)] -z-0 overflow-hidden" />

        {/* Liquid Energy Fill Tube with Specular Top Filament */}
        <div
          className="absolute left-[18px] top-[18px] -translate-y-1/2 h-[8px] rounded-full bg-gradient-to-r from-[#D92D37] via-[#B72E35] to-[#801016] dark:from-[#D8B4FE] dark:via-[#A855F7] dark:to-[#7E22CE] shadow-[0_2px_12px_rgba(183,46,53,0.6),inset_0_1.5px_2px_rgba(255,255,255,0.85)] dark:shadow-[0_0_16px_rgba(168,85,247,0.9),0_0_30px_rgba(168,85,247,0.5),inset_0_1.5px_2px_rgba(255,255,255,0.9)] transition-all duration-700 ease-[cubic-bezier(0.25,1,0.35,1)] -z-0 overflow-hidden"
          style={{
            width: `calc((100% - 36px) * ${progressPercent / 100})`,
          }}
        >
          {/* Specular Core Filament Reflection */}
          <div className="h-[2.5px] w-full bg-gradient-to-r from-white/95 via-white/60 to-white/20 rounded-full mt-[0.5px] opacity-90 animate-pulse" />
        </div>

        {STEPS.map((step, idx) => {
          const isDone = currentIndex >= 0 && idx <= currentIndex;
          const isCurrent = idx === currentIndex;
          const StepIcon = step.icon;

          return (
            <div key={step.key} className="relative z-10 flex flex-col items-center group">
              {/* Outer Glowing Breathing Ring for Current Active Step */}
              {isCurrent && (
                <span className="absolute -top-1.5 -left-1.5 h-12 w-12 rounded-full bg-[#B72E35]/30 dark:bg-purple-500/35 blur-xs animate-ping pointer-events-none" />
              )}
              {isCurrent && (
                <span className="absolute -top-1 -left-1 h-11 w-11 rounded-full bg-[#B72E35]/20 dark:bg-purple-500/25 blur-[2px] animate-pulse pointer-events-none" />
              )}

              {/* 3D Skeuomorphic Glass Node */}
              <div
                className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-all duration-500 ease-[cubic-bezier(0.25,1,0.35,1)] ${
                  isCurrent
                    ? "bg-gradient-to-b from-[#FF5E62] via-[#B72E35] to-[#5C0A0E] dark:from-[#E9D5FF] dark:via-[#9333EA] dark:to-[#4C1D95] text-white ring-4 ring-[#B72E35]/35 dark:ring-purple-500/50 scale-110 shadow-[0_8px_20px_rgba(183,46,53,0.55),inset_0_2px_3px_rgba(255,255,255,0.9),inset_0_-2.5px_4px_rgba(0,0,0,0.45)] dark:shadow-[0_0_24px_rgba(168,85,247,0.85),inset_0_2px_3px_rgba(255,255,255,0.9),inset_0_-2.5px_4px_rgba(0,0,0,0.55)] border border-white/80 dark:border-purple-200"
                    : isDone
                      ? "bg-gradient-to-b from-[#F87171] via-[#B72E35] to-[#6E0F14] dark:from-[#C084FC] dark:via-[#9333EA] dark:to-[#581C87] text-white shadow-[0_4px_12px_rgba(183,46,53,0.4),inset_0_2px_2.5px_rgba(255,255,255,0.8),inset_0_-2px_4px_rgba(0,0,0,0.35)] dark:shadow-[0_0_14px_rgba(168,85,247,0.5),inset_0_2px_2.5px_rgba(255,255,255,0.8),inset_0_-2px_4px_rgba(0,0,0,0.45)] border border-white/60 dark:border-purple-300/50"
                      : "bg-[#FAF4EB]/90 dark:bg-[#1A1412]/90 backdrop-blur-md text-[#725039]/45 dark:text-[#C9AE8B]/40 border border-[#C9AE8B]/40 dark:border-white/10 shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.12)]"
                }`}
              >
                {/* Curved Specular Glass Bubble Highlight */}
                {isDone && (
                  <span className="absolute inset-x-1.5 top-0.5 h-[42%] rounded-full bg-gradient-to-b from-white/85 via-white/25 to-transparent pointer-events-none" />
                )}

                {/* Bottom Bounce Light Reflection */}
                {isDone && (
                  <span className="absolute inset-x-2 bottom-0.5 h-[22%] rounded-full bg-gradient-to-t from-white/30 to-transparent pointer-events-none" />
                )}

                {/* Realistic Icon or Inactive Icon */}
                <span className="relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                  <StepIcon
                    className={`h-4 w-4 transition-transform duration-300 ${
                      isCurrent
                        ? "stroke-[2.4] scale-105"
                        : isDone
                          ? "stroke-[2.2]"
                          : "stroke-[1.8] opacity-50"
                    }`}
                  />
                </span>
              </div>

              {/* Step Title Label */}
              <span
                className={`mt-2 text-[10.5px] sm:text-[11px] tracking-tight font-serif capitalize transition-all duration-300 ${
                  isCurrent
                    ? "font-black text-[#B72E35] dark:text-purple-300 drop-shadow-xs scale-105"
                    : isDone
                      ? "text-[#241F1C] dark:text-purple-200/90 font-bold"
                      : "text-[#725039]/55 dark:text-[#C9AE8B]/40 font-medium"
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
