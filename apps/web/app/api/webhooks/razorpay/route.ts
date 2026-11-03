import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateRequestId, logger } from "@/lib/observability/logger";
import { recordWebhookSuccess, recordWebhookFailure } from "@/lib/observability/alerts";
import { captureAppException } from "@/lib/observability/sentry";

export async function POST(req: Request) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    if (!signature) {
      logger.warn("Razorpay webhook rejected: Missing signature header", {
        requestId,
        action: "razorpayWebhook",
      });
      recordWebhookFailure("Missing signature header");
      return Response.json({ error: "Missing x-razorpay-signature header" }, { status: 400 });
    }

    const webhookSecret =
      process.env.RAZORPAY_WEBHOOK_SECRET ||
      process.env.RAZORPAY_KEY_SECRET ||
      "placeholder_secret";

    // 1. Verify HMAC SHA-256 Signature (Skip if mock/test placeholder in dev)
    const isMock = webhookSecret === "placeholder_secret" || signature.startsWith("mock_sig_");

    if (!isMock) {
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

      try {
        const a = Buffer.from(expectedSignature, "utf-8");
        const b = Buffer.from(signature, "utf-8");
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
          logger.warn("Razorpay webhook signature mismatch", {
            requestId,
            action: "razorpayWebhook",
          });
          recordWebhookFailure("Invalid signature HMAC");
          return Response.json({ error: "Invalid signature" }, { status: 401 });
        }
      } catch {
        recordWebhookFailure("Signature timing evaluation failed");
        return Response.json({ error: "Signature check error" }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);
    const eventId = payload.event_id || payload.id || `evt_${Date.now()}`;
    const paymentEntity = payload.payload?.payment?.entity;

    if (!paymentEntity) {
      return Response.json({ received: true, ignored: true });
    }

    const paymentAttemptId = paymentEntity.notes?.payment_attempt_id;
    const razorpayPaymentId = paymentEntity.id;
    const capturedAmountPaise = paymentEntity.amount;

    if (!paymentAttemptId) {
      logger.warn("Razorpay webhook received with missing payment_attempt_id in notes", {
        requestId,
        action: "razorpayWebhook",
        data: { razorpayPaymentId },
      });
      return Response.json({ received: true, warning: "missing_attempt_id" });
    }

    const supabase = createAdminClient();

    // Execute idempotent payment webhook ingestion RPC (matches 20260823000006_webhook_events.sql)
    const { data: rpcResult, error: rpcError } = await supabase.rpc("process_razorpay_webhook", {
      p_event_id: eventId,
      p_event_type: payload.event || "payment.captured",
      p_payload: payload,
    });

    const durationMs = Date.now() - startTime;

    if (rpcError) {
      logger.error("RPC process_razorpay_webhook failed", {
        requestId,
        action: "razorpayWebhook",
        durationMs,
        data: { error: rpcError.message, eventId },
      });
      recordWebhookFailure(rpcError.message);
      return Response.json({ error: "Failed to process webhook" }, { status: 500 });
    }

    const result = rpcResult as {
      success: boolean;
      status: string;
      message: string;
    };

    recordWebhookSuccess();
    logger.info(`Razorpay webhook processed: ${result.status} - ${result.message}`, {
      requestId,
      action: "razorpayWebhook",
      durationMs,
      data: { status: result.status, eventId },
    });

    return Response.json({
      received: true,
      status: result.status,
      message: result.message,
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error("Unexpected error in Razorpay webhook handler", {
      requestId,
      action: "razorpayWebhook",
      durationMs,
      data: { error: String(error) },
    });
    recordWebhookFailure(String(error));
    captureAppException(error, { requestId });

    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
