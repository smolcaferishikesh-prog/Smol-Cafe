"use client";

import React from "react";
import { Users } from "lucide-react";

interface TableArchedCardProps {
  tableNumber: string;
  guestCount: number;
  children: React.ReactNode;
}

export const TableArchedCard: React.FC<TableArchedCardProps> = ({
  tableNumber,
  guestCount,
  children,
}) => {
  return (
    <div className="relative w-full max-w-[424px] mx-auto select-none">
      {/* Top Arched Dome SVG Frame */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox="-1 -1 424 183"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto block drop-shadow-[0_2px_8px_rgba(0,0,0,0.03)]"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Main Card Silhouette (Arched Dome with curved shoulders) */}
          <path
            d="M 0 181
               L 0 140
               C 0 124 14 114 31 114
               L 77 114
               C 83 114 85 104 87 94
               C 95 44 144 38 211 38
               C 278 38 327 44 335 94
               C 337 104 339 114 345 114
               L 391 114
               C 408 114 422 124 422 140
               L 422 181
               Z"
            className="fill-[#FAF4EB] dark:fill-[#201A17] stroke-[#C9AE8B] dark:stroke-white/10"
            strokeWidth="1.2"
          />

          {/* Inner Decorative Fine Inset Line */}
          <path
            d="M 7 181
               L 7 141
               C 7 129 18 121 33 121
               L 76 121
               C 86 121 90 108 92 98
               C 100 52 147 46 211 46
               C 275 46 322 52 330 98
               C 332 108 336 121 346 121
               L 389 121
               C 404 121 415 129 415 141
               L 415 181"
            fill="none"
            className="stroke-[#C9AE8B] dark:stroke-white/10"
            strokeOpacity="0.4"
            strokeWidth="1"
          />

          {/* Horizontal Line separating Arch Header from Content */}
          <line
            x1="0"
            y1="181"
            x2="422"
            y2="181"
            className="stroke-[#C9AE8B] dark:stroke-white/10"
            strokeOpacity="0.5"
            strokeWidth="1.2"
          />
        </svg>

        {/* Content Positioned Inside the Arched Dome */}
        <div className="absolute inset-0 flex flex-col items-center justify-start pt-[13.5%] pointer-events-none">
          {/* "TABLE" label in Walnut */}
          <span className="font-serif text-[11px] sm:text-[12px] font-semibold tracking-[0.24em] text-[#725039] dark:text-[#C9AE8B] uppercase">
            TABLE
          </span>

          {/* Table Number in Espresso Ink */}
          <span
            className={`font-serif leading-none font-bold text-[#241F1C] dark:text-[#FAF4EB] tracking-tight mt-0.5 ${
              tableNumber.length > 5
                ? "text-[26px] sm:text-[30px]"
                : "text-[44px] sm:text-[48px]"
            }`}
          >
            {tableNumber}
          </span>

          {/* "2 Guests" Pill Badge in Botanical Dusty Pool Deep Tone */}
          <div className="mt-1.5 flex items-center justify-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#2E5550] dark:bg-[#1E3E3A] px-3.5 py-0.5 text-[10.5px] font-medium text-[#F3E7D3] shadow-xs">
              <Users className="w-3.5 h-3.5 text-[#F3E7D3]/95" />
              <span>{guestCount} Guests</span>
            </div>
          </div>
        </div>
      </div>

      {/* Card Body - Connected seamlessly to the SVG header */}
      <div className="w-full bg-[#FAF4EB] dark:bg-[#201A17] border-x border-b border-[#C9AE8B] dark:border-white/10 rounded-b-[2rem] shadow-[0_4px_16px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] -mt-[1px]">
        {children}
      </div>
    </div>
  );
};
