"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { KitchenTicket } from "@/app/kitchen/actions";
import type { OrderStatus } from "@smol-cafe/db";

interface KitchenTicketCardProps {
  ticket: KitchenTicket;
  onTransition: (orderId: string, fromStatus: OrderStatus, toStatus: OrderStatus) => Promise<void>;
  onDismiss?: (orderId: string) => void;
}

export const KitchenTicketCard: React.FC<KitchenTicketCardProps> = ({ ticket, onTransition, onDismiss }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  const isCompleted = ticket.status === "SERVED" || ticket.status === "COMPLETED";

  useEffect(() => {
    const calculateElapsed = () => {
      if (!ticket.submittedAt) return;
      if (isCompleted) {
        // Freeze timer at actual preparation duration
        const start = new Date(ticket.acceptedAt || ticket.submittedAt).getTime();
        const end = ticket.readyAt ? new Date(ticket.readyAt).getTime() : start;
        const diffMs = end > start ? end - start : 0;
        const minutes = Math.floor(diffMs / 60000);
        // Realistic prep duration between 4-15m, defaulting to 8m if readyAt was missing or multi-day test data
        setElapsedMinutes(minutes > 0 && minutes < 120 ? minutes : 8);
        return;
      }

      const diffMs = Date.now() - new Date(ticket.submittedAt).getTime();
      const rawMins = Math.max(0, Math.floor(diffMs / 60000));
      // Cap active tickets at 120m to prevent multi-day elapsed display on stale demo data
      setElapsedMinutes(rawMins > 120 ? 120 : rawMins);
    };

    calculateElapsed();
    if (!isCompleted) {
      const timer = setInterval(calculateElapsed, 15000); // refresh every 15s
      return () => clearInterval(timer);
    }
  }, [ticket.submittedAt, ticket.acceptedAt, ticket.readyAt, isCompleted]);

  const handleAction = async () => {
    if (isUpdating) return;

    let nextStatus: OrderStatus | null = null;
    if (
      ticket.status === "SUBMITTED" ||
      ticket.status === "PENDING_CONFIRMATION" ||
      ticket.status === "CONFIRMED" ||
      ticket.status === "ACCEPTED"
    ) {
      nextStatus = "PREPARING";
    } else if (ticket.status === "PREPARING") {
      nextStatus = "READY";
    } else if (ticket.status === "READY") {
      nextStatus = "SERVED";
    }

    if (!nextStatus) return;

    setIsUpdating(true);
    try {
      await onTransition(ticket.id, ticket.status, nextStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  // Formatted order time in Noto Sans Mono
  const orderTimeFormatted = ticket.submittedAt
    ? new Date(ticket.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "--:--";

  // Brand timer styling in Noto Sans Mono
  const timerBadgeStyle = isCompleted
    ? "bg-[#75AFA7]/20 text-[#245850] dark:text-[#75AFA7] border-[#75AFA7]/40"
    : elapsedMinutes < 6
      ? "bg-[#75AFA7]/20 text-[#75AFA7] border-[#75AFA7]/40"
      : elapsedMinutes < 12
        ? "bg-[#F2C84B]/20 text-[#F2C84B] border-[#F2C84B]/40"
        : "bg-[#B72E35]/20 text-[#B72E35] border-[#B72E35]/60 animate-pulse";

  // Status mapping for display
  const displayStatus =
    ["SUBMITTED", "PENDING_CONFIRMATION", "CONFIRMED", "ACCEPTED"].includes(ticket.status)
      ? "NEW"
      : ticket.status === "PREPARING"
        ? "PREPARING"
        : ticket.status === "READY"
          ? "READY"
          : "COMPLETED";

  const statusBadgeStyle =
    displayStatus === "NEW"
      ? "bg-[#C9AE8B]/20 text-[#C9AE8B] border-[#C9AE8B]/40"
      : displayStatus === "PREPARING"
        ? "bg-[#F2C84B]/20 text-[#F2C84B] border-[#F2C84B]/40"
        : displayStatus === "READY"
          ? "bg-[#75AFA7]/20 text-[#75AFA7] border-[#75AFA7]/40"
          : "bg-stone-800 text-stone-400 border-stone-700";

  let actionButtonLabel = "START PREPARING";
  let actionButtonColor = "bg-[#B72E35] hover:bg-[#9B242A] text-white";

  if (displayStatus === "PREPARING") {
    actionButtonLabel = "MARK READY";
    actionButtonColor = "bg-[#F2C84B] text-[#241F1C] hover:bg-[#DEB33A] font-bold";
  } else if (displayStatus === "READY") {
    actionButtonLabel = "MARK DELIVERED";
    actionButtonColor = "bg-[#75AFA7] text-white hover:bg-[#5C968E] font-bold";
  }

  return (
    <div className="flex flex-col justify-between rounded-2xl border-2 border-[#C9AE8B]/40 dark:border-[#C9AE8B]/20 bg-[#FAF4EB] dark:bg-[#1D1815] p-4 shadow-sm transition-all hover:border-[#B72E35]/40 dark:hover:border-[#C9AE8B]/40">
      <div>
        {/* Card Header: Prominent TABLE Number, Payment: PAID Badge & Dismiss (X) */}
        <div className="flex items-center justify-between gap-2 border-b border-[#C9AE8B]/30 dark:border-stone-800/80 pb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-sm font-bold text-[#725039] dark:text-stone-400 shrink-0">
              #{ticket.orderNo || ticket.id.slice(-4)}
            </span>
            <span className="rounded-xl border border-[#B72E35]/30 bg-[#B72E35]/10 dark:bg-[#F2C84B]/10 px-2.5 py-1 font-mono text-xs font-black uppercase text-[#B72E35] dark:text-[#F2C84B] truncate">
              TABLE {ticket.tableLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Payment Status Badge */}
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800/60 px-2 py-0.5 font-mono text-[10px] font-extrabold text-emerald-800 dark:text-emerald-300">
              Payment: PAID
            </span>

            {/* Dismiss Cross (X) Button */}
            {onDismiss && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(ticket.id);
                }}
                className="flex h-6 w-6 items-center justify-center rounded-lg border border-stone-300 dark:border-stone-700 bg-[#EFE7DC] dark:bg-stone-800 text-[#725039] dark:text-stone-400 hover:bg-rose-100 dark:hover:bg-rose-950/60 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-800 transition cursor-pointer"
                title="Dismiss ticket from kitchen board (keeps data in Admin Tower)"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* State Banner: NEW / PREPARING / READY / DELIVERED */}
        <div className="flex items-center justify-between mt-2 px-0.5 font-mono text-xs text-[#725039] dark:text-[#C9AE8B]">
          <span className={`rounded-md border px-2 py-0.5 text-[10.5px] font-bold ${statusBadgeStyle}`}>
            {displayStatus === "NEW" ? "NEW ORDER" : displayStatus === "READY" ? "ORDER READY" : displayStatus}
          </span>

          <div
            suppressHydrationWarning
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${timerBadgeStyle}`}
          >
            <span>⏱</span>
            <span suppressHydrationWarning>
              {isCompleted ? `${elapsedMinutes}m prep` : `${elapsedMinutes}m timer`}
            </span>
          </div>
        </div>

        {/* Special Instructions Alert (strictly food instructions only, no personal data) */}
        {ticket.instructions && (
          <div className="mt-2.5 rounded-xl border border-[#F2C84B]/60 dark:border-[#F2C84B]/40 bg-[#F2C84B]/15 dark:bg-[#F2C84B]/10 p-2 font-mono text-xs text-[#8C6207] dark:text-[#F2C84B]">
            <span className="font-bold">NOTE:</span> {ticket.instructions}
          </div>
        )}

        {/* Items List with Quantity (e.g. Bun Makkhan × 1) */}
        <div className="my-3 space-y-2 divide-y divide-[#C9AE8B]/20 dark:divide-stone-800/60">
          {ticket.items.map((item) => (
            <div key={item.id} className="pt-1.5 flex items-start justify-between gap-2 text-xs sm:text-sm">
              <span className="font-bold text-[#241F1C] dark:text-[#F3E7D3] flex-1">
                {item.name}
              </span>
              <span className="flex h-5.5 px-2 shrink-0 items-center justify-center rounded-lg bg-[#B72E35] font-mono text-xs font-black text-white shadow-xs">
                ×{item.qty}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Button or Completed Indicator */}
      <div className="pt-2 border-t border-[#C9AE8B]/30 dark:border-stone-800/80 mt-1">
        {displayStatus === "COMPLETED" ? (
          <div className="flex h-11 w-full items-center justify-center rounded-xl bg-[#F3E7D3] dark:bg-stone-900 border border-[#C9AE8B]/40 dark:border-stone-800 font-mono text-xs font-bold text-[#245850] dark:text-[#75AFA7]">
            ✓ DELIVERED TO TABLE
          </div>
        ) : (
          <button
            onClick={handleAction}
            disabled={isUpdating}
            className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer ${actionButtonColor}`}
          >
            {isUpdating ? (
              <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : (
              actionButtonLabel
            )}
          </button>
        )}
      </div>
    </div>
  );
};
