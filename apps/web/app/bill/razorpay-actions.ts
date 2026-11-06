"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createRazorpayOrder, verifyRazorpaySignature } from "@/lib/razorpay";
import { getTableSessionCookie } from "@/lib/session";

export interface CreateRazorpayOrderResult {
  success: boolean;
  keyId?: string;
  orderId?: string;
  amountPaise?: number;
  currency?: string;
  billId?: string;
  tableLabel?: string;
  error?: string;
  message?: string;
}

export interface VerifyPaymentInput {
  tableSessionId: string;
  billId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface VerifyPaymentResult {
  success: boolean;
  error?: string;
  message?: string;
}

/**
 * Server Action: Creates or retrieves a pending Razorpay order with strict idempotency
 */
export async function createRazorpayOrderAction(
  tableSessionId?: string
): Promise<CreateRazorpayOrderResult> {
  const session = await getTableSessionCookie();
  const targetSessionId = tableSessionId || session?.sessionId;

  if (!targetSessionId) {
    return { success: false, message: "No active dining session found." };
  }

  const supabase = createAdminClient();

  try {
    // 1. Verify Table Session is OPEN or PAYMENT_PENDING
    const { data: currentSession, error: sessionErr } = await supabase
      .from("table_sessions")
      .select("*")
      .eq("id", targetSessionId)
      .single();

    if (sessionErr || !currentSession) {
      return { success: false, message: "Dining session not found." };
    }

    if (currentSession.status === "CLOSED") {
      return { success: false, message: "This session is already settled and closed." };
    }

    // 2. Sum payable orders
    const { data: orders } = await supabase
      .from("orders")
      .select("total_snapshot, status")
      .eq("table_session_id", targetSessionId);

    const totalPaise = (orders || [])
      .filter((o) => o.status !== "CANCELLED" && o.status !== "REJECTED")
      .reduce((sum, o) => sum + (o.total_snapshot || 0), 0);

    if (totalPaise <= 0) {
      return { success: false, message: "No payable items found in your order." };
    }

    // 3. Ensure a bill record exists
    let billId = currentSession.bill_id;
    const nowIso = new Date().toISOString();

    if (!billId) {
      const { data: newBill, error: billErr } = await supabase
        .from("bills")
        .insert({
          table_session_id: targetSessionId,
          status: "DRAFT",
          subtotal: totalPaise,
          tax: 0,
          total: totalPaise,
          paid_amount: 0,
        })
        .select("id")
        .single();

      if (billErr || !newBill) {
        console.error("Failed to create bill row:", billErr);
        return { success: false, message: "Could not generate bill for checkout." };
      }

      billId = newBill.id;

      // Attach bill_id to table_sessions
      await supabase.from("table_sessions").update({ bill_id: billId }).eq("id", targetSessionId);
    } else {
      // Update bill totals
      await supabase
        .from("bills")
        .update({
          subtotal: totalPaise,
          total: totalPaise,
        })
        .eq("id", billId);
    }

    // 4. Idempotency Check: Look for active PENDING payment attempt created within last 15 mins
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { data: existingAttempts } = await supabase
      .from("payment_attempts")
      .select("*")
      .eq("bill_id", billId)
      .eq("status", "PENDING")
      .eq("amount", totalPaise)
      .gte("created_at", fifteenMinsAgo)
      .order("created_at", { ascending: false })
      .limit(1);

    const keyId =
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
      process.env.RAZORPAY_KEY_ID ||
      "rzp_test_placeholder";

    if (existingAttempts && existingAttempts.length > 0) {
      const existing = existingAttempts[0];
      return {
        success: true,
        keyId,
        orderId: existing.idempotency_key, // stores razorpay order id
        amountPaise: totalPaise,
        currency: "INR",
        billId,
        tableLabel: session?.tableLabel || "Table",
      };
    }

    // 5. Create new Razorpay order
    const idempotencyKey = `rzp_${billId}_${totalPaise}_${Date.now()}`;
    const rzpRes = await createRazorpayOrder({
      amountPaise: totalPaise,
      currency: "INR",
      receipt: idempotencyKey,
      notes: {
        table_session_id: targetSessionId,
        bill_id: billId,
      },
    });

    if (!rzpRes.success || !rzpRes.order) {
      return {
        success: false,
        message: "Failed to initialize payment gateway. Please ask staff for assistance.",
      };
    }

    const razorpayOrderId = rzpRes.order.id;

    // 6. Record payment_attempts row with status = PENDING
    await supabase.from("payment_attempts").insert({
      bill_id: billId,
      provider: "RAZORPAY",
      amount: totalPaise,
      currency: "INR",
      status: "PENDING",
      idempotency_key: razorpayOrderId,
      created_at: nowIso,
    });

    return {
      success: true,
      keyId,
      orderId: razorpayOrderId,
      amountPaise: totalPaise,
      currency: "INR",
      billId,
      tableLabel: session?.tableLabel || "Table",
    };
  } catch (err) {
    console.error("Error in createRazorpayOrderAction:", err);
    return { success: false, message: "An unexpected error occurred." };
  }
}

/**
 * Server Action: Cryptographically verifies Razorpay signature and completes settlement
 */
export async function verifyRazorpayPaymentAction(
  payload: VerifyPaymentInput
): Promise<VerifyPaymentResult> {
  if (
    !payload.razorpayOrderId ||
    !payload.razorpayPaymentId ||
    !payload.razorpaySignature ||
    !payload.billId
  ) {
    return {
      success: false,
      error: "MISSING_PAYLOAD",
      message: "Missing payment verification parameters.",
    };
  }

  // 1. Server-Side HMAC SHA-256 Signature Verification
  const isValidSignature = verifyRazorpaySignature({
    razorpayOrderId: payload.razorpayOrderId,
    razorpayPaymentId: payload.razorpayPaymentId,
    razorpaySignature: payload.razorpaySignature,
  });

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  if (!isValidSignature) {
    console.error(
      "ALERT: Razorpay signature verification failed for order:",
      payload.razorpayOrderId
    );
    // Mark attempt as failed
    await supabase
      .from("payment_attempts")
      .update({ status: "FAILED" })
      .eq("idempotency_key", payload.razorpayOrderId);

    return {
      success: false,
      error: "INVALID_SIGNATURE",
      message: "Payment authentication failed. Signature was tampered or invalid.",
    };
  }

  try {
    // 2. Fetch bill total
    const { data: bill } = await supabase
      .from("bills")
      .select("total")
      .eq("id", payload.billId)
      .single();

    const totalPaise = bill?.total || 0;

    // 3. Update payment_attempts to CAPTURED
    await supabase
      .from("payment_attempts")
      .update({
        status: "CAPTURED",
        captured_at: nowIso,
      })
      .eq("idempotency_key", payload.razorpayOrderId);

    // 4. Update bill to PAID
    await supabase
      .from("bills")
      .update({
        status: "PAID",
        paid_amount: totalPaise,
        closed_at: nowIso,
      })
      .eq("id", payload.billId);

    // 5. Keep Table Session OPEN until Cashier marks table available when empty
    await supabase
      .from("table_sessions")
      .update({
        status: "OPEN",
        last_activity_at: nowIso,
      })
      .eq("id", payload.tableSessionId);

    return {
      success: true,
      message: "Payment verified successfully! Thank you for dining with us.",
    };
  } catch (err) {
    console.error("Error finalizing payment settlement:", err);
    return {
      success: false,
      error: "DB_ERROR",
      message: "Payment was captured but session finalization encountered an error.",
    };
  }
}
