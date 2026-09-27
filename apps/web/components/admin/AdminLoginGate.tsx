"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Lock } from "lucide-react";
import { ThemeToggle } from "@/components/common/ThemeToggle";

interface AdminLoginGateProps {
  onSuccess: () => void;
}

export const AdminLoginGate: React.FC<AdminLoginGateProps> = ({ onSuccess }) => {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;

    setIsLoading(true);
    setError(null);

    setTimeout(() => {
      // ONLY allow access with legitimate Admin PIN 9227 (or master password smol2026)
      if (pin.trim() === "9227" || pin.trim() === "smol2026") {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("smol_admin_auth", "true");
        }
        onSuccess();
      } else {
        setError("Invalid admin passcode. Please enter PIN: 9227.");
      }
      setIsLoading(false);
    }, 400);
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#F3E7D3] dark:bg-[#241F1C] p-4 text-[#241F1C] dark:text-[#F3E7D3] font-sans transition-colors duration-200">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm rounded-3xl border border-[#C9AE8B]/40 dark:border-[#C9AE8B]/20 bg-[#FAF4EB] dark:bg-[#1D1815] p-8 shadow-2xl transition-colors duration-200">
        <div className="text-center">
          <div className="relative mx-auto mb-3 h-24 w-18 select-none">
            <Image
              src="/admin-logo.png"
              alt="smol café admin logo"
              fill
              priority
              className="object-contain drop-shadow-md dark:hidden block"
            />
            <Image
              src="/admin-logo-dark.png"
              alt="smol café admin logo night mode"
              fill
              priority
              className="object-contain drop-shadow-[0_0_12px_rgba(168,85,247,0.6)] hidden dark:block"
            />
          </div>
          <h2 className="font-serif text-2xl font-bold tracking-tight text-[#241F1C] dark:text-[#F3E7D3] lowercase">
            admin tower
          </h2>
          <p className="font-serif italic text-xs text-[#725039] dark:text-[#C9AE8B] mt-1">
            sign in to manage orders, catalog, staff &amp; operations
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="relative">
            <input
              type="password"
              placeholder="Enter Admin PIN (9227)"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full rounded-2xl border border-[#C9AE8B]/40 dark:border-[#C9AE8B]/30 bg-[#F3E7D3] dark:bg-[#241F1C] px-4 py-3.5 text-center font-mono text-lg tracking-widest text-[#241F1C] dark:text-[#F3E7D3] placeholder:text-xs placeholder:tracking-normal placeholder:text-[#725039]/50 dark:placeholder:text-[#C9AE8B]/50 focus:border-[#B72E35] focus:outline-none"
              autoFocus
            />
          </div>

          {error && (
            <p className="rounded-xl border border-[#B72E35]/60 bg-[#B72E35]/20 p-2.5 text-center text-xs font-semibold text-[#F2C84B]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading || !pin}
            className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-[#B72E35] py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#9B242A] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? "verifying..." : "open admin dashboard"}
          </button>
        </form>

      </div>
    </div>
  );
};
