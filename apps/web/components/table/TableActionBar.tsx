"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Coffee, ArrowLeftRight, Check, X } from "lucide-react";

interface TableActionBarProps {
  tableNumber: string;
}

export function TableActionBar({ tableNumber }: TableActionBarProps) {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const [staffNotified, setStaffNotified] = useState(false);

  const handleCallStaff = () => {
    setStaffNotified(true);
    setTimeout(() => {
      setStaffNotified(false);
    }, 4000);
  };

  return (
    <div className="w-full max-w-sm pt-1 sm:pt-2 pb-1 text-center">
      {/* Toast Notification when Staff is called */}
      {staffNotified && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#B72E35] text-[#F3E7D3] px-4 py-2 text-xs font-mono shadow-lg animate-bounce">
          <Check className="h-3.5 w-3.5 text-[#F3E7D3]" />
          <span>Staff alerted for Table {tableNumber}!</span>
        </div>
      )}

      {/* Main Footer Links with exact brand kit typography:
          - text color: espresso ink (#241F1C) in day, café crème (#F3E7D3) in night
          - hover: smol cherry (#B72E35) */}
      <div className="flex items-center justify-center gap-4 text-[11px] font-mono font-bold tracking-wider text-[#241F1C] dark:text-[#F3E7D3]">
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="underline underline-offset-4 hover:text-[#B72E35] dark:hover:text-[#F2C84B] transition-colors uppercase cursor-pointer"
        >
          NEED HELP?
        </button>

        <span className="text-[#C9AE8B] select-none">|</span>

        <button
          type="button"
          onClick={handleCallStaff}
          className="underline underline-offset-4 hover:text-[#B72E35] dark:hover:text-[#F2C84B] transition-colors uppercase cursor-pointer"
        >
          CALL STAFF
        </button>
      </div>

      {/* Interactive Help Modal */}
      {helpOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-3xl bg-[#F3E7D3] dark:bg-[#241F1C] p-6 text-left shadow-2xl border border-[#C9AE8B]/50 dark:border-white/10 text-[#241F1C] dark:text-[#F3E7D3]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Coffee className="h-4 w-4 text-[#B72E35]" />
                <h3 className="font-serif font-bold text-lg text-[#241F1C] dark:text-[#F3E7D3]">
                  Table {tableNumber} Help
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="rounded-full p-1 text-[#725039] hover:bg-[#C9AE8B]/30 dark:text-[#C9AE8B] dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-[#725039] dark:text-[#C9AE8B] mb-5 leading-relaxed font-sans">
              Need assistance with ordering, dietary questions, or sitting at a different table?
            </p>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  handleCallStaff();
                  setHelpOpen(false);
                }}
                className="w-full flex items-center justify-between rounded-xl bg-[#B72E35] text-white px-4 py-3 text-xs font-semibold shadow-xs hover:bg-[#9B242A] cursor-pointer"
              >
                <span>Call Staff to Table</span>
                <Coffee className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setHelpOpen(false);
                  router.push("/");
                }}
                className="w-full flex items-center justify-between rounded-xl border border-[#C9AE8B] bg-white/40 dark:bg-[#1D1815] px-4 py-3 text-xs font-semibold text-[#241F1C] dark:text-[#F3E7D3] hover:bg-white/80 cursor-pointer"
              >
                <span>Switch / Re-scan Table</span>
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
