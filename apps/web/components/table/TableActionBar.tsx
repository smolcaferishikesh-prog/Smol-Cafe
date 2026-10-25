"use client";

import { useState } from "react";
import { CallStaffHelpModal } from "@/components/common/CallStaffHelpModal";
import { TableHelpFaqModal } from "@/components/common/TableHelpFaqModal";

interface TableActionBarProps {
  tableNumber: string;
}

export function TableActionBar({ tableNumber }: TableActionBarProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [callStaffOpen, setCallStaffOpen] = useState(false);

  return (
    <div className="w-full max-w-sm pt-1 sm:pt-2 pb-1 text-center">
      {/* Main Footer Links with exact brand kit typography:
          - text color: espresso ink (#241F1C) in day, café crème (#F3E7D3) in night
          - hover: smol cherry (#B72E35) / yellow/purple in dark */}
      <div className="flex items-center justify-center gap-4 text-[11px] font-mono font-bold tracking-wider text-[#241F1C] dark:text-[#F3E7D3]">
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="underline underline-offset-4 hover:text-[#B72E35] dark:hover:text-purple-400 transition-colors uppercase cursor-pointer"
        >
          NEED HELP?
        </button>

        <span className="text-[#C9AE8B] select-none">|</span>

        <button
          type="button"
          onClick={() => setCallStaffOpen(true)}
          className="underline underline-offset-4 hover:text-[#B72E35] dark:hover:text-purple-400 transition-colors uppercase cursor-pointer"
        >
          CALL STAFF
        </button>
      </div>

      {/* 1. NEED HELP? Guide Modal (FAQs, Wi-Fi, How to Order) */}
      <TableHelpFaqModal
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        tableLabel={tableNumber}
        onOpenCallStaff={() => setCallStaffOpen(true)}
      />

      {/* 2. CALL STAFF Assistance Modal (Floor Staff Alert, Water/Napkins) */}
      <CallStaffHelpModal
        isOpen={callStaffOpen}
        onClose={() => setCallStaffOpen(false)}
        tableLabel={tableNumber}
      />
    </div>
  );
}

