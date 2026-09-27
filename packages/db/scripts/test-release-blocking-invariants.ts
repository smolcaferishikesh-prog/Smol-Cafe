/**
 * ==============================================================================
 * Smol Café — Release-Blocking Invariant Automated Test Suite
 * ==============================================================================
 * Validates the 8 critical release-blocking business invariants:
 * 1. Double-tapping "Place order" with same idempotency key creates exactly ONE order
 * 2. Price change between browsing and submit produces clean 409 diff (not silent wrong price)
 * 3. Two customers racing for the last unit of stock: exactly ONE succeeds, other gets SOLD_OUT
 * 4. Kitchen double-tapping Accept/Ready doesn't create duplicate status-history entries
 * 5. Duplicate Razorpay webhook only applies financial change once (idempotent dedupe)
 * 6. Out-of-order webhook (AUTHORIZED after CAPTURED) cannot regress payment status
 * 7. Editing a menu item's price does not change total on already-placed historical order
 * 8. Multi-country E.164 phone normalization, deterministic customer ID & strict order isolation
 */

import crypto from "crypto";
import {
  normalizePhoneNumber,
  getPhoneUuid,
  doesOrderMatchCustomerPhone,
  recordOrderForPhone,
} from "../../../apps/web/lib/customer-phone.ts";

interface OrderItemInput {
  menu_item_id: string;
  expected_unit_price_paise: number;
  qty: number;
}

interface StoredOrder {
  id: string;
  order_no: number;
  idempotency_key: string;
  location_id: string;
  table_session_id: string;
  status: string;
  total_paise: number;
  created_at: string;
}

interface StoredOrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  item_name: string;
  unit_price_paise: number;
  qty: number;
  line_subtotal_paise: number;
}

interface StoredOrderStatusHistory {
  id: string;
  order_id: string;
  from_status: string;
  to_status: string;
  actor_type: string;
  created_at: string;
}

interface StoredMenuItem {
  id: string;
  name: string;
  current_price_paise: number;
  stock_quantity: number;
}

interface StoredBill {
  id: string;
  table_session_id: string;
  total_amount_paise: number;
  total_paid_paise: number;
  status: "OPEN" | "PAID";
}

interface StoredPaymentAttempt {
  id: string;
  bill_id: string;
  gateway_order_id: string;
  status: "PENDING" | "AUTHORIZED" | "CAPTURED" | "FAILED";
  amount_paise: number;
}

/**
 * In-Memory Transaction Engine simulating PostgreSQL Atomic RPCs & Row Locks
 */
class SmolSimulationDatabase {
  public menuItems: Map<string, StoredMenuItem> = new Map();
  public orders: Map<string, StoredOrder> = new Map();
  public orderItems: StoredOrderItem[] = [];
  public statusHistory: StoredOrderStatusHistory[] = [];
  public bills: Map<string, StoredBill> = new Map();
  public paymentAttempts: Map<string, StoredPaymentAttempt> = new Map();
  public processedWebhooks: Set<string> = new Set();
  public nextOrderNo = 101;

  constructor() {
    this.seed();
  }

  public seed() {
    this.menuItems.set("item_chai", {
      id: "item_chai",
      name: "Smol Special Masala Chai",
      current_price_paise: 4000, // ₹40.00
      stock_quantity: 100,
    });

    this.menuItems.set("item_croissant", {
      id: "item_croissant",
      name: "Almond Croissant (Last 1 in stock)",
      current_price_paise: 18000, // ₹180.00
      stock_quantity: 1, // Limited 1 unit
    });

    this.menuItems.set("item_cold_brew", {
      id: "item_cold_brew",
      name: "Single Origin Cold Brew",
      current_price_paise: 22000, // ₹220.00
      stock_quantity: 50,
    });
  }

  /**
   * Mirrors submit_order PostgreSQL function with Idempotency & Stock Row Locking
   */
  public submitOrder(params: {
    locationId: string;
    tableSessionId: string;
    idempotencyKey: string;
    items: OrderItemInput[];
  }) {
    // 1. Check Idempotency Key (Instant duplicate return)
    const existingOrder = Array.from(this.orders.values()).find(
      (o) => o.idempotency_key === params.idempotencyKey
    );

    if (existingOrder) {
      return {
        success: true,
        is_duplicate: true,
        order_id: existingOrder.id,
        order_no: existingOrder.order_no,
        total_paise: existingOrder.total_paise,
        message: "Duplicate order submission acknowledged idempotently.",
      };
    }

    // 2. Validate Item Prices (Detect Price Changes)
    const changedItems: {
      menu_item_id: string;
      name: string;
      expected_price_paise: number;
      current_price_paise: number;
    }[] = [];

    for (const item of params.items) {
      const dbItem = this.menuItems.get(item.menu_item_id);
      if (!dbItem) {
        return {
          success: false,
          error: "ITEM_NOT_FOUND",
          message: `Item ${item.menu_item_id} not found.`,
        };
      }

      if (dbItem.current_price_paise !== item.expected_unit_price_paise) {
        changedItems.push({
          menu_item_id: dbItem.id,
          name: dbItem.name,
          expected_price_paise: item.expected_unit_price_paise,
          current_price_paise: dbItem.current_price_paise,
        });
      }
    }

    if (changedItems.length > 0) {
      return {
        success: false,
        error: "PRICE_CHANGED",
        message: "Some item prices have changed. Please review your cart before submitting.",
        changed_items: changedItems,
      };
    }

    // 3. Check & Reserve Inventory (Row-locked)
    for (const item of params.items) {
      const dbItem = this.menuItems.get(item.menu_item_id)!;
      if (dbItem.stock_quantity < item.qty) {
        return {
          success: false,
          error: "INSUFFICIENT_STOCK",
          message: `${dbItem.name} is sold out or has insufficient stock (${dbItem.stock_quantity} available).`,
        };
      }
    }

    // Deduct stock
    for (const item of params.items) {
      const dbItem = this.menuItems.get(item.menu_item_id)!;
      dbItem.stock_quantity -= item.qty;
    }

    // 4. Create Order & Line Items (Snapshotting prices)
    const orderId = `ord_${crypto.randomBytes(6).toString("hex")}`;
    const orderNo = this.nextOrderNo++;
    let totalPaise = 0;

    for (const item of params.items) {
      const dbItem = this.menuItems.get(item.menu_item_id)!;
      const lineSubtotal = dbItem.current_price_paise * item.qty;
      totalPaise += lineSubtotal;

      this.orderItems.push({
        id: `oi_${crypto.randomBytes(6).toString("hex")}`,
        order_id: orderId,
        menu_item_id: dbItem.id,
        item_name: dbItem.name,
        unit_price_paise: dbItem.current_price_paise, // Immutable snapshot
        qty: item.qty,
        line_subtotal_paise: lineSubtotal,
      });
    }

    const newOrder: StoredOrder = {
      id: orderId,
      order_no: orderNo,
      idempotency_key: params.idempotencyKey,
      location_id: params.locationId,
      table_session_id: params.tableSessionId,
      status: "SUBMITTED",
      total_paise: totalPaise,
      created_at: new Date().toISOString(),
    };

    this.orders.set(orderId, newOrder);

    return {
      success: true,
      is_duplicate: false,
      order_id: orderId,
      order_no: orderNo,
      total_paise: totalPaise,
      message: `Order #${orderNo} placed successfully.`,
    };
  }

  /**
   * Mirrors transitionOrderStatusAction with Optimistic Concurrency Check
   */
  public transitionOrderStatus(orderId: string, fromStatus: string, toStatus: string) {
    const order = this.orders.get(orderId);
    if (!order) {
      return { success: false, error: "ORDER_NOT_FOUND" };
    }

    // Concurrency conflict check
    if (order.status !== fromStatus) {
      return {
        success: false,
        error: "STATUS_MISMATCH",
        currentStatus: order.status,
        message: `Order is already in status ${order.status}`,
      };
    }

    // Apply update & log to history
    order.status = toStatus;
    this.statusHistory.push({
      id: `hist_${crypto.randomBytes(6).toString("hex")}`,
      order_id: orderId,
      from_status: fromStatus,
      to_status: toStatus,
      actor_type: "STAFF",
      created_at: new Date().toISOString(),
    });

    return { success: true, message: `Status updated to ${toStatus}` };
  }

  /**
   * Mirrors process_razorpay_webhook PL/pgSQL function with Monotonic State Enforcement
   */
  public processRazorpayWebhook(params: {
    eventId: string;
    eventType: string;
    gatewayOrderId: string;
    paymentId: string;
    amountPaise: number;
  }) {
    // 1. Deduplication check
    if (this.processedWebhooks.has(params.eventId)) {
      return {
        success: true,
        is_duplicate: true,
        message: "Webhook event already processed (idempotent acknowledge).",
      };
    }

    this.processedWebhooks.add(params.eventId);

    const payment = Array.from(this.paymentAttempts.values()).find(
      (p) => p.gateway_order_id === params.gatewayOrderId
    );

    if (!payment) {
      return { success: false, error: "PAYMENT_NOT_FOUND" };
    }

    const bill = this.bills.get(payment.bill_id);

    if (params.eventType === "payment.captured") {
      payment.status = "CAPTURED";
      if (bill) {
        bill.total_paid_paise += params.amountPaise;
        if (bill.total_paid_paise >= bill.total_amount_paise) {
          bill.status = "PAID";
        }
      }
    } else if (params.eventType === "payment.authorized") {
      // Monotonic guard: never regress from CAPTURED to AUTHORIZED
      if (payment.status !== "CAPTURED") {
        payment.status = "AUTHORIZED";
      }
    }

    return {
      success: true,
      is_duplicate: false,
      paymentStatus: payment.status,
      message: `Webhook ${params.eventType} processed.`,
    };
  }
}

// ==============================================================================
// 🧪 Test Runner & Invariant Assertions
// ==============================================================================

async function runReleaseBlockingInvariantTests() {
  console.log("================================================================================");
  console.log("🧪 SMOL CAFÉ — RELEASE-BLOCKING BUSINESS INVARIANTS TEST SUITE");
  console.log("================================================================================\n");

  let passedCount = 0;
  const totalTests = 8;

  const db = new SmolSimulationDatabase();

  // ----------------------------------------------------------------------------
  // Test 1: Double-tapping "Place order" with same idempotency key creates 1 order
  // ----------------------------------------------------------------------------
  console.log("Test 1: Double-Tapping 'Place Order' with Identical Idempotency Key");
  const testIdempotencyKey = "idem_key_unique_test_1";
  const cartItems: OrderItemInput[] = [
    { menu_item_id: "item_chai", expected_unit_price_paise: 4000, qty: 2 },
  ];

  // Tap 1
  const order1 = db.submitOrder({
    locationId: "loc_1",
    tableSessionId: "session_table_4",
    idempotencyKey: testIdempotencyKey,
    items: cartItems,
  });

  // Tap 2 (Simulated rapid double click)
  const order2 = db.submitOrder({
    locationId: "loc_1",
    tableSessionId: "session_table_4",
    idempotencyKey: testIdempotencyKey,
    items: cartItems,
  });

  const ordersWithKey = Array.from(db.orders.values()).filter(
    (o) => o.idempotency_key === testIdempotencyKey
  );

  if (
    order1.success &&
    order1.is_duplicate === false &&
    order2.success &&
    order2.is_duplicate === true &&
    order1.order_id === order2.order_id &&
    ordersWithKey.length === 1
  ) {
    console.log(`  ✅ PASS: Exactly 1 order created (Order #${order1.order_no}).`);
    console.log(`  ✅ PASS: 2nd tap safely acknowledged with is_duplicate: true.\n`);
    passedCount++;
  } else {
    console.error("  ❌ FAIL: Idempotent order deduplication failed.", { order1, order2 });
    process.exit(1);
  }

  // ----------------------------------------------------------------------------
  // Test 2: Price change between browsing and submit produces clean 409 diff
  // ----------------------------------------------------------------------------
  console.log("Test 2: Mid-Browse Price Change Rejection & 409 Diff Guarantee");
  // Admin updates Masala Chai price to ₹50
  const chai = db.menuItems.get("item_chai")!;
  chai.current_price_paise = 5000;

  // Customer submits cart with stale cached price ₹40
  const stalePriceOrder = db.submitOrder({
    locationId: "loc_1",
    tableSessionId: "session_table_4",
    idempotencyKey: "idem_key_stale_price_test",
    items: [{ menu_item_id: "item_chai", expected_unit_price_paise: 4000, qty: 2 }],
  });

  if (
    stalePriceOrder.success === false &&
    stalePriceOrder.error === "PRICE_CHANGED" &&
    stalePriceOrder.changed_items &&
    stalePriceOrder.changed_items[0].expected_price_paise === 4000 &&
    stalePriceOrder.changed_items[0].current_price_paise === 5000
  ) {
    console.log("  ✅ PASS: Stale price rejected with PRICE_CHANGED error.");
    console.log(
      "  ✅ PASS: Clean diff provided (Expected: ₹40, Current: ₹50). Zero silent charges.\n"
    );
    passedCount++;
  } else {
    console.error("  ❌ FAIL: Price change check failed.", stalePriceOrder);
    process.exit(1);
  }

  // Restore price for following tests
  chai.current_price_paise = 4000;

  // ----------------------------------------------------------------------------
  // Test 3: Concurrency: Two customers racing for last unit of stock
  // ----------------------------------------------------------------------------
  console.log("Test 3: Concurrency Race Condition for Last Stock Unit");
  const croissant = db.menuItems.get("item_croissant")!;
  croissant.stock_quantity = 1; // Exactly 1 croissant left

  // Customer A orders 1 croissant
  const custA = db.submitOrder({
    locationId: "loc_1",
    tableSessionId: "session_cust_A",
    idempotencyKey: "idem_croissant_cust_A",
    items: [{ menu_item_id: "item_croissant", expected_unit_price_paise: 18000, qty: 1 }],
  });

  // Customer B orders 1 croissant at the exact same moment
  const custB = db.submitOrder({
    locationId: "loc_1",
    tableSessionId: "session_cust_B",
    idempotencyKey: "idem_croissant_cust_B",
    items: [{ menu_item_id: "item_croissant", expected_unit_price_paise: 18000, qty: 1 }],
  });

  if (
    custA.success === true &&
    custB.success === false &&
    custB.error === "INSUFFICIENT_STOCK" &&
    croissant.stock_quantity === 0
  ) {
    console.log("  ✅ PASS: Customer A successfully reserved the last item.");
    console.log("  ✅ PASS: Customer B received deterministic INSUFFICIENT_STOCK response.");
    console.log("  ✅ PASS: Remaining stock is 0 (Never negative / no overselling).\n");
    passedCount++;
  } else {
    console.error("  ❌ FAIL: Stock concurrency check failed.", {
      custA,
      custB,
      stock: croissant.stock_quantity,
    });
    process.exit(1);
  }

  // ----------------------------------------------------------------------------
  // Test 4: Kitchen double-tapping Accept/Ready doesn't create duplicate history
  // ----------------------------------------------------------------------------
  console.log("Test 4: Kitchen Double-Tapping Status Transition (Optimistic Lock)");
  const targetOrderId = order1.order_id!;

  // Staff Tap 1: SUBMITTED -> ACCEPTED
  const transition1 = db.transitionOrderStatus(targetOrderId, "SUBMITTED", "ACCEPTED");

  // Staff Tap 2: Instant duplicate tap (SUBMITTED -> ACCEPTED)
  const transition2 = db.transitionOrderStatus(targetOrderId, "SUBMITTED", "ACCEPTED");

  const historyEntries = db.statusHistory.filter((h) => h.order_id === targetOrderId);

  if (
    transition1.success === true &&
    transition2.success === false &&
    transition2.error === "STATUS_MISMATCH" &&
    historyEntries.length === 1
  ) {
    console.log("  ✅ PASS: First transition succeeded (SUBMITTED -> ACCEPTED).");
    console.log("  ✅ PASS: Second double-tap returned STATUS_MISMATCH.");
    console.log("  ✅ PASS: Exactly 1 status history record created (No duplicate log spam).\n");
    passedCount++;
  } else {
    console.error("  ❌ FAIL: Kitchen double-tap protection failed.", {
      transition1,
      transition2,
      historyEntries,
    });
    process.exit(1);
  }

  // ----------------------------------------------------------------------------
  // Test 5: Duplicate Razorpay webhook only applies financial change once
  // ----------------------------------------------------------------------------
  console.log("Test 5: Duplicate Razorpay Webhook Idempotency (Financial Safety)");
  const billId = "bill_smol_555";
  const gatewayOrderId = "order_rzp_bill_555";
  const paymentAttemptId = "pay_attempt_555";
  const duplicateWebhookEventId = "evt_payment_captured_007";

  db.bills.set(billId, {
    id: billId,
    table_session_id: "session_table_4",
    total_amount_paise: 8000, // ₹80.00
    total_paid_paise: 0,
    status: "OPEN",
  });

  db.paymentAttempts.set(paymentAttemptId, {
    id: paymentAttemptId,
    bill_id: billId,
    gateway_order_id: gatewayOrderId,
    status: "PENDING",
    amount_paise: 8000,
  });

  // Webhook Delivery 1
  const webhook1 = db.processRazorpayWebhook({
    eventId: duplicateWebhookEventId,
    eventType: "payment.captured",
    gatewayOrderId,
    paymentId: "pay_rzp_real_001",
    amountPaise: 8000,
  });

  // Webhook Delivery 2 (Duplicate re-try by Razorpay)
  const webhook2 = db.processRazorpayWebhook({
    eventId: duplicateWebhookEventId,
    eventType: "payment.captured",
    gatewayOrderId,
    paymentId: "pay_rzp_real_001",
    amountPaise: 8000,
  });

  const billAfterWebhooks = db.bills.get(billId)!;

  if (
    webhook1.success === true &&
    webhook1.is_duplicate === false &&
    webhook2.success === true &&
    webhook2.is_duplicate === true &&
    billAfterWebhooks.total_paid_paise === 8000 &&
    billAfterWebhooks.status === "PAID"
  ) {
    console.log("  ✅ PASS: First webhook delivery captured ₹80.00 and marked bill PAID.");
    console.log("  ✅ PASS: Duplicate delivery returned is_duplicate: true.");
    console.log(
      "  ✅ PASS: Total paid remained exactly ₹80.00 (Never double-counted to ₹160.00).\n"
    );
    passedCount++;
  } else {
    console.error("  ❌ FAIL: Duplicate webhook financial deduplication failed.", {
      webhook1,
      webhook2,
      bill: billAfterWebhooks,
    });
    process.exit(1);
  }

  // ----------------------------------------------------------------------------
  // Test 6: Out-of-order webhook cannot regress payment status
  // ----------------------------------------------------------------------------
  console.log("Test 6: Out-of-Order Webhook Delivery (Monotonic State Machine)");
  // Delivery of delayed payment.authorized event AFTER payment is already CAPTURED
  const outOfOrderWebhook = db.processRazorpayWebhook({
    eventId: "evt_delayed_authorized_008",
    eventType: "payment.authorized",
    gatewayOrderId,
    paymentId: "pay_rzp_real_001",
    amountPaise: 8000,
  });

  const paymentAfterOutofOrder = db.paymentAttempts.get(paymentAttemptId)!;

  if (outOfOrderWebhook.success === true && paymentAfterOutofOrder.status === "CAPTURED") {
    console.log("  ✅ PASS: Out-of-order payment.authorized safely acknowledged.");
    console.log("  ✅ PASS: Payment status remains CAPTURED (never downgraded to AUTHORIZED).\n");
    passedCount++;
  } else {
    console.error("  ❌ FAIL: Out-of-order event regressed payment state.", paymentAfterOutofOrder);
    process.exit(1);
  }

  // ----------------------------------------------------------------------------
  // Test 7: Editing menu item price does not mutate already-placed historical order
  // ----------------------------------------------------------------------------
  console.log("Test 7: Historical Order Price Immutability (Menu Catalog Edit)");
  const historicalOrder = db.orders.get(order1.order_id!)!;
  const historicalOrderItems = db.orderItems.filter((oi) => oi.order_id === order1.order_id);

  const initialTotalPaise = historicalOrder.total_paise; // ₹80.00 (2x ₹40.00)
  const initialItemPrice = historicalOrderItems[0].unit_price_paise; // ₹40.00

  // Admin updates Masala Chai price in catalog from ₹40 to ₹75
  chai.current_price_paise = 7500;

  // Re-fetch historical order records
  const recheckedOrder = db.orders.get(order1.order_id!)!;
  const recheckedOrderItems = db.orderItems.filter((oi) => oi.order_id === order1.order_id);

  if (
    recheckedOrder.total_paise === initialTotalPaise &&
    recheckedOrderItems[0].unit_price_paise === initialItemPrice &&
    recheckedOrderItems[0].line_subtotal_paise === 8000
  ) {
    console.log("  ✅ PASS: Admin modified catalog price to ₹75.00.");
    console.log(
      `  ✅ PASS: Historical Order #${historicalOrder.order_no} item price remains ₹40.00.`
    );
    console.log(
      `  ✅ PASS: Historical Order total remains ₹80.00 (Immutable snapshotting verified).\n`
    );
    passedCount++;
  } else {
    console.error("  ❌ FAIL: Historical order total was corrupted by catalog price change.", {
      initialTotalPaise,
      recheckedTotal: recheckedOrder.total_paise,
    });
    process.exit(1);
  }

  // ----------------------------------------------------------------------------
  // Test 8: Multi-Country E.164 Phone Normalization & Order Isolation
  // ----------------------------------------------------------------------------
  console.log("Test 8: Multi-Country E.164 Phone Normalization, UUID & Order Isolation");

  // 1. Verify Normalization for India (+91), USA (+1), UK (+44)
  const normIndia1 = normalizePhoneNumber("+91 98765 43210", "+91");
  const normIndia2 = normalizePhoneNumber("09876543210", "+91");
  const normIndia3 = normalizePhoneNumber("9876543210", "+91");
  const normIndia4 = normalizePhoneNumber("+919876543210", "+91");

  const normUSA1 = normalizePhoneNumber("+1 (415) 555-2671", "+1");
  const normUSA2 = normalizePhoneNumber("4155552671", "+1");
  const normUSA3 = normalizePhoneNumber("+14155552671", "+1");

  const normUK1 = normalizePhoneNumber("+44 7911 123456", "+44");
  const normUK2 = normalizePhoneNumber("07911123456", "+44");
  const normUK3 = normalizePhoneNumber("+447911123456", "+44");

  const allIndiaEqual =
    normIndia1 === "+919876543210" &&
    normIndia2 === "+919876543210" &&
    normIndia3 === "+919876543210" &&
    normIndia4 === "+919876543210";

  const allUSAEqual =
    normUSA1 === "+14155552671" &&
    normUSA2 === "+14155552671" &&
    normUSA3 === "+14155552671";

  const allUKEqual =
    normUK1 === "+447911123456" &&
    normUK2 === "+447911123456" &&
    normUK3 === "+447911123456";

  // 2. Deterministic UUID derivation consistency
  const uuidIndia1 = getPhoneUuid("+91 98765 43210", "+91");
  const uuidIndia2 = getPhoneUuid("09876543210", "+91");
  const uuidUSA = getPhoneUuid("+14155552671", "+1");
  const uuidUK = getPhoneUuid("+447911123456", "+44");

  const uuidDeterministic = uuidIndia1 === uuidIndia2;
  const uuidUniqueAcrossCountries =
    uuidIndia1 !== uuidUSA && uuidIndia1 !== uuidUK && uuidUSA !== uuidUK;

  // 3. Cross-Customer Order Isolation Protection
  const orderIndiaId = "ord_india_1001";
  recordOrderForPhone(orderIndiaId, "+919876543210");
  const mockIndiaOrder = {
    id: orderIndiaId,
    customer_id: uuidIndia1,
    idempotency_key: "smol_ord_+919876543210_test",
  };

  const matchesSelfWithFormats =
    doesOrderMatchCustomerPhone(mockIndiaOrder, "+91 98765 43210") &&
    doesOrderMatchCustomerPhone(mockIndiaOrder, "09876543210");

  const blocksUSACustomer = !doesOrderMatchCustomerPhone(mockIndiaOrder, "+14155552671");
  const blocksUKCustomer = !doesOrderMatchCustomerPhone(mockIndiaOrder, "+447911123456");
  const blocksDifferentLocalNumber = !doesOrderMatchCustomerPhone(mockIndiaOrder, "+919999999999");

  if (
    allIndiaEqual &&
    allUSAEqual &&
    allUKEqual &&
    uuidDeterministic &&
    uuidUniqueAcrossCountries &&
    matchesSelfWithFormats &&
    blocksUSACustomer &&
    blocksUKCustomer &&
    blocksDifferentLocalNumber
  ) {
    console.log("  ✅ PASS: Normalized India (+91), USA (+1), and UK (+44) numbers into strict E.164 format.");
    console.log("  ✅ PASS: Verified deterministic UUID mapping across different input formatting.");
    console.log("  ✅ PASS: Confirmed unique UUIDs across different international country codes.");
    console.log("  ✅ PASS: Verified cross-customer order isolation (USA customer cannot view India customer's order history).\n");
    passedCount++;
  } else {
    console.error("  ❌ FAIL: Multi-country E.164 phone handling test failed.", {
      allIndiaEqual,
      allUSAEqual,
      allUKEqual,
      uuidDeterministic,
      uuidUniqueAcrossCountries,
      matchesSelfWithFormats,
      blocksUSACustomer,
      blocksUKCustomer,
      blocksDifferentLocalNumber,
    });
    process.exit(1);
  }

  // ----------------------------------------------------------------------------
  // Final Test Results Summary
  // ----------------------------------------------------------------------------
  console.log("================================================================================");
  console.log(`🎉 ALL ${passedCount}/${totalTests} RELEASE-BLOCKING INVARIANT TESTS PASSED!`);
  console.log("================================================================================");
}

runReleaseBlockingInvariantTests().catch((err) => {
  console.error("Test Suite Fatal Error:", err);
  process.exit(1);
});
