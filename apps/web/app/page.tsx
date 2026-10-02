"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Sun, Moon, ArrowRight, Utensils, QrCode } from "lucide-react";
import { StaffForkLockIcon } from "@/components/common/StaffForkLockIcon";

export default function RoleSelectionPage() {
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("smol_theme");
    const active = saved === "night" || saved === "dark";
    setIsDark(active);
    applyTheme(active);
  }, []);

  const applyTheme = (dark: boolean) => {
    if (dark) {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "night");
      document.body.style.backgroundColor = "#241F1C";
      document.body.style.color = "#F3E7D3";
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "day");
      document.body.style.backgroundColor = "#F3E7D3";
      document.body.style.color = "#241F1C";
    }
  };

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    applyTheme(next);
    localStorage.setItem("smol_theme", next ? "night" : "day");
    window.dispatchEvent(new CustomEvent("smol_theme_changed", { detail: next }));
  };

  return (
    <>
      <main
        className={`relative min-h-screen sm:h-screen ${
          isDark
            ? "ambient-bg-night text-smol-creme"
            : "ambient-bg-day text-smol-espresso"
        } transition-colors duration-300 overflow-hidden flex flex-col items-center justify-between px-4 sm:px-6 py-2 sm:py-3 font-sans selection:bg-[#B72E35] selection:text-white`}
      >
        {/* Editorial Top Border Line */}
        <div
          style={{ backgroundColor: isDark ? "rgba(201, 174, 139, 0.2)" : "rgba(201, 174, 139, 0.4)" }}
          className="absolute top-0 inset-x-0 h-px"
        />

        {/* Top Header: Modern Floating Pill Header with Live Cafe Indicator, Wordmark, and Controls */}
        <header className="relative z-20 w-full max-w-xl mx-auto pt-1 pb-1 sm:pb-2">
          <div className="flex items-center justify-between px-3.5 sm:px-4 py-1.5 rounded-full backdrop-blur-md bg-[#FAF4EB]/85 dark:bg-[#1C1714]/85 border border-[#C9AE8B]/30 dark:border-white/10 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.4)] transition-all duration-300">
            {/* Left: Brand Name + Live Status indicator */}
            <div className="flex items-center gap-2.5">
              <span
                style={{ color: isDark ? "#F3E7D3" : "#B72E35" }}
                className="font-serif text-lg sm:text-xl font-bold tracking-tight lowercase select-none"
              >
                smol café
              </span>
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-medium">
                  open · tapovan
                </span>
              </div>
            </div>

            {/* Right: Controls (Day/Night Mode Switcher + Subtle Staff Lock) */}
            <div className="flex items-center gap-2">
              {/* Day / Night Toggle Pill */}
              <button
                onClick={toggleTheme}
                aria-label="Toggle day and night mode"
                className={`group flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono transition-all duration-200 cursor-pointer focus:outline-none ${
                  isDark ? "pill-3d-night text-[#F3E7D3]" : "pill-3d-day text-[#241F1C]"
                }`}
              >
                {isDark ? (
                  <>
                    <Moon className="h-3.5 w-3.5 text-[#754CFF] animate-pulse" />
                    <span className="lowercase text-[11px] font-medium tracking-wide">
                      night
                    </span>
                  </>
                ) : (
                  <>
                    <Sun className="h-3.5 w-3.5 text-[#B72E35]" />
                    <span className="lowercase text-[11px] font-medium tracking-wide">
                      day
                    </span>
                  </>
                )}
              </button>

              {/* Staff Lock Icon -> Direct navigation to /smol-backdoor */}
              <div className="relative group">
                <Link
                  href="/smol-backdoor"
                  aria-label="Staff Backdoor Access"
                  title="Staff Backdoor Portal"
                  style={{ color: isDark ? "#FF5B52" : "#B72E35" }}
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 cursor-pointer focus:outline-none hover:scale-110 active:scale-95 ${
                    isDark
                      ? "pill-3d-night border-[#B72E35]/60 shadow-[0_0_14px_rgba(183,46,53,0.4)]"
                      : "pill-3d-day border-[#B72E35]/50 hover:border-[#B72E35] shadow-[0_2px_10px_rgba(183,46,53,0.22)]"
                  }`}
                >
                  <StaffForkLockIcon
                    style={{ color: isDark ? "#FF5B52" : "#B72E35" }}
                    className="h-6 w-6 shrink-0"
                  />
                </Link>

                {/* Desktop Hover Tooltip */}
                <span className="pointer-events-none absolute -bottom-8 right-0 hidden whitespace-nowrap rounded-md bg-[#241F1C] px-2.5 py-1 text-[10px] font-mono text-[#F3E7D3] opacity-0 transition-opacity group-hover:opacity-100 sm:block dark:bg-[#FAF4EB] dark:text-[#241F1C] shadow-lg z-30 border border-white/10 dark:border-black/10">
                  Staff Backdoor
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Central Customer-First Container */}
        <div className="relative z-10 w-full max-w-md mx-auto flex flex-col items-center my-auto -translate-y-2 sm:-translate-y-3 py-1">

          {/* Top Hero Brand Block */}
          <div className="flex flex-col items-center -translate-y-3 sm:-translate-y-5 w-full">
            {/* Official Clean Arched Door Logo */}
            <div className="animate-fade-in-down mb-1.5 flex flex-col items-center relative">
              <div
                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-44 sm:w-52 h-48 sm:h-56 rounded-full blur-2xl pointer-events-none transition-all duration-500 ${
                  isDark
                    ? "bg-gradient-to-b from-[#754CFF]/50 via-[#754CFF]/35 to-transparent shadow-[0_0_40px_rgba(117,76,255,0.4)]"
                    : "bg-gradient-to-b from-[#B72E35]/35 via-[#B72E35]/25 to-transparent"
                }`}
              />

              <div className="relative h-[145px] w-[104px] sm:h-[160px] sm:w-[114px] transition-transform duration-300 hover:scale-105 animate-float cursor-pointer">
                <Image
                  src="/logo-transparent.png?v=2"
                  alt="smol café"
                  fill
                  className={`object-contain transition-opacity duration-500 drop-shadow-[0_0_26px_rgba(183,46,53,0.38)] drop-shadow-[0_16px_24px_rgba(114,80,57,0.18)] ${
                    isDark ? "opacity-0 pointer-events-none scale-95" : "opacity-100 scale-100"
                  }`}
                  priority
                />
                <Image
                  src="/logo-dark-transparent.png?v=2"
                  alt="smol café after dark"
                  fill
                  className={`object-contain transition-all duration-500 drop-shadow-[0_0_32px_rgba(117,76,255,0.85)] drop-shadow-[0_16px_24px_rgba(0,0,0,0.7)] ${
                    isDark ? "opacity-100 scale-100" : "opacity-0 pointer-events-none scale-95"
                  }`}
                  priority
                />
              </div>
              <div
                className={`h-2 w-22 sm:w-26 rounded-full mt-1.5 transition-all duration-300 blur-[2px] ${
                  isDark ? "bg-black/50" : "bg-[#725039]/18"
                }`}
              />
            </div>

            {/* Micro Brand Eyebrow Badge */}
            <div className="animate-fade-in-down delay-50 mb-0.5">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.25em] text-[#725039]/80 dark:text-[#C9AE8B]/80 px-2.5 py-0.5 rounded-full bg-[#725039]/5 dark:bg-white/5 border border-[#725039]/15 dark:border-white/10">
                artisanal bakehouse &amp; brew
              </span>
            </div>

            {/* Main Headline */}
            <div className="animate-fade-in-down delay-50 text-center mb-0">
              <h1
                style={{ color: isDark ? "#F3E7D3" : "#241F1C" }}
                className="font-serif text-2xl sm:text-3xl font-medium tracking-tight lowercase transition-colors duration-300"
              >
                welcome to smol
              </h1>
            </div>

            {/* Supporting Copy */}
            <p
              style={{ color: isDark ? "#C9AE8B" : "#725039" }}
              className="animate-fade-in-down delay-100 font-serif italic text-xs sm:text-sm mb-2 sm:mb-2.5 text-center transition-colors duration-300"
            >
              slow mornings &amp; handcrafted sips
            </p>

            {/* Thin Star Divider */}
            <div className="flex items-center gap-3 mb-1 w-full max-w-xs mx-auto animate-fade-in-up delay-100">
              <div
                style={{ backgroundColor: isDark ? "rgba(201, 174, 139, 0.25)" : "rgba(201, 174, 139, 0.45)" }}
                className="flex-1 h-px"
              />
              <span
                style={{ color: isDark ? "#754CFF" : "#B72E35" }}
                className="text-xs transition-colors duration-300"
              >
                ✦
              </span>
              <div
                style={{ backgroundColor: isDark ? "rgba(201, 174, 139, 0.25)" : "rgba(201, 174, 139, 0.45)" }}
                className="flex-1 h-px"
              />
            </div>
          </div>

          {/* ── Customer Section: Clean Browse Menu Card ── */}
          <div className="w-full max-w-sm sm:max-w-md mx-auto mt-4 sm:mt-5">
            <div
              className={`relative w-full rounded-[2rem] sm:rounded-[2.25rem] p-4 sm:p-5 pt-6 sm:pt-7 text-center transition-all duration-300 overflow-visible ${
                isDark
                  ? "bg-gradient-to-b from-[#241F1C] via-[#1A1614] to-[#120F0E] border border-white/10 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8)]"
                  : "bg-gradient-to-b from-[#FAF4EB] via-[#F6EEE2] to-[#EFE3D3] border border-[#725039]/20 shadow-[0_20px_45px_-12px_rgba(114,80,57,0.2),0_2px_6px_rgba(114,80,57,0.06),0_1px_0_rgba(255,255,255,0.9)_inset]"
              }`}
            >
              {/* Subtle top bevel hairline */}
              <div
                className={`pointer-events-none absolute inset-x-8 top-0 h-px transition-colors duration-300 ${
                  isDark
                    ? "bg-gradient-to-r from-transparent via-white/15 to-transparent"
                    : "bg-gradient-to-r from-transparent via-white/80 to-transparent"
                }`}
              />

              {/* Title */}
              <h2
                className={`font-serif text-xl sm:text-2xl font-medium tracking-tight lowercase transition-colors duration-300 ${
                  isDark ? "text-[#F3E7D3]" : "text-[#241F1C]"
                }`}
              >
                artisanal menu &amp; brew
              </h2>

              {/* Description */}
              <p
                className={`mt-1 font-sans text-xs sm:text-[12.5px] leading-relaxed max-w-[280px] sm:max-w-xs mx-auto transition-colors duration-300 ${
                  isDark ? "text-[#C9AE8B]" : "text-[#725039]"
                }`}
              >
                Explore our pour overs, kulhad chai, sourdough bakes &amp; seasonal drinks.
              </p>

              {/* Primary Action Button ("browse full menu") */}
              <div className="relative mt-4 sm:mt-5 w-full">
                <div
                  className={`absolute inset-x-4 -bottom-2 h-8 blur-lg pointer-events-none rounded-full transition-all duration-300 ${
                    isDark ? "bg-[#754CFF]/55" : "bg-[#B72E35]/30"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => router.push("/home")}
                  className={`relative group w-full flex items-center justify-between rounded-[1.3rem] sm:rounded-[1.4rem] p-2.5 sm:p-3 pl-4 pr-3 text-white transition-all duration-300 hover:scale-[1.01] active:scale-[0.98] cursor-pointer ${
                    isDark
                      ? "bg-gradient-to-r from-[#5B34E6] via-[#754CFF] to-[#8E65FF] hover:from-[#6B42FF] hover:to-[#9F7BFF] shadow-[0_10px_28px_rgba(117,76,255,0.55),inset_0_1px_1.5px_rgba(255,255,255,0.4)]"
                      : "bg-gradient-to-r from-[#A5242A] via-[#B72E35] to-[#C93840] hover:from-[#B72E35] hover:to-[#D43D46] shadow-[0_10px_24px_rgba(183,46,53,0.4),inset_0_1px_1.5px_rgba(255,255,255,0.4)]"
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/20 backdrop-blur-xs text-white">
                    <Utensils className="w-4.5 h-4.5 text-white" />
                  </div>

                  <span className="font-sans text-sm sm:text-base font-bold tracking-normal text-white px-2 text-center flex-1 min-w-0">
                    browse full menu
                  </span>

                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 group-hover:bg-white/30 backdrop-blur-xs text-white shadow-inner transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </button>
              </div>

              {/* Direct Camera Table QR Note */}
              <div className="mt-3.5 flex items-center justify-center gap-2 text-[11px] font-mono text-[#725039] dark:text-[#C9AE8B] bg-[#725039]/5 dark:bg-white/5 py-2 px-3 rounded-xl border border-[#725039]/10 dark:border-white/10">
                <QrCode className="h-3.5 w-3.5 shrink-0 text-[#B72E35] dark:text-[#F2C84B]" />
                <span>At a table? Point your phone camera at your table QR stand.</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="relative z-10 animate-fade-in-up delay-300 mt-4 sm:mt-5 text-center space-y-1 pb-1">
            <div className="flex items-center gap-3 justify-center">
              <div
                style={{ backgroundColor: isDark ? "rgba(201, 174, 139, 0.2)" : "rgba(201, 174, 139, 0.4)" }}
                className="w-8 h-px"
              />
              <span
                style={{ color: isDark ? "rgba(201, 174, 139, 0.6)" : "rgba(114, 80, 57, 0.6)" }}
                className="font-mono text-[9px] uppercase tracking-[0.2em]"
              >
                tapovan · rishikesh
              </span>
              <div
                style={{ backgroundColor: isDark ? "rgba(201, 174, 139, 0.2)" : "rgba(201, 174, 139, 0.4)" }}
                className="w-8 h-px"
              />
            </div>
            <p
              style={{ color: isDark ? "rgba(243, 231, 211, 0.45)" : "rgba(114, 80, 57, 0.5)" }}
              className="font-serif italic text-[11px]"
            >
              a table worth staying at
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}
