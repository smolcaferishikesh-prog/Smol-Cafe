"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { HideNavbarOnMount } from "@/components/common/HideNavbarOnMount";
import { ArrowLeft, AlertTriangle } from "lucide-react";

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected runtime client error
    console.error("Runtime route error caught:", error);
  }, [error]);

  return (
    <div
      data-hide-navbar="true"
      data-not-found="true"
      className="relative min-h-[100dvh] w-full bg-[#F3E7D3] dark:bg-[#151110] text-[#241F1C] dark:text-[#FAF4EB] flex flex-col justify-between items-center px-4 py-6 sm:py-8 transition-colors duration-300 selection:bg-[#B72E35]/20 selection:text-[#B72E35] overflow-x-hidden"
    >
      <HideNavbarOnMount />

      {/* Top Bar: Brand Tag & Theme Switcher */}
      <header className="relative z-10 w-full max-w-lg flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <span className="font-serif italic text-base sm:text-lg font-bold tracking-tight text-[#241F1C] dark:text-[#FAF4EB]">
            smol café
          </span>
          <span className="h-1 w-1 rounded-full bg-[#B72E35] dark:bg-[#F2C84B]" />
          <span className="font-mono text-[10px] tracking-widest uppercase text-[#725039] dark:text-[#C9AE8B]">
            rishikesh
          </span>
        </div>

        <div className="flex items-center">
          <ThemeToggle variant="icon" />
        </div>
      </header>

      {/* Center Error Card */}
      <main className="relative z-10 w-full max-w-md my-auto py-6 sm:py-10">
        <div className="relative rounded-3xl border border-[#C9AE8B]/40 dark:border-white/10 bg-[#FAF4EB]/85 dark:bg-[#1E1815]/90 p-7 sm:p-9 text-center shadow-[0_12px_40px_rgba(114,80,57,0.12)] dark:shadow-[0_16px_50px_rgba(0,0,0,0.5)] backdrop-blur-md transition-all duration-300">
          <div className="mx-auto mb-5 flex justify-center">
            <Image
              src="/table-header-logo.png"
              alt="smol café"
              width={88}
              height={132}
              className="w-18 sm:w-22 h-auto object-contain select-none dark:hidden drop-shadow-[0_8px_16px_rgba(114,80,57,0.2)]"
              priority
            />
            <Image
              src="/table-header-logo-dark.png"
              alt="smol café"
              width={88}
              height={132}
              className="w-18 sm:w-22 h-auto object-contain select-none hidden dark:block drop-shadow-[0_0_24px_rgba(168,85,247,0.35)]"
              priority
            />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-widest uppercase bg-[#B72E35]/10 text-[#B72E35] dark:bg-[#F2C84B]/15 dark:text-[#F2C84B] border border-[#B72E35]/25 dark:border-[#F2C84B]/30 mb-3 shadow-xs">
            <AlertTriangle className="h-3 w-3" />
            <span>500 · Server Hiccup</span>
          </div>

          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#241F1C] dark:text-[#FAF4EB]">
            Something Went Wrong
          </h1>

          <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-[#725039] dark:text-[#C9AE8B] font-sans">
            Our baristas are brewing up a fix. Please try again or head back to the home page.
          </p>

          <div className="mt-7 pt-2 flex flex-col gap-2.5">
            <button
              onClick={() => reset()}
              type="button"
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#B72E35] hover:bg-[#9B252B] active:bg-[#852025] text-white py-3.5 px-6 text-sm font-serif font-bold shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              Try Again
            </button>
            <Link
              href="/"
              className="w-full flex items-center justify-center gap-2 rounded-2xl border border-[#C9AE8B]/40 dark:border-white/10 bg-[#F3E7D3]/60 dark:bg-[#2A2420] hover:bg-[#F3E7D3] dark:hover:bg-[#322A26] py-3.5 px-6 text-sm font-serif font-bold text-[#241F1C] dark:text-[#FAF4EB] shadow-xs transition-all active:scale-[0.98]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Home Page</span>
            </Link>
          </div>
        </div>
      </main>

      <footer className="relative z-10 text-center">
        <p className="font-mono text-[10px] tracking-wider uppercase text-[#725039]/70 dark:text-[#C9AE8B]/60">
          smol café · tapovan, rishikesh
        </p>
      </footer>
    </div>
  );
}

