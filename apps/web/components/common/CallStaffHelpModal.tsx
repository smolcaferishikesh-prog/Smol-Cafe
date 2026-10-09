"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Coffee, ArrowLeftRight, Check, X, Loader2, AlertCircle } from "lucide-react";
import { requestStaffAssistanceAction } from "@/app/t/actions";

interface CallStaffHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableLabel?: string;
  guestName?: string;
}

export const CallStaffHelpModal: React.FC<CallStaffHelpModalProps> = ({
  isOpen,
  onClose,
  tableLabel = "01",
  guestName = "",
}) => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleCallStaff = async (reason = "General assistance") => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await requestStaffAssistanceAction(tableLabel, guestName, reason);
      if (res.success) {
        setFeedback({
          type: "success",
          text: res.message || "Staff notified. Someone will come over.",
        });
        setTimeout(() => {
          onClose();
          setFeedback(null);
        }, 3000);
      } else {
        setFeedback({
          type: "error",
          text: res.message || "We couldn't send the request. Please ask at the counter.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        text: "We couldn't send the request. Please ask at the counter.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-[#FAF4EB] dark:bg-[#1E1916] p-6 text-left shadow-2xl border border-[#C9AE8B]/50 dark:border-white/10 text-[#241F1C] dark:text-[#F3E7D3] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#B72E35]/10 dark:bg-[#B72E35]/20 text-[#B72E35] dark:text-[#F6AD55]">
              <Bell className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-[#241F1C] dark:text-[#FAF4EB]">
                Table {tableLabel} Help
              </h3>
              <p className="text-[11px] font-mono text-[#725039] dark:text-[#C9AE8B]">
                {guestName ? `Guest: ${guestName}` : "Ask a human"}
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

        {/* Feedback Message */}
        {feedback ? (
          <div
            className={`rounded-2xl p-4 my-3 text-xs font-serif flex items-start gap-2.5 ${
              feedback.type === "success"
                ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800"
                : "bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-800"
            }`}
          >
            {feedback.type === "success" ? (
              <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="leading-relaxed">{feedback.text}</div>
          </div>
        ) : (
          <p className="text-xs text-[#725039] dark:text-[#C9AE8B] mb-4 leading-relaxed font-sans">
            Need water, napkins, bill help, or assistance from our floor team? Tap below:
          </p>
        )}

        {/* Actions */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => handleCallStaff("Call Staff to Table")}
            disabled={isSubmitting}
            className="w-full flex items-center justify-between rounded-2xl bg-[#B72E35] text-white px-4 py-3 text-xs font-bold shadow-md hover:bg-[#91242C] transition active:scale-98 cursor-pointer disabled:opacity-50"
          >
            <span className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span>Call Staff to Table</span>
            </span>
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="text-[10px] font-mono opacity-80">Instant</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleCallStaff("Water / Napkins request")}
            disabled={isSubmitting}
            className="w-full flex items-center justify-between rounded-2xl border border-[#C9AE8B]/50 dark:border-white/10 bg-white/70 dark:bg-[#251E1B] px-4 py-2.5 text-xs font-semibold text-[#241F1C] dark:text-[#FAF4EB] hover:bg-[#F3E7D3] dark:hover:bg-[#2C2420] transition active:scale-98 cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Coffee className="h-4 w-4 text-[#725039] dark:text-[#C9AE8B]" />
              <span>Request Water &amp; Napkins</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              router.push("/");
            }}
            className="w-full flex items-center justify-between rounded-2xl border border-dashed border-[#C9AE8B]/60 dark:border-stone-700 bg-transparent px-4 py-2 text-xs font-semibold text-[#725039] dark:text-[#C9AE8B] hover:bg-[#FAF4EB] dark:hover:bg-[#251E1B] transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <ArrowLeftRight className="h-3.5 w-3.5" />
              <span>Switch / Re-scan Table</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
