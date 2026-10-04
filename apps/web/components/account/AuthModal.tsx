"use client";

import React, { useState } from "react";
import { sendOtpAction, verifyOtpAction } from "@/app/account/actions";
import { Smartphone, Mail } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  subtitle?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = "Sign In to smol café",
  subtitle = "Save receipts, track past orders, and claim your dining sessions.",
}) => {
  const [step, setStep] = useState<"DESTINATION" | "OTP">("DESTINATION");
  const [authMode, setAuthMode] = useState<"phone" | "email">("phone");
  const [destination, setDestination] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "info"; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) return;

    setIsLoading(true);
    setFeedback(null);

    try {
      const res = await sendOtpAction(destination, authMode === "phone");
      if (res.success) {
        setStep("OTP");
        setFeedback({
          type: "info",
          text: res.message || "Enter the 6-digit code sent to your device.",
        });
      } else {
        setFeedback({ type: "error", text: res.message || "Could not send verification code." });
      }
    } catch {
      setFeedback({ type: "error", text: "Connection error. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpToken.trim()) return;

    setIsLoading(true);
    setFeedback(null);

    try {
      const res = await verifyOtpAction(
        destination,
        otpToken,
        authMode === "phone",
        displayName.trim() || undefined
      );

      if (res.success) {
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setFeedback({ type: "error", text: res.message || "Invalid verification code." });
      }
    } catch {
      setFeedback({ type: "error", text: "Verification failed. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-black tracking-tight text-stone-900 dark:text-stone-100">
              {title}
            </h3>
            <p className="text-xs text-stone-500 mt-1">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
          >
            ✕
          </button>
        </div>

        {feedback && (
          <p
            className={`mt-4 rounded-xl p-2.5 text-xs font-semibold text-center ${
              feedback.type === "error"
                ? "border border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
                : "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
            }`}
          >
            {feedback.text}
          </p>
        )}

        {step === "DESTINATION" ? (
          <form onSubmit={handleSendOtp} className="mt-5 space-y-4">
            {/* Mode Switcher */}
            <div className="flex rounded-xl bg-stone-100 p-1 dark:bg-stone-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => setAuthMode("phone")}
                className={`flex-1 rounded-lg py-1.5 transition flex items-center justify-center gap-1.5 ${
                  authMode === "phone"
                    ? "bg-white text-stone-900 shadow-sm dark:bg-stone-700 dark:text-stone-100"
                    : "text-stone-500"
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" /> Mobile OTP
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("email")}
                className={`flex-1 rounded-lg py-1.5 transition flex items-center justify-center gap-1.5 ${
                  authMode === "email"
                    ? "bg-white text-stone-900 shadow-sm dark:bg-stone-700 dark:text-stone-100"
                    : "text-stone-500"
                }`}
              >
                <Mail className="h-3.5 w-3.5" /> Email Link
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                {authMode === "phone" ? "Mobile Number" : "Email Address"}
              </label>
              <input
                type={authMode === "phone" ? "tel" : "email"}
                inputMode={authMode === "phone" ? "numeric" : "email"}
                pattern={authMode === "phone" ? "[0-9]*" : undefined}
                maxLength={authMode === "phone" ? 10 : undefined}
                value={destination}
                onChange={(e) => {
                  const val = authMode === "phone" ? e.target.value.replace(/\D/g, "").slice(0, 10) : e.target.value;
                  setDestination(val);
                }}
                placeholder={authMode === "phone" ? "9876543210" : "you@example.com"}
                required
                className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 focus:border-[#9B2C2C] focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !destination.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#9B2C2C] py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-[#822424] active:scale-[0.98] disabled:opacity-50 dark:bg-[#C53030]"
            >
              {isLoading ? "Sending Code..." : "Continue →"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="mt-5 space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                Your Name (Optional)
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-900 focus:border-[#9B2C2C] focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                6-Digit Verification Code
              </label>
              <input
                type="text"
                value={otpToken}
                onChange={(e) => setOtpToken(e.target.value)}
                placeholder="123456"
                required
                maxLength={6}
                className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-center text-lg font-mono font-bold tracking-widest text-stone-900 focus:border-[#9B2C2C] focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !otpToken.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#9B2C2C] py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-[#822424] active:scale-[0.98] disabled:opacity-50 dark:bg-[#C53030]"
            >
              {isLoading ? "Verifying..." : "Verify & Sign In ✓"}
            </button>

            <button
              type="button"
              onClick={() => setStep("DESTINATION")}
              className="w-full text-center text-xs font-semibold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
            >
              ← Change {authMode === "phone" ? "number" : "email"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
