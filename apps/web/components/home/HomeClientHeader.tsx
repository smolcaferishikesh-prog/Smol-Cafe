"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AppDrawer } from "@/components/navigation/AppDrawer";

interface HomeClientHeaderProps {
  tableLabel?: string;
}

export const HomeClientHeader: React.FC<HomeClientHeaderProps> = ({ tableLabel }) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#C9AE8B]/40 bg-[#F3E7D3]/90 px-5 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-between">
          {/* Hamburger Menu Button */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#241F1C] transition hover:bg-black/5 active:scale-95"
            aria-label="Open navigation menu"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Logo - smol café (always lowercase) */}
          <Link href="/" className="font-serif text-2xl font-bold tracking-tight text-[#B72E35] transition hover:opacity-90">
            smol café
          </Link>

          {/* Profile Icon */}
          <Link
            href="/profile"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#241F1C] transition hover:bg-black/5 active:scale-95"
            aria-label="Profile account"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <circle cx="12" cy="8" r="4" />
              <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
            </svg>
          </Link>
        </div>
      </header>

      {/* Slide-over Drawer */}
      <AppDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        tableLabel={tableLabel}
      />
    </>
  );
};
