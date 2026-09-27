"use client";

import React, { useState } from "react";
import {
  createRazorpayOrderAction,
  verifyRazorpayPaymentAction,
} from "@/app/bill/razorpay-actions";
import { Zap } from "lucide-react";

interface RazorpayPaymentButtonProps {
  tableSessionId: string;
  tableLabel: string;
  totalRupees: number;
  onSuccess: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

export const RazorpayPaymentButton: React.FC<RazorpayPaymentButtonProps> = ({
  tableSessionId,
  tableLabel,
  totalRupees,
  onSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayOnline = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 1. Create order on server
      const orderRes = await createRazorpayOrderAction(tableSessionId);

      if (!orderRes.success || !orderRes.orderId || !orderRes.billId) {
        setErrorMessage(orderRes.message || "Failed to initialize payment.");
        setIsLoading(false);
        return;
      }

      // 2. Load Razorpay Checkout Script
      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded || !window.Razorpay) {
        setErrorMessage("Payment gateway script failed to load. Please use Direct UPI QR or Pay at Counter.");
        setIsLoading(false);
        return;
      }

      // 3. Open Razorpay Checkout Modal
      const options = {
        key: orderRes.keyId,
        amount: orderRes.amountPaise,
        currency: orderRes.currency || "INR",
        name: "smol café",
        description: `Dining Settlement • Table ${tableLabel}`,
        order_id: orderRes.orderId,
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          setIsLoading(true);
          try {
            const verifyRes = await verifyRazorpayPaymentAction({
              tableSessionId,
              billId: orderRes.billId!,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });

            if (verifyRes.success) {
              onSuccess();
            } else {
              setErrorMessage(verifyRes.message || "Cryptographic verification failed.");
            }
          } catch {
            setErrorMessage("An unexpected error occurred during verification.");
          } finally {
            setIsLoading(false);
          }
        },
        prefill: {
          name: `Guest Table ${tableLabel}`,
        },
        theme: {
          color: "#9B2C2C",
        },
        modal: {
          ondismiss: function () {
            setIsLoading(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Razorpay checkout error:", err);
      setErrorMessage("Could not connect to payment gateway. Please try cash.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      {errorMessage && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-center text-xs font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {errorMessage}
        </p>
      )}

      <button
        onClick={handlePayOnline}
        disabled={isLoading || totalRupees <= 0}
        className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-[#9B2C2C] py-4 text-base font-bold text-white shadow-xl shadow-red-950/20 transition hover:bg-[#822424] active:scale-[0.98] disabled:opacity-50 dark:bg-[#C53030] dark:hover:bg-[#9B2C2C]"
      >
        {isLoading ? (
          <>
            <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            Connecting Gateway...
          </>
        ) : (
          <>
            <Zap className="h-4 w-4 fill-current" />
            Pay ₹{totalRupees} Online (UPI / Card)
            <span aria-hidden="true">→</span>
          </>
        )}
      </button>
    </div>
  );
};
