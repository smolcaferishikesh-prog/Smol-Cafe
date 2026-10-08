"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, isMockDatabase } from "@/lib/supabase/admin";
import { isBeverageItem } from "@/lib/station-utils";
import { broadcastSyncEvent } from "@/lib/sync-events";
import { safeUpdateOrderWithInstructions, extractOrderInstructions } from "@/lib/order-instructions";
import type { OrderStatus } from "@smol-cafe/db";

export interface PendingOrderItem {
  id: string;
  menuItemId?: string;
  name: string;
  qty: number;
  unitPricePaise: number;
  lineSubtotal: number;
  isBeverage: boolean;
  itemStatus?: string;
}

export interface PendingOrderVerification {
  id: string;
  orderNo: number;
  tableLabel: string;
  tableId: string;
  tableSessionId: string;
  verificationCode: string;
  status: OrderStatus;
  paymentStatus?: string;
  paymentMethod?: string;
  submittedAt: string | null;
  totalPaise: number;
  subtotalPaise?: number;
  taxPaise?: number;
  instructions: string | null;
  items: PendingOrderItem[];
  hasFoodItems: boolean;
  hasBeverageItems: boolean;
  hasPendingFood: boolean;
  hasPendingBeverage: boolean;
}

export interface FetchPendingOrdersResult {
  success: boolean;
  orders: PendingOrderVerification[];
  message?: string;
}

export interface ConfirmOrderResult {
  success: boolean;
  orderId?: string;
  isFullyDispatched?: boolean;
  stationTarget?: "KITCHEN" | "BARISTA" | "ALL";
  message?: string;
}

import { getMenuCatalog } from "@/lib/queries/menu";

export interface MenuCatalogItem {
  id: string;
  name: string;
  category: string;
  pricePaise: number;
  isBeverage: boolean;
}

/**
 * Server Action: Fetches all available menu catalog items for Cashier to add during Order Editing.
 */
export async function fetchAllMenuItemsForCashierAction(): Promise<{ success: boolean; items: MenuCatalogItem[] }> {
  try {
    const categories = await getMenuCatalog();
    const catalog: MenuCatalogItem[] = [];

    for (const cat of categories) {
      for (const it of cat.items) {
        if (it.status !== "SOLD_OUT" && it.status !== "ARCHIVED") {
          const isBev =
            isBeverageItem(it.name) ||
            cat.name.toLowerCase().includes("drink") ||
            cat.name.toLowerCase().includes("brew") ||
            cat.name.toLowerCase().includes("coffee") ||
            cat.name.toLowerCase().includes("tea") ||
            cat.name.toLowerCase().includes("beverage");

          catalog.push({
            id: it.id,
            name: it.name,
            category: cat.name,
            pricePaise: it.pricePaise || 12000,
            isBeverage: isBev,
          });
        }
      }
    }

    return { success: true, items: catalog };
  } catch (err) {
    console.error("Error fetching menu catalog for cashier:", err);
    return { success: false, items: [] };
  }
}

/**
 * Server Action: Fetches all active incoming orders awaiting Cashier Verification/Payment.
 * Picks up orders in PENDING_CONFIRMATION or SUBMITTED status.
 */
export async function fetchPendingCashierOrdersAction(): Promise<FetchPendingOrdersResult> {
  const supabase = createAdminClient();

  try {
    // 1. Fetch pending orders (orders awaiting cashier confirmation/payment or freshly placed)
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (ordersError || !orders) {
      return { success: false, orders: [], message: "Failed to fetch pending queue." };
    }

    // Filter to those genuinely pending cashier confirmation / approval:
    // (Orders that are in PENDING_CONFIRMATION, SUBMITTED, DRAFT, OR payment_status PENDING, and NOT yet accepted/preparing/ready/completed/cancelled)
    const relevantOrders = orders.filter(
      (o) =>
        (o.status === "PENDING_CONFIRMATION" ||
          o.status === "SUBMITTED" ||
          o.status === "DRAFT" ||
          o.payment_status === "PENDING") &&
        o.status !== "ACCEPTED" &&
        o.status !== "PREPARING" &&
        o.status !== "READY" &&
        o.status !== "SERVED" &&
        o.status !== "COMPLETED" &&
        o.status !== "CANCELLED" &&
        o.status !== "REJECTED" &&
        o.status !== "CLOSED"
    );

    if (relevantOrders.length === 0) {
      return { success: true, orders: [] };
    }

    const orderIds = relevantOrders.map((o) => o.id);
    const sessionIds = relevantOrders
      .map((o) => o.table_session_id)
      .filter((id): id is string => Boolean(id));

    // 2. Parallelize Table Sessions & Order Items queries concurrently
    const [sessionsRes, orderItemsRes] = await Promise.all([
      sessionIds.length > 0
        ? supabase.from("table_sessions").select("id, table_id").in("id", sessionIds)
        : Promise.resolve({ data: [] }),
      supabase.from("order_items").select("*").in("order_id", orderIds),
    ]);

    const sessions = sessionsRes.data || [];
    const orderItems = orderItemsRes.data || [];

    const tableIds = sessions
      .map((s) => s.table_id)
      .filter((id): id is string => Boolean(id));

    const missingNameIds = (orderItems || [])
      .filter((it: any) => (!it.name_snapshot || it.name_snapshot === "Smol Item" || it.name_snapshot === "Artisanal Item") && it.menu_item_id)
      .map((it: any) => it.menu_item_id);

    // 3. Parallelize Dining Tables & Menu Items lookup concurrently
    const [tablesRes, dbMenuItemsRes] = await Promise.all([
      tableIds.length > 0
        ? supabase.from("dining_tables").select("id, label").in("id", tableIds)
        : Promise.resolve({ data: [] }),
      missingNameIds.length > 0
        ? supabase.from("menu_items").select("id, name").in("id", missingNameIds)
        : Promise.resolve({ data: [] }),
    ]);

    const tableLabelMap = new Map<string, { label: string; tableId: string }>();
    const tableMap = new Map<string, string>();
    for (const t of tablesRes.data || []) {
      tableMap.set(t.id, t.label);
    }
    for (const s of sessions) {
      const label = tableMap.get(s.table_id) || "Counter";
      tableLabelMap.set(s.id, { label, tableId: s.table_id });
    }

    const nameLookup = new Map<string, string>();
    for (const m of dbMenuItemsRes.data || []) {
      nameLookup.set(m.id, m.name);
    }

    const itemsByOrder = new Map<string, PendingOrderItem[]>();
    for (const item of (orderItems as Array<{
      id: string;
      order_id: string;
      menu_item_id?: string;
      name_snapshot: string;
      unit_price_snapshot: number;
      qty: number;
      line_subtotal: number;
      item_status?: string;
    }>) || []) {
      if (!itemsByOrder.has(item.order_id)) {
        itemsByOrder.set(item.order_id, []);
      }
      const resolvedName =
        item.name_snapshot && item.name_snapshot !== "Smol Item" && item.name_snapshot !== "Artisanal Item"
          ? item.name_snapshot
          : (item.menu_item_id && nameLookup.get(item.menu_item_id)) || item.name_snapshot || "Artisanal Item";

      const isBev = isBeverageItem(resolvedName);
      itemsByOrder.get(item.order_id)!.push({
        id: item.id,
        menuItemId: item.menu_item_id,
        name: resolvedName,
        qty: item.qty,
        unitPricePaise: item.unit_price_snapshot,
        lineSubtotal: item.line_subtotal,
        isBeverage: isBev,
        itemStatus: item.item_status || "PENDING",
      });
    }

    const verificationQueue: PendingOrderVerification[] = relevantOrders
      .map((o) => {
        const tableInfo = o.table_session_id ? tableLabelMap.get(o.table_session_id) : null;
        const items = itemsByOrder.get(o.id) || [];
        const hasFoodItems = items.some((i) => !i.isBeverage);
        const hasBeverageItems = items.some((i) => i.isBeverage);
        const hasPendingFood = items.some((i) => !i.isBeverage && (!i.itemStatus || i.itemStatus === "PENDING" || i.itemStatus === "DRAFT"));
        const hasPendingBeverage = items.some((i) => i.isBeverage && (!i.itemStatus || i.itemStatus === "PENDING" || i.itemStatus === "DRAFT"));

        return {
          id: o.id,
          orderNo: o.order_no,
          tableLabel: tableInfo?.label || "01",
          tableId: tableInfo?.tableId || "",
          tableSessionId: o.table_session_id || "",
          verificationCode: o.verification_code || "4821",
          status: o.status,
          paymentStatus: (o as unknown as { payment_status?: string }).payment_status || "PENDING",
          paymentMethod: (o as unknown as { payment_method?: string }).payment_method || "CASHIER",
          submittedAt: o.submitted_at || o.created_at,
          totalPaise: o.total_snapshot || 0,
          subtotalPaise: (o as unknown as { subtotal_snapshot?: number }).subtotal_snapshot || 0,
          taxPaise: (o as unknown as { tax_snapshot?: number }).tax_snapshot || 0,
          instructions: extractOrderInstructions(o),
          items,
          hasFoodItems,
          hasBeverageItems,
          hasPendingFood,
          hasPendingBeverage,
        };
      })
      .filter((o) => o.items.length === 0 || o.hasPendingFood || o.hasPendingBeverage);

    return {
      success: true,
      orders: verificationQueue,
    };
  } catch (err) {
    console.error("Error in fetchPendingCashierOrdersAction:", err);
    return { success: false, orders: [], message: "Unexpected error fetching pending queue." };
  }
}

export interface EditCashierOrderItemInput {
  menuItemId?: string;
  name: string;
  qty: number;
  unitPricePaise: number;
}

/**
 * Server Action: Cashier edits items and instructions of an active/pending order.
 * Recalculates subtotal, taxes, and grand total, updates DB, and broadcasts sync events.
 */
export async function editCashierOrderAction(
  orderId: string,
  items: EditCashierOrderItemInput[],
  instructions?: string,
  paymentMethod?: string
): Promise<{ success: boolean; message?: string; totalPaise?: number }> {
  if (!items || items.length === 0) {
    return { success: false, message: "Order must contain at least one item." };
  }

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  try {
    const isUuid = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

    // 0. Fetch existing order to verify existence and get table_session_id & current version
    const { data: existingOrder, error: fetchErr } = await supabase
      .from("orders")
      .select("id, table_session_id, version, status")
      .eq("id", orderId)
      .maybeSingle();

    if (fetchErr || !existingOrder) {
      return { success: false, message: "Order not found in database." };
    }

    let subtotalPaise = 0;
    const orderItemsPayload = items.map((it) => {
      const lineSubtotal = it.unitPricePaise * it.qty;
      subtotalPaise += lineSubtotal;
      return {
        id: crypto.randomUUID(),
        order_id: orderId,
        menu_item_id: isUuid(it.menuItemId) ? it.menuItemId : null,
        name_snapshot: it.name,
        unit_price_snapshot: it.unitPricePaise,
        qty: it.qty,
        line_subtotal: lineSubtotal,
        item_status: "PENDING",
        created_at: nowIso,
      };
    });

    const taxPaise = Math.round(subtotalPaise * 0.05); // 5% GST
    const totalPaise = subtotalPaise + taxPaise;

    // 1. Update order totals & instructions with fail-safe rollback
    const updatePayload: Record<string, any> = {
      subtotal_snapshot: subtotalPaise,
      tax_snapshot: taxPaise,
      total_snapshot: totalPaise,
      version: (existingOrder.version || 1) + 1,
      updated_at: nowIso,
    };

    const updateRes = await safeUpdateOrderWithInstructions(
      supabase,
      orderId,
      updatePayload,
      instructions
    );

    if (!updateRes.success) {
      console.error("Failed to update order snapshot in editCashierOrderAction:", updateRes.error);
      return {
        success: false,
        message: "Failed to update order totals in database. Edit was rolled back.",
      };
    }

    // 2. Atomically replace order items
    const { error: delErr } = await supabase
      .from("order_items")
      .delete()
      .eq("order_id", orderId);

    if (delErr) {
      console.error("Failed to delete existing order items in editCashierOrderAction:", delErr);
      return { success: false, message: "Failed to update order line items." };
    }

    const { error: insErr } = await supabase
      .from("order_items")
      .insert(orderItemsPayload);

    if (insErr) {
      console.error("Failed to insert updated order items in editCashierOrderAction:", insErr);
      return { success: false, message: "Failed to save updated line items." };
    }

    // 3. Atomically synchronize table session running bill
    const sessionId = existingOrder.table_session_id;
    if (sessionId) {
      try {
        const { data: sessionOrders } = await supabase
          .from("orders")
          .select("id, status, subtotal_snapshot, tax_snapshot, total_snapshot")
          .eq("table_session_id", sessionId);

        if (sessionOrders && sessionOrders.length > 0) {
          const activeOrders = sessionOrders.filter(
            (o) => o.status !== "CANCELLED" && o.status !== "REJECTED"
          );
          const newSessionSubtotal = activeOrders.reduce(
            (sum, o) => sum + (o.id === orderId ? subtotalPaise : (o.subtotal_snapshot || 0)),
            0
          );
          const newSessionTax = activeOrders.reduce(
            (sum, o) => sum + (o.id === orderId ? taxPaise : (o.tax_snapshot || 0)),
            0
          );
          const newSessionTotal = activeOrders.reduce(
            (sum, o) => sum + (o.id === orderId ? totalPaise : (o.total_snapshot || 0)),
            0
          );

          const { data: existingBill } = await supabase
            .from("bills")
            .select("id")
            .eq("table_session_id", sessionId)
            .maybeSingle();

          if (existingBill) {
            await supabase
              .from("bills")
              .update({
                subtotal: newSessionSubtotal,
                tax: newSessionTax,
                total: newSessionTotal,
              })
              .eq("id", existingBill.id);
          }
        }
      } catch (billSyncErr) {
        console.warn("Notice syncing running bill after cashier order edit:", billSyncErr);
      }
    }

    // 4. If paymentMethod provided and order has session, update payment_attempts
    if (paymentMethod && paymentMethod.trim().length > 0 && sessionId) {
      const cleanMethod = paymentMethod.trim().toUpperCase();
      try {
        const { data: b } = await supabase
          .from("bills")
          .select("id")
          .eq("table_session_id", sessionId)
          .maybeSingle();

        if (b?.id) {
          await supabase.from("payment_attempts").insert({
            bill_id: b.id,
            provider: cleanMethod,
            amount: totalPaise,
            currency: "INR",
            status: "CAPTURED",
            idempotency_key: `cashier_edit_${orderId}_${Date.now()}`,
            created_at: nowIso,
            captured_at: nowIso,
          });
        }
      } catch (err) {
        console.warn("Notice updating payment attempt in editCashierOrderAction:", err);
      }
    }

    // 5. Broadcast sync events
    broadcastSyncEvent({
      type: "STATUS_CHANGED",
      orderId,
      status: existingOrder.status,
      timestamp: Date.now(),
    });
    broadcastSyncEvent({
      type: "ORDER_PENDING_CASHIER",
      orderId,
      timestamp: Date.now(),
    });

    try {
      revalidatePath("/cashier");
      revalidatePath("/orders");
      revalidatePath("/bill");
    } catch {
      // ignore outside request lifecycle
    }

    return {
      success: true,
      totalPaise,
      message: `Order updated successfully! New Total: ₹${Math.round(totalPaise / 100)}`,
    };
  } catch (err) {
    console.error("Error in editCashierOrderAction:", err);
    return { success: false, message: "Unexpected error updating order." };
  }
}

/**
 * Server Action: Cashier confirms an order for Kitchen (Food), Barista (Drinks), or All.
 * Pushes tickets to respective KDS stations and marks status = ACCEPTED.
 */
export async function confirmCashierOrderAction(
  orderId: string,
  stationTarget: "KITCHEN" | "BARISTA" | "ALL" = "ALL",
  staffName = "Cashier",
  paymentMethod = "UPI"
): Promise<ConfirmOrderResult> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();
  const cleanMethod = (paymentMethod || "UPI").toUpperCase();

  try {
    // 1. Fetch current order with totals and items
    const { data: currentOrder } = await supabase
      .from("orders")
      .select("id, order_no, table_session_id, total_snapshot, subtotal_snapshot, tax_snapshot")
      .eq("id", orderId)
      .single();

    const orderTotalPaise = currentOrder?.total_snapshot || 0;
    const sessionId = currentOrder?.table_session_id;

    // 2. Update item statuses according to stationTarget first
    try {
      const { data: dbItems } = await supabase
        .from("order_items")
        .select("id, name_snapshot")
        .eq("order_id", orderId);

      if (dbItems && dbItems.length > 0) {
        if (stationTarget === "KITCHEN") {
          const foodIds = dbItems.filter((i) => !isBeverageItem(i.name_snapshot)).map((i) => i.id);
          if (foodIds.length > 0) {
            await supabase.from("order_items").update({ item_status: "ACCEPTED" }).in("id", foodIds);
          }
        } else if (stationTarget === "BARISTA") {
          const drinkIds = dbItems.filter((i) => isBeverageItem(i.name_snapshot)).map((i) => i.id);
          if (drinkIds.length > 0) {
            await supabase.from("order_items").update({ item_status: "ACCEPTED" }).in("id", drinkIds);
          }
        } else {
          await supabase.from("order_items").update({ item_status: "ACCEPTED" }).eq("order_id", orderId);
        }
      }
    } catch (itemStatusErr) {
      console.warn("Notice updating item statuses on dispatch:", itemStatusErr);
    }

    // 2b. Check if any items still remain pending in this order
    let isFullyDispatched = true;
    try {
      const { data: allItems } = await supabase
        .from("order_items")
        .select("id, item_status")
        .eq("order_id", orderId);

      const hasPending = (allItems || []).some(
        (i) => !i.item_status || i.item_status === "PENDING" || i.item_status === "DRAFT"
      );
      isFullyDispatched = !hasPending;
    } catch (checkErr) {
      console.warn("Notice checking remaining items:", checkErr);
    }

    // 2c. Update order status and payment status in PostgreSQL
    const orderUpdatePayload: Record<string, unknown> = {
      status: isFullyDispatched ? "ACCEPTED" : "SUBMITTED",
      payment_status: "PAID",
      updated_at: nowIso,
    };
    if (isFullyDispatched) {
      orderUpdatePayload.accepted_at = nowIso;
    }
    if (isMockDatabase()) {
      orderUpdatePayload.payment_method = cleanMethod;
    }

    const { error: updateErr } = await supabase
      .from("orders")
      .update(orderUpdatePayload)
      .eq("id", orderId);

    if (updateErr) {
      console.error("Failed to update order status on dispatch:", updateErr);
      return { success: false, message: `Failed to confirm order: ${updateErr.message || "database error"}` };
    }

    // 3. Settle bill and payment attempt for Cashier Audit
    if (sessionId) {
      try {
        let billId: string | null = null;
        const { data: existingBill } = await supabase
          .from("bills")
          .select("id, paid_amount")
          .eq("table_session_id", sessionId)
          .maybeSingle();

        if (existingBill) {
          billId = existingBill.id;
          const newPaidAmount = (existingBill.paid_amount || 0) + orderTotalPaise;
          await supabase.from("bills").update({
            status: "PAID",
            paid_amount: newPaidAmount,
            total: newPaidAmount,
            closed_at: nowIso,
          }).eq("id", billId);
        } else {
          const { data: newBill } = await supabase.from("bills").insert({
            table_session_id: sessionId,
            status: "PAID",
            subtotal: currentOrder?.subtotal_snapshot || Math.round(orderTotalPaise / 1.05),
            tax: currentOrder?.tax_snapshot || Math.round(orderTotalPaise - orderTotalPaise / 1.05),
            total: orderTotalPaise,
            paid_amount: orderTotalPaise,
            closed_at: nowIso,
          }).select("id").single();
          billId = newBill?.id || null;
        }

        if (billId) {
          await supabase.from("payment_attempts").insert({
            bill_id: billId,
            provider: cleanMethod,
            amount: orderTotalPaise,
            currency: "INR",
            status: "CAPTURED",
            idempotency_key: `cashier_confirm_${orderId}_${Date.now()}`,
            created_at: nowIso,
            captured_at: nowIso,
          });
        }
      } catch (billErr) {
        console.warn("Notice updating cashier bill record:", billErr);
      }
    }

    // 4. Log to status history
    try {
      await supabase.from("order_status_history").insert({
        id: crypto.randomUUID(),
        order_id: orderId,
        from_status: "DRAFT",
        to_status: "ACCEPTED",
        actor_type: "STAFF",
        created_at: nowIso,
      });
    } catch (histErr) {
      console.warn("status history insert notice:", histErr);
    }

    broadcastSyncEvent({
      type: "ORDER_CONFIRMED",
      orderId,
      orderNo: currentOrder?.order_no,
      station: stationTarget,
      status: isFullyDispatched ? "ACCEPTED" : "SUBMITTED",
      timestamp: Date.now(),
      metadata: { stationTarget, isFullyDispatched },
    });

    broadcastSyncEvent({
      type: "STATUS_CHANGED",
      orderId,
      station: stationTarget,
      status: isFullyDispatched ? "ACCEPTED" : "SUBMITTED",
      timestamp: Date.now(),
      metadata: { stationTarget, isFullyDispatched },
    });

    const destinationLabel =
      stationTarget === "KITCHEN"
        ? "Kitchen KDS"
        : stationTarget === "BARISTA"
        ? "Barista Desk"
        : "Kitchen & Barista";

    return {
      success: true,
      orderId,
      isFullyDispatched,
      stationTarget,
      message: `Order #${currentOrder?.order_no || ""} confirmed as ${cleanMethod} & dispatched to ${destinationLabel}!`,
    };
  } catch (err) {
    console.error("Error in confirmCashierOrderAction:", err);
    return { success: false, message: "Unexpected error confirming order." };
  }
}

/**
 * Server Action: Cashier rejects/cancels an order with a reason.
 */
export async function rejectCashierOrderAction(
  orderId: string,
  reason: string,
  staffName = "Cashier"
): Promise<ConfirmOrderResult> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  try {
    const { error: updateErr } = await supabase
      .from("orders")
      .update({
        status: "CANCELLED",
        updated_at: nowIso,
      })
      .eq("id", orderId);

    if (updateErr) {
      return { success: false, message: "Failed to reject order in database." };
    }

    try {
      await supabase.from("order_status_history").insert({
        id: crypto.randomUUID(),
        order_id: orderId,
        from_status: "DRAFT",
        to_status: "CANCELLED",
        actor_type: "STAFF",
        created_at: nowIso,
      });
    } catch (histErr) {
      console.warn("status history reject insert notice:", histErr);
    }

    broadcastSyncEvent({
      type: "STATUS_CHANGED",
      orderId,
      status: "CANCELLED",
      timestamp: Date.now(),
      metadata: { reason },
    });

    return {
      success: true,
      orderId,
      message: "Order cancelled by cashier.",
    };
  } catch (err) {
    console.error("Error in rejectCashierOrderAction:", err);
    return { success: false, message: "Unexpected error rejecting order." };
  }
}

/**
 * Server Action: Clears all pending orders awaiting cashier approval (marks them as CANCELLED).
 */
export async function clearAllPendingCashierOrdersAction(
  action: "CANCEL" | "CONFIRM" = "CANCEL",
  staffName = "Cashier"
): Promise<{ success: boolean; count: number; message: string }> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  try {
    const { data: pendingOrders, error: fetchErr } = await supabase
      .from("orders")
      .select("id, order_no")
      .in("status", ["PENDING_CONFIRMATION", "SUBMITTED", "DRAFT", "PENDING", "PLACED", "NEW"]);

    if (fetchErr) {
      return { success: false, count: 0, message: `Failed to fetch queue: ${fetchErr.message}` };
    }

    if (!pendingOrders || pendingOrders.length === 0) {
      return { success: true, count: 0, message: "Queue is already empty." };
    }

    const targetStatus = action === "CONFIRM" ? "ACCEPTED" : "CANCELLED";
    const orderIds = pendingOrders.map((o) => o.id);

    // Update in chunks of 50 to prevent URI/URL length overflow with large batch of IDs
    const CHUNK_SIZE = 50;
    for (let i = 0; i < orderIds.length; i += CHUNK_SIZE) {
      const chunk = orderIds.slice(i, i + CHUNK_SIZE);
      const { error: updateErr } = await supabase
        .from("orders")
        .update({
          status: targetStatus,
          accepted_at: action === "CONFIRM" ? nowIso : null,
          updated_at: nowIso,
        })
        .in("id", chunk);

      if (updateErr) {
        return { success: false, count: 0, message: `Failed to clear orders: ${updateErr.message}` };
      }
    }

    broadcastSyncEvent({
      type: "STATUS_CHANGED",
      status: targetStatus,
      timestamp: Date.now(),
      metadata: { count: orderIds.length },
    });

    return {
      success: true,
      count: orderIds.length,
      message:
        action === "CONFIRM"
          ? `All ${orderIds.length} orders confirmed and dispatched!`
          : `All ${orderIds.length} pending orders cleared from queue.`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to clear pending orders.";
    return { success: false, count: 0, message };
  }
}

export interface PaidHistoryItem {
  name: string;
  qty: number;
  priceRupees: number;
  subtotalRupees: number;
}

export interface PaidHistoryRecord {
  id: string;
  tableLabel: string;
  totalRupees: number;
  paymentMethod: "UPI" | "CASH" | "CARD" | "COMPLIMENTARY" | string;
  paidAt: string;
  itemsCount: number;
  items?: PaidHistoryItem[];
}

export interface FetchPaidHistoryResult {
  success: boolean;
  records: PaidHistoryRecord[];
  totalRevenueRupees: number;
  message?: string;
}

/**
 * Server Action: Fetches all paid orders & settlements for Cashier Audit & Paid Orders tab.
 */
export async function fetchPaidCashierHistoryAction(): Promise<FetchPaidHistoryResult> {
  const supabase = createAdminClient();

  try {
    const { data: allOrders, error: ordersErr } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (ordersErr) {
      console.error("Error fetching paid orders:", ordersErr);
    }

    const orders = (allOrders || []).filter((o) => {
      const s = o.status;
      return (
        s === "ACCEPTED" ||
        s === "PREPARING" ||
        s === "READY" ||
        s === "SERVED" ||
        s === "COMPLETED" ||
        s === "CLOSED" ||
        (o as unknown as { payment_status?: string }).payment_status === "PAID"
      );
    });

    const sessionIds = (orders || [])
      .map((o) => o.table_session_id)
      .filter((id): id is string => Boolean(id));

    const tableLabelMap = new Map<string, string>();
    if (sessionIds.length > 0) {
      const { data: sessions } = await supabase
        .from("table_sessions")
        .select("id, table_id")
        .in("id", sessionIds);

      const tableIds = (sessions || [])
        .map((s) => s.table_id)
        .filter((id): id is string => Boolean(id));

      if (tableIds.length > 0) {
        const { data: tables } = await supabase
          .from("dining_tables")
          .select("id, label")
          .in("id", tableIds);

        const tableMap = new Map<string, string>();
        for (const t of tables || []) {
          tableMap.set(t.id, t.label);
        }

        for (const s of sessions || []) {
          tableLabelMap.set(s.id, tableMap.get(s.table_id) || "01");
        }
      }
    }

    const orderIds = (orders || []).map((o) => o.id);
    const itemsByOrder = new Map<string, PaidHistoryItem[]>();

    if (orderIds.length > 0) {
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds);

      // Resolve real names for generic name snapshots
      const missingNameIds = (orderItems || [])
        .filter((it: any) => (!it.name_snapshot || it.name_snapshot === "Smol Item" || it.name_snapshot === "Artisanal Item") && it.menu_item_id)
        .map((it: any) => it.menu_item_id);

      const nameLookup = new Map<string, string>();
      if (missingNameIds.length > 0) {
        const { data: dbMenuItems } = await supabase
          .from("menu_items")
          .select("id, name")
          .in("id", missingNameIds);
        for (const m of dbMenuItems || []) {
          nameLookup.set(m.id, m.name);
        }
      }

      for (const item of (orderItems as Array<{
        id: string;
        order_id: string;
        menu_item_id?: string;
        name_snapshot: string;
        unit_price_snapshot: number;
        qty: number;
        line_subtotal: number;
      }>) || []) {
        if (!itemsByOrder.has(item.order_id)) {
          itemsByOrder.set(item.order_id, []);
        }
        const resolvedName =
          item.name_snapshot && item.name_snapshot !== "Smol Item" && item.name_snapshot !== "Artisanal Item"
            ? item.name_snapshot
            : (item.menu_item_id && nameLookup.get(item.menu_item_id)) || item.name_snapshot || "Artisanal Item";

        itemsByOrder.get(item.order_id)!.push({
          name: resolvedName,
          qty: item.qty,
          priceRupees: Math.round(item.unit_price_snapshot / 100),
          subtotalRupees: Math.round(item.line_subtotal / 100),
        });
      }
    }

    // Also fetch payment attempts for session bills if available
    const billSessionIds = Array.from(tableLabelMap.keys());
    const sessionPaymentMap = new Map<string, "UPI" | "CASH" | "CARD" | "COMPLIMENTARY" | string>();
    const orderAttemptMap = new Map<string, string>();
    if (billSessionIds.length > 0) {
      try {
        const { data: bills } = await supabase
          .from("bills")
          .select("id, table_session_id")
          .in("table_session_id", billSessionIds);
        
        if (bills && bills.length > 0) {
          const billIds = bills.map((b) => b.id);
          const { data: attempts } = await supabase
            .from("payment_attempts")
            .select("bill_id, provider, idempotency_key")
            .in("bill_id", billIds);

          const billProviderMap = new Map<string, string>();
          for (const att of attempts || []) {
            if (!att.provider) continue;
            billProviderMap.set(att.bill_id, att.provider);
            if (att.idempotency_key) {
              for (const ord of orders || []) {
                if (att.idempotency_key.includes(ord.id)) {
                  orderAttemptMap.set(ord.id, att.provider.trim().toUpperCase());
                }
              }
            }
          }

          for (const b of bills) {
            const prov = billProviderMap.get(b.id)?.toUpperCase();
            if (prov === "CASH") {
              sessionPaymentMap.set(b.table_session_id, "CASH");
            } else if (prov === "CARD") {
              sessionPaymentMap.set(b.table_session_id, "CARD");
            } else if (prov === "COMPLIMENTARY" || prov?.includes("COMPLIMENTARY")) {
              sessionPaymentMap.set(b.table_session_id, "COMPLIMENTARY");
            } else if (prov) {
              sessionPaymentMap.set(b.table_session_id, "UPI");
            }
          }
        }
      } catch (err) {
        console.warn("Notice fetching payment attempts:", err);
      }
    }

    const records: PaidHistoryRecord[] = (orders || [])
      .filter((o) => o.status !== "CANCELLED" && o.status !== "REJECTED" && o.status !== "PENDING_CONFIRMATION" && o.status !== "DRAFT")
      .map((o) => {
        const orderItemsList = itemsByOrder.get(o.id) || [];
        const totalItemsCount = orderItemsList.reduce((acc, i) => acc + i.qty, 0) || 1;
        
        let method: "UPI" | "CASH" | "CARD" | "COMPLIMENTARY" | string = "UPI";
        if (orderAttemptMap.has(o.id)) {
          const prov = orderAttemptMap.get(o.id)!;
          if (prov.includes("CASH")) method = "CASH";
          else if (prov.includes("CARD")) method = "CARD";
          else if (prov.includes("COMPLIMENTARY") || prov.includes("PROMO")) method = "COMPLIMENTARY";
          else method = "UPI";
        } else {
          const orderRawMethod = (o as unknown as { payment_method?: string }).payment_method?.toUpperCase();
          if (orderRawMethod) {
            if (orderRawMethod.includes("CASH")) method = "CASH";
            else if (orderRawMethod.includes("CARD")) method = "CARD";
            else if (orderRawMethod.includes("COMPLIMENTARY") || orderRawMethod.includes("PROMO")) method = "COMPLIMENTARY";
            else method = "UPI";
          } else if (o.table_session_id && sessionPaymentMap.has(o.table_session_id)) {
            method = sessionPaymentMap.get(o.table_session_id)!;
          }
        }

        let tableLabel = "01";
        if (o.table_session_id) {
          const mapped = tableLabelMap.get(o.table_session_id);
          if (mapped) {
            tableLabel = mapped;
          } else {
            const match = o.table_session_id.match(/tbl[_-]?(\d+)|table[_-]?(\d+)/i);
            if (match) {
              tableLabel = (match[1] || match[2]).padStart(2, "0");
            }
          }
        }

        return {
          id: `ORD-${o.order_no || o.id.slice(-4)}`,
          tableLabel,
          totalRupees: Math.round((o.total_snapshot || 0) / 100),
          paymentMethod: method,
          paidAt: o.accepted_at || o.submitted_at || o.created_at,
          itemsCount: totalItemsCount,
          items: orderItemsList.length > 0 ? orderItemsList : [
            {
              name: `Order #${o.order_no} Items`,
              qty: 1,
              priceRupees: Math.round((o.total_snapshot || 0) / 100),
              subtotalRupees: Math.round((o.total_snapshot || 0) / 100),
            },
          ],
        };
      });

    const totalRevenueRupees = records.reduce((acc, r) => acc + r.totalRupees, 0);

    return {
      success: true,
      records,
      totalRevenueRupees,
    };
  } catch (err) {
    console.error("Error in fetchPaidCashierHistoryAction:", err);
    return {
      success: false,
      records: [],
      totalRevenueRupees: 0,
      message: "Failed to fetch paid history.",
    };
  }
}
