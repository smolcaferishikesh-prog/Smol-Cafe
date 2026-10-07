"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  staffBackdoorLoginAction,
  getRoleCredentialsAction,
} from "@/app/smol-backdoor/actions";
import {
  ChefHat,
  Coffee,
  Receipt,
  ShieldCheck,
  Delete,
  ArrowRight,
  Lock,
  Unlock,
  AlertTriangle,
  Eye,
  EyeOff,
  RotateCcw,
} from "lucide-react";
import { ThemeToggle } from "@/components/common/ThemeToggle";

type RoleId = "kitchen" | "barista" | "cashier" | "admin";

interface RoleMeta {
  id: RoleId;
  name: string;
  shortName: string;
  lightLogo: string;
  darkLogo: string;
  tagline: string;
  icon: React.ElementType;
  themeColor: string;
  themeBg: string;
  activeBorder: string;
  glowColor: string;
  badgeBg: string;
  destination: string;
}

export const StaffBackdoorPortal: React.FC = () => {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<RoleId>("barista");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [livePins, setLivePins] = useState<{
    kitchen: string;
    barista: string;
    cashier: string;
    admin: string;
  }>({
    kitchen: "6175",
    barista: "1234",
    cashier: "8112",
    admin: "9227",
  });

  useEffect(() => {
    getRoleCredentialsAction()
      .then((res) => {
        if (res.success && res.credentials) {
          setLivePins({
            kitchen: res.credentials.kitchen.pin,
            barista: res.credentials.barista?.pin || "1234",
            cashier: res.credentials.cashier.pin,
            admin: res.credentials.admin.pin,
          });
        }
      })
      .catch(console.error);
  }, []);

  const roles: RoleMeta[] = [
    {
      id: "kitchen",
      name: "Kitchen KDS",
      shortName: "Kitchen",
      lightLogo: "/kitchen-logo.png",
      darkLogo: "/kitchen-logo-dark.png",
      tagline: "Live confirmed ticket queue & prep timer",
      icon: ChefHat,
      themeColor: "#D97706",
      themeBg: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
      activeBorder: "border-amber-600 dark:border-amber-400 ring-2 ring-amber-500/20",
      glowColor: "shadow-[0_8px_30px_rgb(217,119,6,0.18)]",
      badgeBg: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800",
      destination: "/smol-backdoor/kitchen",
    },
    {
      id: "barista",
      name: "Barista Desk",
      shortName: "Barista",
      lightLogo: "/barista-logo.png",
      darkLogo: "/barista-logo-dark.png",
      tagline: "Single-origin espresso, pour overs & brew queue",
      icon: Coffee,
      themeColor: "#B72E35",
      themeBg: "bg-[#B72E35]/10 text-[#B72E35] dark:text-[#F87171]",
      activeBorder: "border-[#B72E35] dark:border-[#F87171] ring-2 ring-[#B72E35]/20",
      glowColor: "shadow-[0_8px_30px_rgb(183,46,53,0.20)]",
      badgeBg: "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800",
      destination: "/smol-backdoor/barista",
    },
    {
      id: "cashier",
      name: "Cashier Desk",
      shortName: "Cashier",
      lightLogo: "/cashier-logo.png",
      darkLogo: "/cashier-logo-dark.png",
      tagline: "Order verification queue & table cash settlement",
      icon: Receipt,
      themeColor: "#059669",
      themeBg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      activeBorder: "border-emerald-600 dark:border-emerald-400 ring-2 ring-emerald-500/20",
      glowColor: "shadow-[0_8px_30px_rgb(5,150,105,0.18)]",
      badgeBg: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800",
      destination: "/smol-backdoor/cashier",
    },
    {
      id: "admin",
      name: "Admin Control",
      shortName: "Admin",
      lightLogo: "/admin-logo.png",
      darkLogo: "/admin-logo-dark.png",
      tagline: "Master café management, analytics & floor radar",
      icon: ShieldCheck,
      themeColor: "#7C3AED",
      themeBg: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
      activeBorder: "border-purple-600 dark:border-purple-400 ring-2 ring-purple-500/20",
      glowColor: "shadow-[0_8px_30px_rgb(124,58,237,0.20)]",
      badgeBg: "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800",
      destination: "/smol-backdoor/admin",
    },
  ];

  const currentRole = roles.find((r) => r.id === selectedRole)!;

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const submitLogin = useCallback(
    async (role: RoleId, pinCode: string) => {
      if (!pinCode || pinCode.trim().length === 0) {
        setErrorMessage("Please enter your station PIN to unlock.");
        triggerShake();
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        const res = await staffBackdoorLoginAction({
          role,
          pin: pinCode.trim(),
        });

        if (res.success && res.redirectTo) {
          // Keep loader spinning until browser navigates to destination page
          window.location.href = res.redirectTo;
        } else {
          setErrorMessage(res.message || "Invalid Station PIN. Please re-enter.");
          triggerShake();
          setPin("");
          setIsSubmitting(false);
        }
      } catch {
        setErrorMessage("Network error connecting to security server.");
        triggerShake();
        setIsSubmitting(false);
      }
    },
    [router]
  );

  // Handle keypad taps
  const handleKeyTap = (digit: string) => {
    if (isSubmitting) return;
    if (pin.length < 8) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setErrorMessage(null);

      // If exactly 4 digits, trigger loader immediately and auto submit
      if (nextPin.length === 4) {
        setIsSubmitting(true);
        setTimeout(() => {
          submitLogin(selectedRole, nextPin);
        }, 100);
      }
    }
  };

  const handleBackspace = () => {
    if (isSubmitting) return;
    setPin((prev) => prev.slice(0, -1));
    setErrorMessage(null);
  };

  const handleClear = () => {
    if (isSubmitting) return;
    setPin("");
    setErrorMessage(null);
  };

  // Switch Station
  const handleSelectRole = (r: RoleId) => {
    setSelectedRole(r);
    setPin("");
    setErrorMessage(null);
  };

  return (
    <div className="min-h-[100dvh] bg-[#FAF4EB] dark:bg-[#14110E] text-[#241F1C] dark:text-[#F3E7D3] font-sans flex flex-col justify-between px-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-3 sm:p-5 md:p-8 transition-colors duration-300 selection:bg-[#B72E35] selection:text-white">
      {/* Top Header */}
      <header className="mx-auto flex w-full max-w-lg items-center justify-between py-2 sm:py-3">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div className="relative flex items-center justify-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/backdoor_logo_light.png"
              alt="smol backdoor"
              className="h-10 sm:h-14 md:h-16 w-auto object-contain dark:hidden transition-transform duration-300 hover:scale-105"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/backdoor_logo_dark.png"
              alt="smol backdoor"
              className="h-10 sm:h-14 md:h-16 w-auto object-contain hidden dark:block transition-transform duration-300 hover:scale-105"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-serif text-lg sm:text-2xl font-black tracking-tight text-[#241F1C] dark:text-white lowercase">
                smol backdoor
              </span>
              <span className="rounded-md bg-[#B72E35]/10 dark:bg-purple-950/60 px-1.5 py-0.5 font-mono text-[9px] sm:text-[10px] font-bold text-[#B72E35] dark:text-[#A78BFA] border border-[#B72E35]/20 dark:border-purple-800/60">
                POS
              </span>
            </div>
            <p className="font-mono text-[10px] sm:text-xs font-medium text-[#725039] dark:text-[#C9AE8B] leading-tight">
              staff authorization &amp; role terminal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <ThemeToggle variant="pill" />
          <button
            type="button"
            onClick={handleClear}
            title="Reset PIN"
            className="flex items-center gap-1 rounded-full border border-[#C9AE8B]/40 dark:border-stone-700 bg-white/80 dark:bg-stone-800/90 px-2.5 sm:px-3 py-1 text-[11px] font-mono font-bold text-[#725039] dark:text-[#F3E7D3] hover:bg-[#F3E7D3] dark:hover:bg-stone-700 active:scale-95 transition cursor-pointer shadow-xs"
          >
            <RotateCcw className="h-3 w-3" />
            <span className="hidden sm:inline">RESET</span>
          </button>
        </div>
      </header>

      {/* Main Terminal Container */}
      <main className="mx-auto my-auto w-full max-w-lg space-y-3 sm:space-y-4 py-2 sm:py-3">
        {/* Station Selector Bar (Responsive 4-Station Grid) */}
        <section aria-label="Select Station">
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5 rounded-2xl sm:rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#EFE6DA]/70 dark:bg-[#1A1613] p-1.5 sm:p-2 shadow-inner">
            {roles.map((r) => {
              const isSelected = selectedRole === r.id;

              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleSelectRole(r.id)}
                  className={`group relative flex flex-col items-center justify-center rounded-xl sm:rounded-2xl py-2 sm:py-3 px-1 text-center transition-all duration-200 cursor-pointer active:scale-95 ${
                    isSelected
                      ? `bg-white dark:bg-[#251F1B] shadow-md border-2 ${r.activeBorder} scale-[1.02]`
                      : "bg-transparent hover:bg-white/40 dark:hover:bg-white/5 opacity-70 hover:opacity-100 border border-transparent"
                  }`}
                >
                  {/* Station Logo / Icon Container */}
                  <div
                    className={`relative flex items-center justify-center rounded-xl mb-1 sm:mb-1.5 transition-all duration-300 p-1 ${
                      isSelected
                        ? "h-11 w-11 sm:h-14 sm:w-14 bg-[#FAF4EB] dark:bg-stone-800 shadow-xs ring-1 ring-black/5 dark:ring-white/10"
                        : "h-8 w-8 sm:h-10 sm:w-10 bg-black/5 dark:bg-white/5"
                    }`}
                  >
                    <Image
                      src={r.lightLogo}
                      alt={r.name}
                      width={64}
                      height={64}
                      className={`object-contain w-auto dark:hidden transition-transform duration-300 ${
                        isSelected ? "h-8 sm:h-11 scale-105" : "h-5 sm:h-7 opacity-80"
                      }`}
                    />
                    <Image
                      src={r.darkLogo}
                      alt={r.name}
                      width={64}
                      height={64}
                      className={`object-contain w-auto hidden dark:block transition-transform duration-300 ${
                        isSelected ? "h-8 sm:h-11 scale-105" : "h-5 sm:h-7 opacity-80"
                      }`}
                    />
                  </div>

                  {/* Title & Micro-indicator */}
                  <span
                    className={`font-serif font-bold text-[11px] sm:text-xs leading-tight line-clamp-1 transition-colors ${
                      isSelected
                        ? "text-[#241F1C] dark:text-white"
                        : "text-[#725039] dark:text-stone-400"
                    }`}
                  >
                    {r.shortName}
                  </span>

                  {isSelected && (
                    <span className="mt-0.5 h-1 w-4 rounded-full bg-[#B72E35] dark:bg-[#8B5CF6] animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Station Passcode Terminal Card */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pin.length > 0 && !isSubmitting) {
              submitLogin(selectedRole, pin);
            }
          }}
          className={`relative rounded-3xl border border-[#C9AE8B]/50 dark:border-stone-800/80 bg-white/95 dark:bg-[#181412] p-4 sm:p-6 shadow-xl dark:shadow-[0_12px_40px_rgba(0,0,0,0.6)] space-y-3.5 sm:space-y-4 transition-all duration-300 backdrop-blur-md ${currentRole.glowColor} ${
            shake ? "animate-shake" : ""
          }`}
        >
          {/* Station Banner Header */}
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#C9AE8B]/20 dark:border-stone-800/70">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[9px] sm:text-[10px] uppercase font-bold tracking-wider border ${currentRole.badgeBg}`}
                >
                  <Lock className="h-2.5 w-2.5 shrink-0" />
                  Station Locked
                </span>
                <span className="font-mono text-[10px] text-[#725039]/80 dark:text-purple-300/70 hidden sm:inline">
                  PIN Auth Required
                </span>
              </div>

              <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#241F1C] dark:text-white mt-1 leading-tight">
                {currentRole.name}
              </h2>
              <p className="font-serif italic text-[11px] sm:text-xs text-[#725039] dark:text-[#C9AE8B] mt-0.5 line-clamp-1">
                {currentRole.tagline}
              </p>
            </div>

            {/* Glowing Station Badge */}
            <div className="relative flex h-13 w-13 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl bg-[#FAF4EB] dark:bg-[#231C18] border border-[#C9AE8B]/30 dark:border-stone-700/80 shadow-md dark:shadow-[0_0_16px_rgba(0,0,0,0.5)] p-2">
              <Image
                src={currentRole.lightLogo}
                alt={currentRole.name}
                width={64}
                height={64}
                className="object-contain h-9 sm:h-12 w-auto dark:hidden"
              />
              <Image
                src={currentRole.darkLogo}
                alt={currentRole.name}
                width={64}
                height={64}
                className="object-contain h-9 sm:h-12 w-auto hidden dark:block"
              />
            </div>
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-2xl border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/60 p-2.5 text-xs text-rose-900 dark:text-rose-200 font-medium animate-fade-in shadow-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span className="flex-1">{errorMessage}</span>
            </div>
          )}

          {/* Tactile PIN Display (iOS / Square POS Dot Indicators) */}
          <div className="flex flex-col items-center justify-center space-y-2 py-1">
            <div className="flex items-center justify-between w-full max-w-xs px-2 text-[11px] font-mono text-[#725039] dark:text-[#C9AE8B]">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
                <span className="h-1.5 w-1.5 rounded-full bg-[#B72E35] dark:bg-[#8B5CF6] dark:shadow-[0_0_8px_#8B5CF6]" />
                <span>Passcode</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-transparent dark:border-purple-800/50 bg-transparent dark:bg-purple-950/40 text-[#B72E35] dark:text-[#C4B5FD] hover:bg-black/5 dark:hover:bg-purple-900/50 hover:underline cursor-pointer font-bold transition"
              >
                {showPin ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                <span>{showPin ? "Hide" : "Peek"}</span>
              </button>
            </div>

            {/* Hidden native input for physical keyboard input + accessibility */}
            <input
              ref={inputRef}
              type={showPin ? "text" : "password"}
              maxLength={8}
              value={pin}
              autoComplete="current-password"
              onChange={(e) => {
                const clean = e.target.value.replace(/\D/g, "");
                setPin(clean);
                setErrorMessage(null);
                if (clean.length === 4) {
                  setTimeout(() => submitLogin(selectedRole, clean), 150);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitLogin(selectedRole, pin);
                }
              }}
              className="sr-only"
              autoFocus
            />

            {/* Visual Dot / Digit Row */}
            <div
              onClick={() => inputRef.current?.focus()}
              className="flex items-center justify-center gap-3 sm:gap-4 py-2.5 px-6 rounded-2xl bg-[#FAF4EB]/90 dark:bg-[#0E0B09] border border-[#C9AE8B]/40 dark:border-purple-900/40 cursor-text w-full max-w-xs transition-all shadow-inner dark:shadow-[inset_0_2px_12px_rgba(0,0,0,0.8)]"
            >
              {[0, 1, 2, 3].map((idx) => {
                const hasDigit = pin.length > idx;
                const digit = pin[idx];

                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-xl transition-all duration-200 ${
                      hasDigit
                        ? "bg-[#B72E35] text-white dark:bg-gradient-to-tr dark:from-[#7C3AED] dark:to-[#A78BFA] dark:text-white shadow-sm scale-105 font-mono font-black text-lg dark:shadow-[0_0_16px_rgba(139,92,246,0.6)] border border-transparent dark:border-purple-400/40"
                        : "bg-stone-200/70 dark:bg-[#1C1613] border border-stone-300 dark:border-stone-800"
                    }`}
                  >
                    {hasDigit ? (
                      showPin ? (
                        <span>{digit}</span>
                      ) : (
                        <div className="h-3.5 w-3.5 rounded-full bg-white dark:bg-white dark:shadow-[0_0_6px_#fff]" />
                      )
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-stone-400/40 dark:bg-stone-700/60" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Integrated Tactile On-Screen Numeric Keypad (1-9, 0, Clear, Backspace) */}
          <div className="w-full max-w-xs mx-auto pt-1">
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              {[
                { label: "1", sub: "" },
                { label: "2", sub: "ABC" },
                { label: "3", sub: "DEF" },
                { label: "4", sub: "GHI" },
                { label: "5", sub: "JKL" },
                { label: "6", sub: "MNO" },
                { label: "7", sub: "PQRS" },
                { label: "8", sub: "TUV" },
                { label: "9", sub: "WXYZ" },
              ].map((k) => (
                <button
                  key={k.label}
                  type="button"
                  onClick={() => handleKeyTap(k.label)}
                  disabled={isSubmitting}
                  className="group flex flex-col items-center justify-center h-12 sm:h-13.5 rounded-2xl bg-[#FAF4EB] hover:bg-[#F3E7D3] dark:bg-gradient-to-b dark:from-[#261E1A] dark:to-[#1B1512] dark:hover:from-[#312722] dark:hover:to-[#241D19] border border-[#C9AE8B]/30 dark:border-stone-800/90 hover:dark:border-purple-500/40 text-[#241F1C] dark:text-stone-100 shadow-xs dark:shadow-[0_2px_8px_rgba(0,0,0,0.5)] active:scale-90 active:bg-[#B72E35] active:text-white dark:active:from-[#7C3AED] dark:active:to-[#8B5CF6] dark:active:text-white dark:active:border-purple-400 dark:active:shadow-[0_0_20px_rgba(139,92,246,0.8)] transition-all duration-150 cursor-pointer disabled:opacity-50"
                >
                  <span className="font-mono text-lg sm:text-xl font-black leading-none dark:text-white">
                    {k.label}
                  </span>
                  {k.sub && (
                    <span className="text-[7px] sm:text-[8px] font-mono tracking-widest text-[#725039]/60 dark:text-purple-300/50 uppercase mt-0.5 group-hover:dark:text-purple-300/80 transition-colors">
                      {k.sub}
                    </span>
                  )}
                </button>
              ))}

              {/* Clear button */}
              <button
                type="button"
                onClick={handleClear}
                disabled={isSubmitting || pin.length === 0}
                className="flex items-center justify-center h-12 sm:h-13.5 rounded-2xl bg-[#FAF4EB]/60 hover:bg-rose-100 dark:bg-[#251717] dark:hover:bg-[#381B1B] border border-[#C9AE8B]/20 dark:border-rose-900/50 text-xs font-mono font-black text-[#725039] dark:text-rose-300 hover:text-rose-700 active:scale-90 transition cursor-pointer disabled:opacity-30 dark:disabled:opacity-20 shadow-xs"
              >
                C
              </button>

              {/* 0 */}
              <button
                type="button"
                onClick={() => handleKeyTap("0")}
                disabled={isSubmitting}
                className="flex flex-col items-center justify-center h-12 sm:h-13.5 rounded-2xl bg-[#FAF4EB] hover:bg-[#F3E7D3] dark:bg-gradient-to-b dark:from-[#261E1A] dark:to-[#1B1512] dark:hover:from-[#312722] dark:hover:to-[#241D19] border border-[#C9AE8B]/30 dark:border-stone-800/90 hover:dark:border-purple-500/40 text-[#241F1C] dark:text-stone-100 shadow-xs dark:shadow-[0_2px_8px_rgba(0,0,0,0.5)] active:scale-90 active:bg-[#B72E35] active:text-white dark:active:from-[#7C3AED] dark:active:to-[#8B5CF6] dark:active:text-white dark:active:border-purple-400 dark:active:shadow-[0_0_20px_rgba(139,92,246,0.8)] transition-all duration-150 cursor-pointer disabled:opacity-50"
              >
                <span className="font-mono text-lg sm:text-xl font-black leading-none dark:text-white">0</span>
              </button>

              {/* Backspace */}
              <button
                type="button"
                onClick={handleBackspace}
                disabled={isSubmitting || pin.length === 0}
                className="flex items-center justify-center h-12 sm:h-13.5 rounded-2xl bg-[#FAF4EB]/60 hover:bg-stone-200 dark:bg-[#1E1724] dark:hover:bg-[#2D2038] border border-[#C9AE8B]/20 dark:border-purple-900/50 text-[#725039] dark:text-purple-300 active:scale-90 transition cursor-pointer disabled:opacity-30 dark:disabled:opacity-20 shadow-xs"
              >
                <Delete className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Master Unlock Button */}
          <div className="pt-1.5">
            <button
              type="submit"
              disabled={isSubmitting || pin.length === 0}
              className={`w-full flex items-center justify-center gap-2.5 rounded-2xl bg-[#B72E35] hover:bg-[#9E242B] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#9333EA] dark:hover:from-[#6D28D9] dark:hover:to-[#7E22CE] dark:text-white dark:shadow-[0_4px_24px_rgba(147,51,234,0.4)] px-4 py-3.5 sm:py-4 font-mono text-xs sm:text-sm font-bold text-white shadow-lg active:scale-98 transition-all duration-200 ${
                isSubmitting
                  ? "opacity-90 cursor-wait ring-2 ring-white/20 dark:ring-purple-400/40"
                  : pin.length === 0
                  ? "opacity-40 cursor-not-allowed"
                  : "cursor-pointer"
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 border-2 border-white dark:border-white border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="tracking-wide">Unlocking {currentRole.shortName}...</span>
                </>
              ) : (
                <>
                  <Unlock className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span>Unlock {currentRole.shortName}</span>
                  <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 ml-0.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </main>

      {/* Footer Branding */}
      <footer className="text-center py-2 text-[10px] sm:text-[11px] font-mono text-[#725039]/70 dark:text-stone-500">
        smol café • secure role-based operations • rishikesh
      </footer>
    </div>
  );
};
