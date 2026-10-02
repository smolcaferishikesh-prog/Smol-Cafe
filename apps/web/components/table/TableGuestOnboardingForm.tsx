"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { User, Phone, ArrowRight, Sparkles, ChevronDown } from "lucide-react";
import { onboardGuestAndRedirectAction } from "@/app/t/actions";
import { COUNTRY_CODES, normalizePhoneNumber } from "@/lib/customer-phone";

interface TableGuestOnboardingFormProps {
  tableToken: string;
  tableLabel: string;
  initialGuestName?: string;
  initialGuestPhone?: string;
}

export function TableGuestOnboardingForm({
  tableToken,
  tableLabel,
  initialGuestName = "",
  initialGuestPhone = "",
}: TableGuestOnboardingFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(initialGuestName);
  const [phone, setPhone] = useState(initialGuestPhone);
  const [countryCode, setCountryCode] = useState("+91");
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from localStorage or initial props if available
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedName = localStorage.getItem("smol_guest_name");
      const savedPhone = localStorage.getItem("smol_guest_phone");
      if (savedName && !name) setName(savedName);
      if (savedPhone && !phone) {
        setPhone(savedPhone);
        const matched = COUNTRY_CODES.find((c) => savedPhone.startsWith(c.code));
        if (matched) setCountryCode(matched.code);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const normalizedPhone = normalizePhoneNumber(phone, countryCode);

    if (!trimmedName || trimmedName.length < 2) {
      setError("Please enter your name to continue.");
      return;
    }

    if (!normalizedPhone || normalizedPhone.length < 8 || !normalizedPhone.startsWith("+")) {
      setError("Please enter a valid international mobile number.");
      return;
    }

    // Persist complete E.164 normalized phone in localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("smol_guest_name", trimmedName);
      localStorage.setItem("smol_guest_phone", normalizedPhone);
      localStorage.setItem("smol_current_table", tableLabel);
    }

    const formData = new FormData();
    formData.append("tableToken", tableToken);
    formData.append("guestName", trimmedName);
    formData.append("guestPhone", normalizedPhone);

    startTransition(async () => {
      try {
        const result = await onboardGuestAndRedirectAction(formData);
        if (result && !result.success) {
          setError(result.error || "Could not set up table session. Please try again.");
        } else {
          router.push("/home");
        }
      } catch (err) {
        console.error("Error onboarding guest:", err);
        router.push("/home");
      }
    });
  };

  const selectedCountry = COUNTRY_CODES.find((c) => c.code === countryCode) || COUNTRY_CODES[0];

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-[320px] sm:max-w-xs pt-3 space-y-3"
    >
      {/* Error Alert */}
      {error && (
        <div className="rounded-xl border border-[#B72E35]/40 bg-[#B72E35]/10 px-3.5 py-2 text-xs font-sans text-[#B72E35] dark:text-[#FF8080] text-center animate-shake">
          {error}
        </div>
      )}

      {/* Guest Name Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#725039] dark:text-[#C9AE8B]">
          <User className="h-4 w-4 opacity-70" />
        </div>
        <input
          type="text"
          name="guestName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your Name (e.g. Sonu)"
          required
          autoComplete="name"
          className="w-full pl-10 pr-4 py-3 rounded-2xl border border-[#C9AE8B]/60 dark:border-white/15 bg-[#FAF4EB] dark:bg-[#1E1815] text-[#241F1C] dark:text-[#FAF4EB] placeholder-[#725039]/60 dark:placeholder-[#C9AE8B]/50 font-serif text-sm focus:outline-none focus:border-[#B72E35] dark:focus:border-[#F2C84B] focus:ring-2 focus:ring-[#B72E35]/20 shadow-xs transition-all"
        />
      </div>

      {/* International Phone Number Input with Country Dropdown */}
      <div className="relative flex items-center rounded-2xl border border-[#C9AE8B]/60 dark:border-white/15 bg-[#FAF4EB] dark:bg-[#1E1815] shadow-xs focus-within:border-[#B72E35] dark:focus-within:border-[#F2C84B] focus-within:ring-2 focus-within:ring-[#B72E35]/20 transition-all overflow-hidden">
        {/* Country Code Selector Dropdown */}
        <div className="relative flex items-center bg-[#EFE3D3]/60 dark:bg-white/5 border-r border-[#C9AE8B]/30 dark:border-white/10 shrink-0">
          <select
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            className="appearance-none bg-transparent pl-3.5 pr-6 py-3 font-mono text-xs font-bold text-[#241F1C] dark:text-[#FAF4EB] focus:outline-none cursor-pointer"
            aria-label="Select Country Code"
          >
            {COUNTRY_CODES.map((c) => (
              <option key={`${c.iso}-${c.code}`} value={c.code} className="bg-[#FAF4EB] dark:bg-[#241F1C] text-[#241F1C] dark:text-[#FAF4EB]">
                {c.flag} {c.code} ({c.iso})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-1.5 h-3.5 w-3.5 text-[#725039] dark:text-[#C9AE8B] pointer-events-none opacity-60" />
        </div>

        {/* Local Mobile Number Input */}
        <input
          type="tel"
          name="guestPhone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={selectedCountry.example}
          required
          maxLength={16}
          autoComplete="tel"
          className="flex-1 px-3 py-3 bg-transparent text-[#241F1C] dark:text-[#FAF4EB] placeholder-[#725039]/60 dark:placeholder-[#C9AE8B]/50 font-mono text-xs sm:text-sm focus:outline-none"
        />
      </div>

      {/* Micro Loyalty Banner */}
      <div className="flex items-center justify-center gap-1.5 pt-0.5 text-[10.5px] font-mono text-[#725039] dark:text-[#C9AE8B]">
        <Sparkles className="h-3 w-3 text-[#B72E35] dark:text-[#F2C84B]" />
        <span>E.164 international receipt &amp; order tracking</span>
      </div>

      {/* Primary CTA: Continue to Café (Navigating to /home) */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="group relative w-full overflow-hidden flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-b from-[#E03A43]/85 via-[#B72E35]/90 to-[#7D1217]/95 dark:from-[#A855F7]/85 dark:via-[#7E22CE]/90 dark:to-[#4C1D95]/95 backdrop-blur-[16px] border border-white/55 dark:border-purple-300/45 py-3.5 px-6 text-sm sm:text-base font-serif font-bold text-white shadow-[0_8px_24px_rgba(183,46,53,0.38),inset_0_1.5px_1.5px_rgba(255,255,255,0.85),inset_0_-2px_4px_rgba(0,0,0,0.25)] dark:shadow-[0_8px_28px_rgba(126,34,206,0.5),inset_0_1.5px_1.5px_rgba(255,255,255,0.85),inset_0_-2px_4px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_10px_28px_rgba(183,46,53,0.5)] dark:hover:shadow-[0_10px_32px_rgba(168,85,247,0.65)] active:scale-[0.98] disabled:opacity-60 cursor-pointer"
        >
          {/* Top Curved Specular Glass Arc Highlight */}
          <span className="absolute inset-x-4 top-0.5 h-[38%] rounded-full bg-gradient-to-b from-white/60 via-white/15 to-transparent pointer-events-none opacity-90" />

          {/* Ambient Shimmer Sweep on Hover */}
          <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/20 dark:via-white/30 to-transparent transition-transform duration-1000 ease-in-out pointer-events-none" />

          <span className="relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
            {isPending ? "Entering Café..." : "Continue to Café"}
          </span>
          <ArrowRight className="relative z-10 h-4 w-4 stroke-[2.5] transition-transform duration-300 group-hover:translate-x-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]" />
        </button>

        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              localStorage.setItem("smol_current_table", tableLabel);
            }
            router.push("/home");
          }}
          className="w-full mt-2 text-center text-xs font-mono text-[#725039] dark:text-[#C9AE8B] hover:text-[#B72E35] dark:hover:text-[#F2C84B] transition-colors cursor-pointer"
        >
          Skip &amp; order as guest →
        </button>
      </div>
    </form>
  );
}
