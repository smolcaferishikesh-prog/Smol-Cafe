import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { ArrowLeft, Coffee, Sparkles } from "lucide-react";

export const metadata = {
  title: "404 — Page Not Found · smol café",
  description: "The page you are looking for does not exist. Return to smol café Rishikesh.",
};

export default function NotFound() {
  return (
    <div className="relative min-h-[100dvh] w-full bg-[#F3E7D3] dark:bg-[#151110] text-[#241F1C] dark:text-[#FAF4EB] flex flex-col justify-between items-center px-4 py-6 sm:py-8 transition-colors duration-300 selection:bg-[#B72E35]/20 selection:text-[#B72E35] overflow-x-hidden">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[500px] h-[350px] bg-gradient-to-b from-[#F2C84B]/20 via-[#B72E35]/10 to-transparent dark:from-[#A855F7]/15 dark:via-[#7E22CE]/10 dark:to-transparent rounded-full blur-3xl opacity-70" />
      <div className="pointer-events-none absolute -bottom-24 right-0 w-[350px] h-[350px] bg-gradient-to-t from-[#B72E35]/15 to-transparent dark:from-[#A855F7]/10 to-transparent rounded-full blur-3xl opacity-50" />

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

      {/* Center 404 Hero Card */}
      <main className="relative z-10 w-full max-w-md my-auto py-6 sm:py-10">
        <div className="relative rounded-3xl border border-[#C9AE8B]/40 dark:border-white/10 bg-[#FAF4EB]/85 dark:bg-[#1E1815]/90 p-7 sm:p-9 text-center shadow-[0_12px_40px_rgba(114,80,57,0.12)] dark:shadow-[0_16px_50px_rgba(0,0,0,0.5)] backdrop-blur-md transition-all duration-300">
          {/* Subtle Inner Highlight */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent" />

          {/* Door Illustration with Floating Levitation */}
          <div className="mx-auto mb-5 flex justify-center">
            <div className="relative group transition-transform duration-500 hover:scale-105">
              {/* Day Mode Logo */}
              <Image
                src="/table-header-logo.png"
                alt="smol café"
                width={88}
                height={132}
                className="w-18 sm:w-22 h-auto object-contain select-none dark:hidden drop-shadow-[0_8px_16px_rgba(114,80,57,0.2)] animate-pulse"
                priority
              />
              {/* Night Mode Logo */}
              <Image
                src="/table-header-logo-dark.png"
                alt="smol café"
                width={88}
                height={132}
                className="w-18 sm:w-22 h-auto object-contain select-none hidden dark:block drop-shadow-[0_0_24px_rgba(168,85,247,0.35)] animate-pulse"
                priority
              />
            </div>
          </div>

          {/* 404 Pill Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-widest uppercase bg-[#B72E35]/10 text-[#B72E35] dark:bg-[#F2C84B]/15 dark:text-[#F2C84B] border border-[#B72E35]/25 dark:border-[#F2C84B]/30 mb-3 shadow-xs">
            <Coffee className="h-3 w-3" />
            <span>404 · Spilled Coffee</span>
          </div>

          {/* Headline */}
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#241F1C] dark:text-[#FAF4EB]">
            Table Not Found
          </h1>

          {/* Warm description */}
          <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-[#725039] dark:text-[#C9AE8B] font-sans">
            Looks like you&apos;ve wandered past the café courtyard into uncharted corners.
            This table or page does not exist.
          </p>

          <p className="mt-1 text-[11px] sm:text-xs italic text-[#725039]/70 dark:text-[#C9AE8B]/60 font-serif">
            Take a deep breath of fresh Himalayan air and let&apos;s guide you back.
          </p>

          {/* Sole Action: Return to Home Page */}
          <div className="mt-7 pt-2">
            <Link
              href="/"
              className="group relative w-full overflow-hidden flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-b from-[#E03A43]/90 via-[#B72E35]/95 to-[#7D1217] dark:from-[#A855F7]/90 dark:via-[#7E22CE]/95 dark:to-[#4C1D95] py-3.5 px-6 text-sm sm:text-base font-serif font-bold text-white shadow-[0_8px_24px_rgba(183,46,53,0.35),inset_0_1.5px_1.5px_rgba(255,255,255,0.8),inset_0_-2px_4px_rgba(0,0,0,0.25)] dark:shadow-[0_8px_28px_rgba(126,34,206,0.45),inset_0_1.5px_1.5px_rgba(255,255,255,0.85)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_10px_30px_rgba(183,46,53,0.48)] dark:hover:shadow-[0_10px_32px_rgba(168,85,247,0.6)] active:scale-[0.98] cursor-pointer"
            >
              {/* Glossy top specular reflection */}
              <span className="absolute inset-x-6 top-0.5 h-[36%] rounded-full bg-gradient-to-b from-white/60 via-white/15 to-transparent pointer-events-none opacity-90" />
              {/* Shimmer sweep */}
              <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/20 dark:via-white/30 to-transparent transition-transform duration-1000 ease-in-out pointer-events-none" />

              <ArrowLeft className="relative z-10 h-4 w-4 stroke-[2.5] transition-transform duration-300 group-hover:-translate-x-1" />
              <span className="relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
                Back to Home Page
              </span>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer Tagline */}
      <footer className="relative z-10 text-center">
        <p className="font-mono text-[10px] tracking-wider uppercase text-[#725039]/70 dark:text-[#C9AE8B]/60 flex items-center justify-center gap-1.5">
          <Sparkles className="h-2.5 w-2.5 text-[#B72E35] dark:text-[#F2C84B]" />
          <span>good coffee · brighter days · tapovan, rishikesh</span>
        </p>
      </footer>
    </div>
  );
}
