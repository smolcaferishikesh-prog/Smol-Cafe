"use client";

import React, { useState, useEffect } from "react";
import { Coffee, X, Clock, Check, Sparkles } from "lucide-react";
import type { BaristaTicket } from "@/app/barista/actions";
import type { OrderStatus } from "@smol-cafe/db";

interface BaristaTicketCardProps {
  ticket: BaristaTicket;
  onTransition: (orderId: string, fromStatus: OrderStatus, toStatus: OrderStatus) => Promise<void>;
  onDismiss?: (orderId: string) => void;
}

export const BaristaTicketCard: React.FC<BaristaTicketCardProps> = ({
  ticket,
  onTransition,
  onDismiss,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  const isCompleted = ticket.status === "SERVED" || ticket.status === "COMPLETED";

  useEffect(() => {
    const calculateElapsed = () => {
      if (!ticket.submittedAt) return;
      if (isCompleted) {
        // Freeze timer at actual brewing duration
        const start = new Date(ticket.acceptedAt || ticket.submittedAt).getTime();
        const end = ticket.readyAt ? new Date(ticket.readyAt).getTime() : start;
        const diffMs = end > start ? end - start : 0;
        const minutes = Math.floor(diffMs / 60000);
        setElapsedMinutes(minutes > 0 && minutes < 60 ? minutes : 4);
        return;
      }

      const diffMs = Date.now() - new Date(ticket.submittedAt).getTime();
      const rawMins = Math.max(0, Math.floor(diffMs / 60000));
      setElapsedMinutes(rawMins > 60 ? 60 : rawMins);
    };

    calculateElapsed();
    if (!isCompleted) {
      const timer = setInterval(calculateElapsed, 15000);
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

  const timerBadgeStyle = isCompleted
    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
    : elapsedMinutes < 4
      ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
      : elapsedMinutes < 8
        ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800"
        : "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800 animate-pulse";

  const displayStatus =
    ["SUBMITTED", "PENDING_CONFIRMATION", "CONFIRMED", "ACCEPTED"].includes(ticket.status)
      ? "NEW"
      : ticket.status === "PREPARING"
      ? "BREWING"
      : ticket.status === "READY"
      ? "READY AT BAR"
      : "DELIVERED";

  let actionButtonLabel = "START BREWING";
  let actionButtonColor = "bg-[#B72E35] hover:bg-[#9B242A] text-white";

  if (displayStatus === "BREWING") {
    actionButtonLabel = "MARK BREW READY ☕";
    actionButtonColor = "bg-[#75AFA7] text-[#1C463F] dark:text-[#15342F] hover:bg-[#64A39A] font-black";
  } else if (displayStatus === "READY AT BAR") {
    actionButtonLabel = "MARK DELIVERED";
    actionButtonColor = "bg-[#241F1C] dark:bg-white text-white dark:text-[#241F1C] hover:opacity-90 font-bold";
  }

  return (
    <div className="flex flex-col justify-between rounded-3xl border-2 border-[#C9AE8B]/40 dark:border-white/10 bg-[#FAF4EB] dark:bg-[#1C1816] p-4 shadow-sm hover:border-[#B72E35]/40 transition space-y-3">
      <div>
        {/* Header: Table #, Order # & Payment Badge */}
        <div className="flex items-center justify-between gap-2 border-b border-[#C9AE8B]/30 dark:border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-[#725039] dark:text-[#C9AE8B]">
              #{ticket.orderNo || ticket.id.slice(-4)}
            </span>
            <span className="rounded-xl border border-[#B72E35]/40 bg-[#B72E35]/15 dark:bg-[#B72E35]/25 px-2.5 py-0.5 font-mono text-xs font-black uppercase text-[#B72E35] dark:text-[#FF6B6B]">
              TABLE {ticket.tableLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800/60 px-2 py-0.5 font-mono text-[10px] font-extrabold text-emerald-800 dark:text-emerald-300">
              PAID
            </span>
            {onDismiss && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(ticket.id);
                }}
                className="flex h-6 w-6 items-center justify-center rounded-lg border border-stone-300 dark:border-stone-700 bg-[#EFE7DC] dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-rose-100 dark:hover:bg-rose-950/60 hover:text-rose-600 transition cursor-pointer"
                title="Dismiss ticket"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Status & Elapsed Timer */}
        <div className="flex items-center justify-between mt-2 font-mono text-xs text-[#725039] dark:text-[#C9AE8B]">
          <span className="rounded-md border border-[#C9AE8B]/40 dark:border-white/10 px-2 py-0.5 text-[10.5px] font-bold uppercase">
            {displayStatus}
          </span>

          <div className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${timerBadgeStyle}`}>
            <Clock className="h-3 w-3" />
            <span>{isCompleted ? `${elapsedMinutes}m brew` : `${elapsedMinutes}m ago`}</span>
          </div>
        </div>

        {/* Special Instructions (e.g. less sugar, extra hot, oat milk) */}
        {ticket.instructions && (
          <div className="mt-2.5 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 p-2 font-mono text-xs text-amber-900 dark:text-amber-200">
            <span className="font-bold">NOTE:</span> {ticket.instructions}
          </div>
        )}

        {/* Items list */}
        <div className="my-3 space-y-2 divide-y divide-[#C9AE8B]/20 dark:divide-white/5">
          {ticket.items.map((item) => (
            <div key={item.id} className="pt-2 flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <Coffee className="h-3.5 w-3.5 text-[#B72E35] dark:text-[#FF6B6B] shrink-0" />
                  <span className="font-serif font-bold text-sm text-[#241F1C] dark:text-white capitalize">
                    {item.name.toLowerCase()}
                  </span>
                </div>
              </div>
              <span className="flex h-6 px-2.5 shrink-0 items-center justify-center rounded-xl bg-[#B72E35] font-mono text-xs font-black text-white shadow-xs">
                ×{item.qty}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Button */}
      <div className="pt-2 border-t border-[#C9AE8B]/30 dark:border-white/10">
        {displayStatus === "DELIVERED" ? (
          <div className="flex h-10 w-full items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 font-mono text-xs font-bold text-emerald-800 dark:text-emerald-300">
            ✓ DELIVERED TO GUEST
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
