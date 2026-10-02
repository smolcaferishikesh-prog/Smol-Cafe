"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  staffBackdoorLoginAction,
  getRoleCredentialsAction,
} from "@/app/smol-backdoor/actions";
import { AlertTriangle, ArrowRight, Eye, EyeOff } from "lucide-react";
import { ThemeToggle } from "@/components/common/ThemeToggle";

export const StaffBackdoorPortal: React.FC = () => {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<"kitchen" | "barista" | "cashier" | "admin">("barista");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [livePins, setLivePins] = useState<{ kitchen: string; barista: string; cashier: string; admin: string }>({
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

  const roles = [
    {
      id: "kitchen" as const,
      name: "Kitchen KDS",
      lightLogo: "/kitchen-logo.png",
      darkLogo: "/kitchen-logo-dark.png",
      tagline: "Live confirmed ticket queue & prep timer",
      defaultPin: livePins.kitchen || "6175",
      accentColor: "text-amber-600 dark:text-[#F2C84B]",
      badgeBg: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
      destination: "/smol-backdoor/kitchen",
    },
    {
      id: "barista" as const,
      name: "Barista Desk",
      lightLogo: "/barista-logo.png",
      darkLogo: "/barista-logo-dark.png",
      tagline: "Single-origin espresso, pour overs & brew queue",
      defaultPin: livePins.barista || "1234",
      accentColor: "text-[#B72E35] dark:text-[#F2C84B]",
      badgeBg: "bg-amber-50 text-amber-950 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700",
      destination: "/smol-backdoor/barista",
    },
    {
      id: "cashier" as const,
      name: "Cashier Desk",
      lightLogo: "/cashier-logo.png",
      darkLogo: "/cashier-logo-dark.png",
      tagline: "Order verification queue & table cash settlement",
      defaultPin: livePins.cashier || "8112",
      accentColor: "text-[#B72E35] dark:text-[#FF6B6B]",
      badgeBg: "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
      destination: "/smol-backdoor/cashier",
    },
    {
      id: "admin" as const,
      name: "Admin Control",
      lightLogo: "/admin-logo.png",
      darkLogo: "/admin-logo-dark.png",
      tagline: "Master café management, analytics & floor radar",
      defaultPin: livePins.admin || "9227",
      accentColor: "text-[#754CFF] dark:text-[#C4B5FD]",
      badgeBg: "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
      destination: "/smol-backdoor/admin",
    },
  ];

  const handleQuickLogin = async (role: "kitchen" | "barista" | "cashier" | "admin", customPin?: string) => {
    // Require explicit PIN — no empty or default fallback allowed
    const activePin = customPin ?? pin;

    if (!activePin || activePin.trim().length === 0) {
      setErrorMessage("Please enter your station PIN to continue.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await staffBackdoorLoginAction({
        role,
        pin: activePin.trim(),
      });

      if (res.success && res.redirectTo) {
        router.push(res.redirectTo);
      } else {
        setErrorMessage(res.message || "Authentication failed. Please check credentials.");
      }
    } catch {
      setErrorMessage("An unexpected network error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentRoleConfig = roles.find((r) => r.id === selectedRole)!;

  return (
    <div className="min-h-screen bg-[#FAF4EB] dark:bg-[#171412] text-[#241F1C] dark:text-[#F3E7D3] font-sans flex flex-col justify-between p-4 sm:p-6 transition-colors duration-200">
      {/* Top Header */}
      <header className="mx-auto flex w-full max-w-lg items-center justify-between py-4 border-b border-[#C9AE8B]/40 dark:border-stone-800">
        <div className="flex items-center gap-3.5">
          <div className="relative flex items-center justify-center shrink-0">
            {/* Light Mode Logo */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/backdoor_logo_light.png"
              alt="smol backdoor"
              className="h-16 sm:h-20 w-auto object-contain dark:hidden transition-transform duration-300 hover:scale-105 drop-shadow-xs"
            />
            {/* Night / Dark Mode Logo */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/backdoor_logo_dark.png"
              alt="smol backdoor"
              className="h-16 sm:h-20 w-auto object-contain hidden dark:block transition-transform duration-300 hover:scale-105 drop-shadow-xs"
            />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-[#241F1C] dark:text-white lowercase">
              smol backdoor
            </h1>
            <p className="font-mono text-xs font-medium text-[#725039] dark:text-[#C9AE8B]">
              staff authorization &amp; role portal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle variant="pill" />
          <button
            type="button"
            onClick={() => {
              setPin("");
              setErrorMessage(null);
            }}
            className="rounded-full border border-[#C9AE8B]/50 dark:border-stone-700 bg-white dark:bg-stone-800 px-3.5 py-1.5 text-xs font-serif font-bold text-[#725039] dark:text-[#F3E7D3] hover:bg-[#F3E7D3] dark:hover:bg-stone-700 transition active:scale-95 shadow-xs cursor-pointer"
          >
            RESET
          </button>
        </div>
      </header>

      {/* Main Role Selection & Keypad Card */}
      <main className="mx-auto my-auto w-full max-w-lg space-y-4 sm:space-y-5 py-4 sm:py-6">
        {/* Role Selector 4-Column Tabs */}
        <div className="grid grid-cols-4 gap-1 sm:gap-2 rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#F3E7D3]/60 dark:bg-[#1F1B18] p-1.5 sm:p-2 shadow-xs">
          {roles.map((r) => {
            const isSelected = selectedRole === r.id;

            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setSelectedRole(r.id);
                  setPin("");
                  setErrorMessage(null);
                }}
                className={`flex flex-col items-center justify-center rounded-2xl py-2 sm:py-2.5 px-0.5 sm:px-1.5 text-center transition-all duration-300 cursor-pointer ${
                  isSelected
                    ? "bg-white dark:bg-[#2B2521] shadow-md border-2 border-[#B72E35] dark:border-[#8B5CF6] scale-[1.02] sm:scale-[1.04]"
                    : "bg-transparent hover:bg-white/50 dark:hover:bg-white/5 opacity-60 hover:opacity-90"
                }`}
              >
                <div
                  className={`relative flex items-center justify-center rounded-2xl mb-1 sm:mb-1.5 transition-all duration-300 p-1 ${
                    isSelected
                      ? "h-12 w-12 sm:h-16 sm:w-16 md:h-20 md:w-20 bg-[#FAF4EB] dark:bg-stone-800 shadow-xs"
                      : "h-9 w-9 sm:h-12 sm:w-12 bg-black/5 dark:bg-white/5"
                  }`}
                >
                  <Image
                    src={r.lightLogo}
                    alt={r.name}
                    width={80}
                    height={80}
                    className={`object-contain w-auto dark:hidden transition-all duration-300 ${isSelected ? "h-9 sm:h-13 md:h-16" : "h-6 sm:h-9"}`}
                  />
                  <Image
                    src={r.darkLogo}
                    alt={r.name}
                    width={80}
                    height={80}
                    className={`object-contain w-auto hidden dark:block transition-all duration-300 ${isSelected ? "h-9 sm:h-13 md:h-16" : "h-6 sm:h-9"}`}
                  />
                </div>
                <span
                  className={`font-serif font-bold line-clamp-1 transition-all duration-300 ${
                    isSelected
                      ? "text-[10px] sm:text-xs md:text-sm text-[#241F1C] dark:text-white"
                      : "text-[9px] sm:text-[11px] text-[#725039] dark:text-stone-400"
                  }`}
                >
                  {r.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Station Card (Warm Artisanal Container) */}
        <div className="rounded-3xl border border-[#C9AE8B]/50 dark:border-stone-800 bg-white dark:bg-[#1E1A17] p-4 sm:p-6 md:p-7 shadow-xl space-y-4 sm:space-y-5 transition-colors">
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <span
                className={`inline-block rounded-full px-2.5 sm:px-3 py-0.5 font-mono text-[9px] sm:text-[10px] uppercase font-bold tracking-wider border ${currentRoleConfig.badgeBg}`}
              >
                STATION AUTHORIZATION
              </span>
              <h2 className="font-serif text-xl sm:text-2xl md:text-3xl font-bold text-[#241F1C] dark:text-white mt-1">
                {currentRoleConfig.name}
              </h2>
              <p className="font-serif italic text-[11px] sm:text-xs text-[#725039] dark:text-[#C9AE8B] mt-0.5 leading-snug">
                {currentRoleConfig.tagline}
              </p>
            </div>
            <div className="relative flex h-16 w-16 sm:h-24 sm:w-24 md:h-28 md:w-28 shrink-0 items-center justify-center rounded-2xl sm:rounded-3xl bg-[#FAF4EB] dark:bg-stone-800 border border-[#C9AE8B]/40 dark:border-stone-700 shadow-md p-1.5 sm:p-3">
              <Image
                src={currentRoleConfig.lightLogo}
                alt={currentRoleConfig.name}
                width={88}
                height={88}
                className="object-contain h-12 sm:h-18 md:h-20 w-auto dark:hidden"
              />
              <Image
                src={currentRoleConfig.darkLogo}
                alt={currentRoleConfig.name}
                width={88}
                height={88}
                className="object-contain h-12 sm:h-18 md:h-20 w-auto hidden dark:block"
              />
            </div>
          </div>

          {errorMessage && (
            <div className="flex items-center gap-2 rounded-2xl border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-900 dark:text-rose-300 font-serif animate-fade-in">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Quick PIN Input Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-[#725039] dark:text-[#C9AE8B]">
              <span>Enter Station PIN</span>
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="text-[11px] text-[#B72E35] dark:text-[#A78BFA] flex items-center gap-1 hover:underline cursor-pointer"
              >
                {showPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                <span>{showPin ? "Hide" : "Show"}</span>
              </button>
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5 w-full">
              <input
                type={showPin ? "text" : "password"}
                maxLength={8}
                value={pin}
                placeholder="••••"
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleQuickLogin(selectedRole, pin);
                  }
                }}
                className="min-w-0 flex-1 rounded-2xl border border-[#C9AE8B]/60 dark:border-stone-700 bg-[#FAF4EB] dark:bg-[#141210] px-3 sm:px-4 py-2.5 sm:py-3 font-mono text-base sm:text-xl font-black text-center tracking-widest text-[#241F1C] dark:text-white placeholder-stone-400 dark:placeholder-stone-600 focus:border-[#B72E35] dark:focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#B72E35] dark:focus:ring-[#8B5CF6] shadow-inner"
              />
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleQuickLogin(selectedRole, pin)}
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-[#B72E35] hover:bg-[#9E242B] dark:bg-[#8B5CF6] dark:hover:bg-[#7C3AED] dark:shadow-[0_0_16px_rgba(139,92,246,0.35)] px-3.5 sm:px-6 py-2.5 sm:py-3 font-mono text-xs sm:text-sm font-bold text-white shadow-md active:scale-95 transition disabled:opacity-50 cursor-pointer shrink-0 whitespace-nowrap"
              >
                <span>{isSubmitting ? "..." : "Unlock"}</span>
                <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-2 text-[11px] font-mono text-[#725039]/70 dark:text-stone-500">
        smol café • secure role-based operations • rishikesh
      </footer>
    </div>
  );
};
