"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient, isMockDatabase } from "@/lib/supabase/admin";
import { broadcastSyncEvent } from "@/lib/sync-events";
import { isBeverageItem, deriveStationStatus, deriveAggregateOrderStatus } from "@/lib/station-utils";
import { extractOrderInstructions } from "@/lib/order-instructions";
import type { OrderStatus } from "@smol-cafe/db";
import { generateRequestId, logger } from "@/lib/observability/logger";
import { recordKdsHeartbeat, evaluateKdsSilence } from "@/lib/observability/alerts";
import { captureAppException } from "@/lib/observability/sentry";

const STAFF_SESSION_COOKIE = "smol_staff_session";

export interface KitchenOrderItem {
  id: string;
  name: string;
  qty: number;
  itemStatus: string;
}

export interface KitchenTicket {
  id: string;
  orderNo: number;
  tableLabel: string;
  tableId: string;
  guestName?: string | null;
  guestPhone?: string | null;
  status: OrderStatus;
  submittedAt: string | null;
  acceptedAt: string | null;
  readyAt: string | null;
  instructions?: string | null;
  items: KitchenOrderItem[];
}

export interface FetchKitchenOrdersResult {
  success: boolean;
  orders: KitchenTicket[];
  message?: string;
}

export interface TransitionOrderResult {
  success: boolean;
  error?: "STATUS_MISMATCH" | "ORDER_NOT_FOUND" | "DB_ERROR";
  message?: string;
  currentStatus?: OrderStatus;
}

/**
 * Server Action: Fast single kitchen ticket fetch for instant realtime hydration (15ms vs 600ms)
 */
export async function fetchSingleKitchenTicketAction(orderId: string): Promise<{ success: boolean; ticket?: KitchenTicket; reason?: string }> {
  const supabase = createAdminClient();
  try {
    const { data: order, error: orderErr } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
    if (orderErr || !order) return { success: false };

    // Do not return cancelled or rejected orders to kitchen KDS
    if (order.status === "PENDING_CONFIRMATION" || order.status === "DRAFT" || order.status === "CANCELLED" || order.status === "REJECTED") {
      return { success: false };
    }

    let tableLabel = "01";
    let tableId = "table-01";

    if (order.table_session_id) {
      const { data: session } = await supabase.from("table_sessions").select("table_id").eq("id", order.table_session_id).maybeSingle();
      if (session?.table_id) {
        tableId = session.table_id;
        const { data: tbl } = await supabase.from("dining_tables").select("label").eq("id", session.table_id).maybeSingle();
        if (tbl?.label) tableLabel = tbl.label;
      }
    }

    const { data: orderItems } = await supabase.from("order_items").select("*").eq("order_id", orderId);
    
    // Resolve any missing name snapshots from menu_items table
    const missingNameIds = (orderItems || [])
      .filter((it: { name_snapshot?: string | null; menu_item_id?: string | null }) => (!it.name_snapshot || it.name_snapshot === "Smol Item" || it.name_snapshot === "Artisanal Item") && it.menu_item_id)
      .map((it: { menu_item_id?: string | null }) => it.menu_item_id as string);

    const nameMap = new Map<string, string>();
    if (missingNameIds.length > 0) {
      const { data: items } = await supabase.from("menu_items").select("id, name").in("id", missingNameIds);
      (items || []).forEach((m) => nameMap.set(m.id, m.name));
    }

    const allItems: KitchenOrderItem[] = (orderItems || []).map((it: { id: string; name_snapshot?: string | null; menu_item_id?: string | null; qty?: number; item_status?: KitchenOrderItem["itemStatus"] }) => {
      const resolvedName =
        it.name_snapshot && it.name_snapshot !== "Smol Item" && it.name_snapshot !== "Artisanal Item"
          ? it.name_snapshot
          : (it.menu_item_id && nameMap.get(it.menu_item_id)) || it.name_snapshot || "Artisanal Item";

      return {
        id: it.id,
        name: resolvedName,
        qty: it.qty || 1,
        itemStatus: it.item_status || "PENDING",
      };
    });

    // Filter to ONLY dispatched food items (drinks belong exclusively to Barista)
    const foodItems = allItems.filter((it) => !isBeverageItem(it.name) && it.itemStatus && it.itemStatus !== "PENDING" && it.itemStatus !== "DRAFT");
    if (foodItems.length === 0) {
      return { success: false, reason: "NO_DISPATCHED_FOOD_ITEMS" };
    }

    const ticket: KitchenTicket = {
      id: order.id,
      orderNo: order.order_no,
      tableLabel,
      tableId,
      status: deriveStationStatus(foodItems, order.status as OrderStatus),
      submittedAt: order.submitted_at || order.created_at,
      acceptedAt: order.accepted_at,
      readyAt: order.ready_at,
      instructions: extractOrderInstructions(order),
      items: foodItems,
    };

    return { success: true, ticket };
  } catch (err) {
    console.error("Error in fetchSingleKitchenTicketAction:", err);
    return { success: false };
  }
}

/**
 * Server Action: Fetches all active kitchen orders (SUBMITTED, ACCEPTED, PREPARING, READY)
 */
export async function fetchKitchenOrdersAction(): Promise<FetchKitchenOrdersResult> {
  const supabase = createAdminClient();
  recordKdsHeartbeat();

  try {
    // 1. Fetch active orders across confirmed KDS phases: Submitted, Accepted, Preparing, Ready, and Served
    const activeStatuses = ["SUBMITTED", "ACCEPTED", "PREPARING", "READY", "SERVED"];

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .in("status", activeStatuses)
      .order("created_at", { ascending: true });

    if (ordersError || !orders) {
      logger.error("Error fetching kitchen orders", {
        action: "fetchKitchenOrders",
        data: { error: ordersError?.message },
      });
      return { success: false, orders: [], message: "Failed to fetch kitchen orders." };
    }

    evaluateKdsSilence(orders.length);

    if (orders.length === 0) {
      return { success: true, orders: [] };
    }

    const orderIds = orders.map((o) => o.id);
    const sessionIds = orders
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
      .filter((it: { name_snapshot?: string | null; menu_item_id?: string | null }) => (!it.name_snapshot || it.name_snapshot === "Smol Item" || it.name_snapshot === "Artisanal Item") && it.menu_item_id)
      .map((it: { menu_item_id?: string | null }) => it.menu_item_id as string);

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
      if (s.table_id && tableMap.has(s.table_id)) {
        tableLabelMap.set(s.id, {
          label: tableMap.get(s.table_id)!,
          tableId: s.table_id,
        });
      }
    }

    const nameLookup = new Map<string, string>();
    for (const m of dbMenuItemsRes.data || []) {
      nameLookup.set(m.id, m.name);
    }

    const itemsByOrder = new Map<string, KitchenOrderItem[]>();
    for (const item of (orderItems as Array<{
      id: string;
      order_id: string;
      menu_item_id?: string;
      name_snapshot: string;
      qty: number;
      item_status: string;
    }>) || []) {
      if (!itemsByOrder.has(item.order_id)) {
        itemsByOrder.set(item.order_id, []);
      }
      const resolvedName =
        item.name_snapshot && item.name_snapshot !== "Smol Item" && item.name_snapshot !== "Artisanal Item"
          ? item.name_snapshot
          : (item.menu_item_id && nameLookup.get(item.menu_item_id)) || item.name_snapshot || "Artisanal Item";

      itemsByOrder.get(item.order_id)!.push({
        id: item.id,
        name: resolvedName,
        qty: item.qty,
        itemStatus: item.item_status || "PENDING",
      });
    }

    // 4. Assemble structured kitchen tickets (Dispatched food items ONLY)
    const tickets: KitchenTicket[] = [];

    for (const o of orders) {
      const allItems = itemsByOrder.get(o.id) || [];
      const dispatchedFoodItems = allItems.filter(
        (i) => !isBeverageItem(i.name) && i.itemStatus && i.itemStatus !== "PENDING" && i.itemStatus !== "DRAFT"
      );
      if (dispatchedFoodItems.length === 0) {
        continue;
      }

      const tableInfo = o.table_session_id ? tableLabelMap.get(o.table_session_id) : null;

      tickets.push({
        id: o.id,
        orderNo: o.order_no,
        tableLabel: tableInfo?.label || "Direct / Takeaway",
        tableId: tableInfo?.tableId || "",
        guestName: null,
        guestPhone: null,
        status: deriveStationStatus(dispatchedFoodItems, o.status as OrderStatus),
        submittedAt: o.submitted_at || o.created_at,
        acceptedAt: o.accepted_at,
        readyAt: o.ready_at,
        instructions: extractOrderInstructions(o),
        items: dispatchedFoodItems,
      });
    }

    return {
      success: true,
      orders: tickets,
    };
  } catch (error) {
    console.error("Unexpected error in fetchKitchenOrdersAction:", error);
    return { success: false, orders: [], message: "An unexpected error occurred." };
  }
}

/**
 * Server Action: Validates current status and transitions order with history logging
 */
export async function transitionOrderStatusAction(
  orderId: string,
  fromStatusOrTarget: OrderStatus,
  targetStatus?: OrderStatus
): Promise<TransitionOrderResult> {
  const fromStatus = targetStatus ? fromStatusOrTarget : undefined;
  const toStatus = targetStatus || fromStatusOrTarget;
  const requestId = generateRequestId();
  const startTime = Date.now();
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  try {
    // 1. Fetch current order status to prevent concurrent double-processing
    const { data: currentOrder, error: fetchErr } = await supabase
      .from("orders")
      .select("status, accepted_at")
      .eq("id", orderId)
      .single();

    if (fetchErr || !currentOrder) {
      logger.warn("Status transition rejected: Order not found", {
        requestId,
        orderId,
        action: "transitionOrderStatus",
      });
      return {
        success: false,
        error: "ORDER_NOT_FOUND",
        message: "Order ticket could not be found.",
      };
    }

    // Idempotent success if already in target status
    if (currentOrder.status === toStatus) {
      return {
        success: true,
        currentStatus: toStatus,
      };
    }

    // Define valid 4-phase transition state machine
    const isAllowedTransition = (curr: string, target: OrderStatus): boolean => {
      // Phase 1 (New) -> Phase 2 (Preparing)
      if (
        ["SUBMITTED", "PENDING_CONFIRMATION", "CONFIRMED", "ACCEPTED"].includes(curr) &&
        target === "PREPARING"
      ) {
        return true;
      }
      // Phase 2 (Preparing) -> Phase 3 (Ready)
      if (
        ["PREPARING", "ACCEPTED", "CONFIRMED", "SUBMITTED"].includes(curr) &&
        target === "READY"
      ) {
        return true;
      }
      // Phase 3 (Ready) -> Phase 4 (Complete)
      if (
        ["READY", "PREPARING", "ACCEPTED", "SUBMITTED"].includes(curr) &&
        (target === "SERVED" || target === "COMPLETED")
      ) {
        return true;
      }
      return fromStatus ? curr === fromStatus : true;
    };

    if (!isAllowedTransition(currentOrder.status, toStatus)) {
      logger.warn(
        `Status transition conflict: Current ${currentOrder.status} cannot transition to ${toStatus}`,
        {
          requestId,
          orderId,
          action: "transitionOrderStatus",
          data: { expected: fromStatus, actual: currentOrder.status, target: toStatus },
        }
      );
      return {
        success: false,
        error: "STATUS_MISMATCH",
        currentStatus: currentOrder.status as OrderStatus,
        message: `Ticket was already moved to ${currentOrder.status} by another staff member.`,
      };
    }

    const normalizedToStatus: OrderStatus =
      (toStatus as string) === "COMPLETED" ? "SERVED" : toStatus;

    // 2. Fetch all items belonging to this order
    const { data: dbItems } = await supabase
      .from("order_items")
      .select("id, name_snapshot, item_status")
      .eq("order_id", orderId);

    // 3. Update Kitchen food items in order_items
    const foodItemIds = (dbItems || [])
      .filter((it) => !isBeverageItem(it.name_snapshot))
      .map((it) => it.id);

    if (foodItemIds.length > 0) {
      await supabase
        .from("order_items")
        .update({ item_status: normalizedToStatus })
        .in("id", foodItemIds);
    }

    // 4. Derive overall aggregate order status
    const allItemsUpdated = (dbItems || []).map((it) => ({
      name: it.name_snapshot,
      itemStatus: foodItemIds.includes(it.id) ? normalizedToStatus : (it.item_status || "PENDING"),
    }));

    const newAggregateStatus = deriveAggregateOrderStatus(
      allItemsUpdated,
      currentOrder.status as OrderStatus
    );

    // 5. Update orders row with aggregate status
    const updatePayload: Record<string, unknown> = {
      status: newAggregateStatus,
      updated_at: nowIso,
    };

    if (newAggregateStatus === "PREPARING" && !currentOrder.accepted_at) {
      updatePayload.accepted_at = nowIso;
    }
    if (newAggregateStatus === "READY") {
      updatePayload.ready_at = nowIso;
    }
    if (newAggregateStatus === "SERVED") {
      updatePayload.served_at = nowIso;
    }

    const { error: updateErr } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", orderId);

    if (updateErr) {
      logger.error("Failed to update order status", {
        requestId,
        orderId,
        action: "transitionOrderStatus",
        data: { error: updateErr.message },
      });
      return {
        success: false,
        error: "DB_ERROR",
        message: "Failed to update order status.",
      };
    }

    // 6. Log to order_status_history with request_id correlation
    await supabase.from("order_status_history").insert({
      order_id: orderId,
      from_status: fromStatus,
      to_status: normalizedToStatus,
      actor_type: "STAFF",
      notes: `Kitchen food items moved to ${normalizedToStatus} [${requestId}]`,
      created_at: nowIso,
    });

    // 7. Trigger Inventory Lifecycle Transition (RESERVE -> CONSUME on PREPARING or RELEASE on CANCELLED)
    try {
      await supabase.rpc("handle_order_inventory_transition", {
        p_order_id: orderId,
        p_to_status: toStatus,
      });
    } catch (invErr) {
      console.warn("Inventory transition notice:", invErr);
    }

    const durationMs = Date.now() - startTime;
    logger.info(`Order ${orderId} Kitchen food moved to ${normalizedToStatus} (aggregate: ${newAggregateStatus})`, {
      requestId,
      orderId,
      action: "transitionOrderStatus",
      durationMs,
      data: { fromStatus, toStatus, newAggregateStatus },
    });

    // 8. Broadcast station-specific event + aggregate event
    broadcastSyncEvent({
      type: "TICKET_STATUS_CHANGED",
      orderId,
      station: "KITCHEN",
      status: normalizedToStatus,
      timestamp: Date.now(),
    });

    broadcastSyncEvent({
      type: "STATUS_CHANGED",
      orderId,
      status: newAggregateStatus,
      timestamp: Date.now(),
    });

    broadcastSyncEvent({
      type: "INVENTORY_UPDATED",
      timestamp: Date.now(),
    });

    return {
      success: true,
      currentStatus: normalizedToStatus,
      message: `Kitchen order moved to ${normalizedToStatus}`,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error("Unexpected error in transitionOrderStatusAction", {
      requestId,
      orderId,
      action: "transitionOrderStatus",
      durationMs,
      data: { error: String(error) },
    });
    captureAppException(error, { requestId, orderId });

    return {
      success: false,
      error: "DB_ERROR",
      message: "An unexpected error occurred during status transition.",
    };
  }
}

import { getStoredCredentials } from "@/app/smol-backdoor/actions";

/**
 * Server Action: Staff login
 */
export async function staffLoginAction(
  pinOrPassword: string
): Promise<{ success: boolean; message?: string }> {
  const creds = await getStoredCredentials();
  const trimmed = pinOrPassword.trim();
  if (trimmed === creds.kitchen.pin || (creds.admin.password && trimmed === creds.admin.password)) {
    const cookieStore = await cookies();
    cookieStore.set(STAFF_SESSION_COOKIE, "kitchen", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });
    return { success: true };
  }

  return { success: false, message: "Invalid Kitchen Station PIN." };
}

/**
 * Server Action: Check if staff is logged in
 */
export async function checkStaffAuthAction(): Promise<boolean> {
  const cookieStore = await cookies();
  return Boolean(cookieStore.get(STAFF_SESSION_COOKIE)?.value);
}

/**
 * Server Action: Staff logout
 */
export async function staffLogoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(STAFF_SESSION_COOKIE);
}
