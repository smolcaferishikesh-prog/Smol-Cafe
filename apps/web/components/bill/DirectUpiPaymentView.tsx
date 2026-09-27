"use client";

import React, { useState } from "react";
import { getUpiConfig, buildUpiUri, launchUpiAppChooser } from "@/lib/upi";
import { Smartphone, QrCode, Copy, Check, ShieldCheck, ArrowRight, Clock, Zap } from "lucide-react";

interface DirectUpiPaymentViewProps {
  tableSessionId: string;
  tableLabel?: string;
  totalRupees: number;
  onPaymentInitiated?: () => void;
}

export const DirectUpiPaymentView: React.FC<DirectUpiPaymentViewProps> = ({
  tableLabel,
  totalRupees,
  onPaymentInitiated,
}) => {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [paymentInitiated, setPaymentInitiated] = useState(false);
  const [utrInput, setUtrInput] = useState("");
  const [utrSubmitted, setUtrSubmitted] = useState(false);

  const upiConfig = getUpiConfig();
  const amountPaise = Math.round(totalRupees * 100);
  const upiUri = buildUpiUri({
    amountPaise,
    orderNo: tableLabel ? `Table ${tableLabel}` : undefined,
  });

  const handleLaunchUpi = () => {
    setPaymentInitiated(true);
    if (onPaymentInitiated) onPaymentInitiated();
    launchUpiAppChooser({
      amountPaise,
      orderNo: tableLabel ? `Table ${tableLabel}` : undefined,
    });
  };

  const handleCopyUpiId = () => {
    navigator.clipboard.writeText(upiConfig.vpa);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate SVG QR Code URL using quick chart QR API fallback for high resolution QR
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiUri)}`;

  return (
    <div className="space-y-4">
      {/* Primary Mobile Launch Button */}
      <button
        type="button"
        onClick={handleLaunchUpi}
        className="w-full flex items-center justify-between rounded-2xl bg-[#B72E35] p-4 font-bold text-white shadow-md transition hover:bg-[#A0282E] active:scale-[0.98]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
            <Smartphone className="h-5 w-5 text-white" />
          </div>
          <div className="text-left">
            <p className="font-serif text-base text-white">Pay ₹{totalRupees} via UPI App</p>
            <p className="font-serif text-xs text-white/80">Opens GPay, PhonePe, Paytm, BHIM</p>
          </div>
        </div>
        <ArrowRight className="h-5 w-5" />
      </button>

      {/* Laptop / Dev Mode Test Payment Shortcut */}
      <button
        type="button"
        onClick={() => {
          if (onPaymentInitiated) onPaymentInitiated();
          setPaymentInitiated(true);
          setUtrInput(`TEST-${Date.now().toString().slice(-6)}`);
          setUtrSubmitted(true);
        }}
        className="w-full flex items-center justify-center gap-2 rounded-2xl border border-amber-400 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs font-bold text-amber-900 dark:text-amber-200 hover:bg-amber-100 transition cursor-pointer shadow-xs"
      >
        <Zap className="h-4 w-4 text-amber-600 shrink-0" />
        <span>⚡ Laptop Testing: Simulate UPI Payment Success</span>
      </button>

      {/* Secondary Options Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Toggle QR Code */}
        <button
          type="button"
          onClick={() => setShowQr(!showQr)}
          className="flex items-center justify-center gap-2 rounded-xl border border-[#C9AE8B]/60 bg-[#FAF4EB] p-3 text-xs font-bold text-[#241F1C] transition hover:border-[#B72E35] active:scale-95"
        >
          <QrCode className="h-4 w-4 text-[#B72E35]" />
          <span>{showQr ? "Hide UPI QR" : "Show UPI QR"}</span>
        </button>

        {/* Copy UPI ID */}
        <button
          type="button"
          onClick={handleCopyUpiId}
          className="flex items-center justify-center gap-2 rounded-xl border border-[#C9AE8B]/60 bg-[#FAF4EB] p-3 text-xs font-bold text-[#241F1C] transition hover:border-[#B72E35] active:scale-95"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-[#725039]" />}
          <span>{copied ? "UPI ID Copied!" : "Copy UPI ID"}</span>
        </button>
      </div>

      {/* Display Payee Details */}
      <div className="rounded-2xl border border-[#C9AE8B]/40 bg-[#FAF4EB]/80 p-3.5 text-center text-xs space-y-1">
        <p className="font-serif text-[#725039]">Paying directly to smol café:</p>
        <p className="font-mono font-bold text-[#B72E35] text-sm select-all">{upiConfig.vpa}</p>
        <p className="font-mono text-[11px] text-[#5C544D]">Phone: {upiConfig.phone}</p>
      </div>

      {/* Expandable QR Code Card */}
      {showQr && (
        <div className="rounded-3xl border border-[#C9AE8B]/60 bg-[#FAF4EB] p-5 text-center shadow-sm space-y-3 animate-fade-in-down">
          <p className="font-serif font-bold text-sm text-[#241F1C]">Scan to Pay ₹{totalRupees}</p>
          <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-2xl border-2 border-[#C9AE8B]/40 bg-white p-3 shadow-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrImageUrl} alt="UPI Payment QR Code" className="h-full w-full object-contain" />
          </div>
          <p className="font-serif italic text-xs text-[#725039]">
            Scan with Google Pay, PhonePe, Paytm, CRED or any BHIM UPI app
          </p>
        </div>
      )}

      {/* Payment Initiated / Reconciliation Card */}
      {paymentInitiated && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-3 animate-fade-in">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
            <Clock className="h-4 w-4 text-amber-700 animate-spin" />
            <span>Payment Pending Reconciliation</span>
          </div>
          <p className="text-xs text-amber-800 font-serif">
            Once you complete the payment in your UPI app, enter the 12-digit UTR / Reference No. below or notify counter staff for instant confirmation:
          </p>

          {!utrSubmitted ? (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter 12-digit UTR / Ref No."
                value={utrInput}
                onChange={(e) => setUtrInput(e.target.value)}
                className="flex-1 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-mono text-stone-900 outline-none focus:border-amber-600"
              />
              <button
                type="button"
                onClick={() => {
                  if (utrInput.trim()) setUtrSubmitted(true);
                }}
                className="rounded-xl bg-amber-900 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800"
              >
                Submit
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl bg-emerald-100 p-2.5 text-xs text-emerald-900 font-bold">
              <span>✓ Ref #{utrInput} submitted! Staff verifying...</span>
            </div>
          )}
        </div>
      )}

      {/* Security Footer */}
      <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-[#725039]">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
        <span>Direct 0% markup UPI payment to {upiConfig.name}</span>
      </div>
    </div>
  );
};
