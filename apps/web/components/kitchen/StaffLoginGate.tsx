"use client";

import React, { useState } from "react";
import Image from "next/image";
import { staffLoginAction } from "@/app/kitchen/actions";
import { ThemeToggle } from "@/components/common/ThemeToggle";

interface StaffLoginGateProps {
  onSuccess?: () => void;
}

export const StaffLoginGate: React.FC<StaffLoginGateProps> = ({ onSuccess }) => {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await staffLoginAction(pin);
      if (result.success) {
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.reload();
        }
      } else {
        setError(result.message || "Invalid staff passcode.");
      }
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#F3E7D3] dark:bg-[#241F1C] p-4 text-[#241F1C] dark:text-[#F3E7D3] font-sans transition-colors duration-200">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm rounded-3xl border border-[#C9AE8B]/40 dark:border-[#C9AE8B]/20 bg-[#FAF4EB] dark:bg-[#1D1815] p-8 shadow-2xl transition-colors duration-200">
        <div className="text-center">
          <div className="relative mx-auto mb-3 h-24 w-20 select-none">
            <Image
              src="/kitchen-logo.png"
              alt="smol café kitchen logo"
              fill
              priority
              className="object-contain drop-shadow-md dark:hidden block"
            />
            <Image
              src="/kitchen-logo-dark.png"
              alt="smol café kitchen logo night mode"
              fill
              priority
              className="object-contain drop-shadow-[0_0_12px_rgba(168,85,247,0.6)] hidden dark:block"
            />
          </div>
          <h2 className="font-serif text-2xl font-bold tracking-tight text-[#241F1C] dark:text-[#F3E7D3] lowercase">
            kitchen gds
          </h2>
          <p className="font-serif italic text-xs text-[#725039] dark:text-[#C9AE8B] mt-1">
            enter staff pin to access order preparation
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <input
              type="password"
              inputMode="numeric"
              placeholder="Staff PIN (e.g. 1234)"
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
            {isLoading ? "unlocking..." : "enter kitchen gds"}
          </button>
        </form>

      </div>
    </div>
  );
};
