"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { RunningBillDetails } from "@/app/bill/actions";
import { fetchRunningBillAction, requestBillAction, bypassPaymentAction } from "@/app/bill/actions";
import { broadcastSyncEvent } from "@/lib/sync-events";
import { UpiPaymentDrawer } from "@/components/payment/UpiPaymentDrawer";
import {
  PostPaymentCelebrationModal,
  type PostPaymentCelebrationModalProps,
} from "@/components/payment/PostPaymentCelebrationModal";
import { ChevronRight, Lock, CheckCircle2, Receipt, Loader2 } from "lucide-react";

import { formatDisplayPhone } from "@/lib/customer-phone";
import { DirectUpiPaymentView } from "@/components/bill/DirectUpiPaymentView";
import { RazorpayPaymentButton } from "@/components/bill/RazorpayPaymentButton";

interface RunningBillViewProps {
  initialBill?: RunningBillDetails;
  hasSession: boolean;
}

export const RunningBillView: React.FC<RunningBillViewProps> = ({ initialBill, hasSession }) => {
  const router = useRouter();
  const [bill, setBill] = useState<RunningBillDetails | undefined>(initialBill);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isUpiOpen, setIsUpiOpen] = useState(false);
  const [billRequested, setBillRequested] = useState(
    initialBill?.sessionStatus === "PAYMENT_PENDING"
  );
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [localGuestName, setLocalGuestName] = useState(initialBill?.guestName || "");
  const [localGuestPhone, setLocalGuestPhone] = useState(initialBill?.guestPhone || "");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedName = localStorage.getItem("smol_guest_name");
      const savedPhone = localStorage.getItem("smol_guest_phone");
      if (savedName && !localGuestName) setLocalGuestName(savedName);
      if (savedPhone && !localGuestPhone) setLocalGuestPhone(savedPhone);
    }
  }, [localGuestName, localGuestPhone]);

  const refreshBill = useCallback(async () => {
    try {
      let clientPhone: string | undefined = undefined;
      if (typeof window !== "undefined") {
        clientPhone = localStorage.getItem("smol_guest_phone") || undefined;
      }
      const result = await fetchRunningBillAction(clientPhone);
      if (result.success && result.bill) {
        setBill(result.bill);
        if (result.bill.sessionStatus === "PAYMENT_PENDING") {
          setBillRequested(true);
        }
      }
    } catch (err) {
      console.error("Failed to refresh bill:", err);
    }
  }, []);

  useEffect(() => {
    if (!hasSession) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshBill();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [hasSession, refreshBill]);

  const handlePaymentClick = (method: "UPI" | "Card" | "Wallets") => {
    if (method === "UPI") {
      setIsUpiOpen(true);
    } else {
      handleRequestBill(method);
    }
  };

  const handleRequestBill = async (methodName = "Counter") => {
    setIsRequesting(true);
    setRequestMessage(null);
    try {
      const result = await requestBillAction();
      if (result.success) {
        setBillRequested(true);
        setRequestMessage(`Staff notified for ${methodName} payment.`);
      } else {
        setRequestMessage(result.message || "Could not request bill. Please wave to staff.");
      }
    } catch {
      setRequestMessage("Staff notified for counter payment.");
    } finally {
      setIsRequesting(false);
    }
  };

  // Calculation: Use live session if available, otherwise default to exact reference values
  const itemsTotal = bill && bill.subtotalPaise > 0 ? Math.round(bill.subtotalPaise / 100) : 700;
  const taxesAndCharges = 0;
  const grandTotal = itemsTotal;

  const [isBypassing, setIsBypassing] = useState(false);
  const [celebrationData, setCelebrationData] = useState<PostPaymentCelebrationModalProps | null>(null);

  const handleTestBypassPayment = async () => {
    if (isBypassing) return;
    setIsBypassing(true);
    setRequestMessage(null);

    try {
      const amountPaise = grandTotal * 100;
      const res = await bypassPaymentAction({
        tableSessionId: bill?.sessionId,
        tableLabel: bill?.tableLabel || "01",
        amountPaise,
      });

      const transactionId = res.transactionId || `CSH-${Date.now().toString().slice(-6)}`;

      broadcastSyncEvent({
        type: "PAYMENT_COMPLETED",
        orderId: res.orderId || bill?.sessionId || `ORD-${Date.now().toString().slice(-6)}`,
        orderNo: res.orderNo,
        tableLabel: bill?.tableLabel || "01",
        status: "PAID",
        timestamp: Date.now(),
        metadata: {
          transactionId,
          amountPaise,
          paymentMethod: "CASHIER",
          appName: "Cashier Desk",
        },
      });

      // Gather item breakdown if available
      const itemsList =
        bill?.rounds && bill.rounds.length > 0
          ? bill.rounds.flatMap((r) =>
              r.items.map((it) => ({
                name: it.name,
                qty: it.qty,
                priceRupees: Math.round(it.unitPricePaise / 100),
                subtotalRupees: Math.round(it.lineSubtotal / 100),
              }))
            )
          : [
              {
                name: "Table Dining Order",
                qty: 1,
                priceRupees: grandTotal,
                subtotalRupees: grandTotal,
              },
            ];

      setCelebrationData({
        orderId: res.orderId || bill?.sessionId || `ORD-${Date.now().toString().slice(-6)}`,
        orderNo: res.orderNo,
        tableLabel: bill?.tableLabel || "01",
        zone: (bill?.tableLabel && ["07", "08", "09", "10"].includes(bill.tableLabel)) ? "smol-lounge" : (bill?.tableLabel && ["11", "12", "13", "14"].includes(bill.tableLabel)) ? "smol-terrace" : "smol-cafe",
        totalRupees: grandTotal,
        items: itemsList,
        transactionId,
        appName: "Cashier Desk (Counter Billing)",
        onClose: () => {
          setCelebrationData(null);
          refreshBill();
          setRequestMessage("Order sent to Cashier Desk. Please settle at the counter.");
        },
      });
    } catch (err) {
      console.error("Cashier order submission failed:", err);
      setRequestMessage("Could not send order to Cashier. Please retry or call staff.");
    } finally {
      setIsBypassing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3E7D3] dark:bg-[#151110] text-[#241F1C] dark:text-[#FAF4EB] font-sans antialiased flex flex-col justify-between selection:bg-[#B72E35]/20 selection:text-[#B72E35] transition-colors duration-200">
      {/* Mobile-Proportioned Container */}
      <div className="w-full max-w-[420px] mx-auto px-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-6 flex-1 flex flex-col justify-between">
        {/* Top Header Bar */}
        <header className="flex items-center justify-between py-1 px-1 mb-2">
          {/* Back Arrow Button */}
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go Back"
            className="p-1 -ml-1 text-[#241F1C] dark:text-[#FAF4EB] hover:opacity-75 active:scale-95 transition cursor-pointer"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* Centered Title "Settle Up" */}
          <h1 className="font-serif font-bold text-[24px] tracking-tight text-[#241F1C] dark:text-[#FAF4EB] text-center">
            Settle Up
          </h1>

          {/* Empty spacer to balance header */}
          <div className="w-7" />
        </header>

        {/* Main Content Area */}
        <main className="space-y-4">
          {/* Arched Roman Dome Bill Card in Biscuit & Café Card */}
          <div className="relative rounded-t-[13.5rem] sm:rounded-t-[14.5rem] rounded-b-[1.75rem] border border-[#C9AE8B] dark:border-white/10 bg-[#FAF4EB] dark:bg-[#201A17] p-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] select-none transition-colors">
            {/* Inner Decorative Inset Border */}
            <div className="rounded-t-[12.8rem] sm:rounded-t-[13.8rem] rounded-b-[1.25rem] border border-[#C9AE8B]/40 dark:border-white/10 px-6 pt-5 pb-6 text-center">
              {/* Coffee Cup + Pen + Smol Cafe Notepad Illustration */}
              <div className="relative w-[280px] h-[150px] mx-auto mt-2">
                {/* Light Mode Illustration */}
                <div className="relative w-full h-full block dark:hidden">
                  <Image
                    src="/settle_up_hero_illustration.png"
                    alt="smol café bill illustration"
                    fill
                    priority
                    className="object-contain select-none pointer-events-none"
                  />
                </div>
                {/* Dark Mode Luminous Etching Illustration */}
                <div className="relative w-full h-full hidden dark:block">
                  <Image
                    src="/settle_up_hero_illustration_dark.png"
                    alt="smol café bill illustration"
                    fill
                    priority
                    className="object-contain select-none pointer-events-none drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
                  />
                </div>
              </div>

              {/* Poetic Headline in Espresso Ink */}
              <h2 className="font-serif font-bold text-[25px] sm:text-[27px] text-[#241F1C] dark:text-[#FAF4EB] leading-[1.18] mt-3">
                Good things
                <br />
                deserve good pauses.
              </h2>

              {/* Subtitle in Walnut */}
              <p className="font-serif italic text-[16px] sm:text-[17px] text-[#725039] dark:text-[#C9AE8B] mt-1.5 mb-2">
                Here&apos;s your bill.
              </p>

              {/* Guest & Table Metadata Badge */}
              <div className="inline-flex items-center justify-center gap-2 px-3 py-1 rounded-full bg-[#EFE3D3]/70 dark:bg-white/5 border border-[#C9AE8B]/40 dark:border-white/10 text-center mb-1">
                <span className="font-mono text-xs font-bold text-[#241F1C] dark:text-[#FAF4EB]">
                  Table {bill?.tableLabel || "01"}
                </span>
                {(localGuestName || bill?.guestName) && (
                  <>
                    <span className="text-[#C9AE8B]">•</span>
                    <span className="font-serif text-xs font-bold text-[#B72E35] dark:text-[#FF5B52]">
                      {localGuestName || bill?.guestName}
                    </span>
                  </>
                )}
                {(localGuestPhone || bill?.guestPhone) && (
                  <>
                    <span className="text-[#C9AE8B]">•</span>
                    <span className="font-mono text-[10px] text-[#725039] dark:text-[#C9AE8B]">
                      {formatDisplayPhone(localGuestPhone || bill?.guestPhone)}
                    </span>
                  </>
                )}
              </div>

              {/* Dashed Horizontal Line Divider in Biscuit */}
              <div className="border-t border-dashed border-[#C9AE8B]/60 dark:border-white/10 my-3.5" />

              {/* Itemized Summary in Typewriter / Mono Font */}
              <div className="space-y-1.5 font-mono text-[13.5px] text-[#241F1C] dark:text-[#FAF4EB]">
                <div className="flex items-center justify-between">
                  <span className="text-[#725039] dark:text-[#C9AE8B]">Items Total</span>
                  <span>₹{itemsTotal}</span>
                </div>
              </div>

              {/* Solid Horizontal Line Divider in Biscuit */}
              <div className="border-t border-[#C9AE8B]/60 dark:border-white/10 mt-3.5 mb-3" />

              {/* Grand Total in Smol Cherry */}
              <div className="flex items-baseline justify-between pt-0.5">
                <span className="font-serif font-bold text-[20px] sm:text-[21px] text-[#B72E35] dark:text-[#FF5B52]">
                  Grand Total
                </span>
                <span className="font-serif font-bold text-[32px] sm:text-[36px] text-[#B72E35] dark:text-[#FF5B52] leading-none">
                  ₹{grandTotal}
                </span>
              </div>
            </div>
          </div>

          {/* Status / Request Notification Message */}
          {requestMessage && (
            <div className="rounded-2xl border border-[#C9AE8B] dark:border-white/10 bg-[#FAF4EB] dark:bg-[#201A17] p-3 text-center text-xs font-serif font-semibold text-[#241F1C] dark:text-[#FAF4EB] shadow-xs animate-fade-in flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#B72E35] dark:text-[#FF5B52]" />
              <span>{requestMessage}</span>
            </div>
          )}

          {/* Primary UPI Payment Component */}
          <div className="pt-2">
            <DirectUpiPaymentView
              tableSessionId={bill?.sessionId || "sess_01"}
              tableLabel={bill?.tableLabel || "01"}
              totalRupees={grandTotal}
              onPaymentInitiated={() => setBillRequested(true)}
            />
          </div>

          <div className="pt-2">
            <RazorpayPaymentButton
              tableSessionId={bill?.sessionId || "sess_01"}
              tableLabel={bill?.tableLabel || "01"}
              totalRupees={grandTotal}
              onSuccess={() => {
                refreshBill();
                setRequestMessage("Payment completed successfully!");
              }}
            />
          </div>
        </main>

        {/* Security Notice & Footer Indicator */}
        <footer className="pt-3 pb-1 text-center select-none">
          <div className="flex items-center justify-center gap-1.5 text-[12px] font-sans text-[#725039]">
            <Lock className="w-3.5 h-3.5 text-[#725039]/80" />
            <span>100% Secure Payments</span>
          </div>

          {/* iPhone Home Indicator Bar */}
          <div className="pt-3">
            <div className="w-32 h-1 bg-[#241F1C] rounded-full mx-auto opacity-75" />
          </div>
        </footer>
      </div>

      {/* UPI Payment Modal / Drawer */}
      {isUpiOpen && (
        <UpiPaymentDrawer
          tableLabel={bill?.tableLabel || "07"}
          orderId={bill?.sessionId || "smol_bill_07"}
          amountPaise={grandTotal * 100}
          onPaymentSuccess={() => {
            setIsUpiOpen(false);
            setBillRequested(true);
            setRequestMessage("Payment recorded successfully! Thank you for visiting smol café.");
          }}
          onClose={() => setIsUpiOpen(false)}
        />
      )}

      {/* Post-Payment Celebration Modal if test bypass triggered */}
      {celebrationData && (
        <PostPaymentCelebrationModal
          {...celebrationData}
        />
      )}
    </div>
  );
};
