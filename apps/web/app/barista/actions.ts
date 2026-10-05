"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient, isMockDatabase } from "@/lib/supabase/admin";
import { broadcastSyncEvent } from "@/lib/sync-events";
import type { OrderStatus } from "@smol-cafe/db";
import { generateRequestId, logger } from "@/lib/observability/logger";
import { captureAppException } from "@/lib/observability/sentry";

const STAFF_SESSION_COOKIE = "smol_staff_session";

import { isBeverageItem } from "@/lib/station-utils";

export interface BaristaOrderItem {
  id: string;
  name: string;
  qty: number;
  itemStatus: string;
  isBeverage: boolean;
  notes?: string;
  modifiers?: string[];
}

export interface BaristaTicket {
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
  items: BaristaOrderItem[];
}

export interface FetchBaristaOrdersResult {
  success: boolean;
  orders: BaristaTicket[];
  message?: string;
}

/**
 * Server Action: Fetches all active beverage and coffee orders for the Barista desk
 */
export async function fetchBaristaOrdersAction(): Promise<FetchBaristaOrdersResult> {
  const supabase = createAdminClient();

  try {
    // 1. Fetch active orders (accepted, preparing, ready, served)
    const activeStatuses = ["ACCEPTED", "PREPARING", "READY", "SERVED"];
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .in("status", activeStatuses)
      .order("created_at", { ascending: true });

    if (ordersError || !orders) {
      console.error("fetchBaristaOrdersAction error:", ordersError);
      return { success: false, orders: [], message: "Failed to fetch barista orders." };
    }

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

    const itemsByOrder = new Map<string, BaristaOrderItem[]>();
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
        isBeverage: isBeverageItem(resolvedName),
      });
    }

    // 4. Assemble barista tickets:
    // Any order containing beverages is routed to Barista Desk
    const tickets: BaristaTicket[] = [];

    for (const o of orders) {
      const allItems = itemsByOrder.get(o.id) || [];
      const beverageItems = allItems.filter((i) => i.isBeverage);

      // If the order has beverages, include it on the barista board
      if (beverageItems.length > 0) {
        const tableInfo = o.table_session_id ? tableLabelMap.get(o.table_session_id) : null;

        tickets.push({
          id: o.id,
          orderNo: o.order_no,
          tableLabel: tableInfo?.label || "01",
          tableId: tableInfo?.tableId || "",
          guestName: null,
          guestPhone: null,
          status: o.status as OrderStatus,
          submittedAt: o.submitted_at || o.created_at,
          acceptedAt: o.accepted_at,
          readyAt: o.ready_at,
          instructions: (o as { instructions?: string | null }).instructions || null,
          items: beverageItems, // show beverages for barista
        });
      }
    }

    return { success: true, orders: tickets };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch barista orders.";
    console.error("fetchBaristaOrdersAction error:", err);
    return { success: false, orders: [], message };
  }
}

/**
 * Server Action: Transition Order Status from Barista Desk
 */
export async function transitionBaristaOrderStatusAction(
  orderId: string,
  fromStatus: OrderStatus,
  toStatus: OrderStatus
): Promise<{ success: boolean; message?: string; currentStatus?: OrderStatus }> {
  const requestId = generateRequestId();
  const startTime = Date.now();
  const supabase = createAdminClient();

  try {
    const { data: currentOrder, error: checkError } = await supabase
      .from("orders")
      .select("id, status")
      .eq("id", orderId)
      .single();

    if (checkError || !currentOrder) {
      return { success: false, message: "Order not found." };
    }

    const nowIso = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      status: toStatus,
      updated_at: nowIso,
    };

    if (toStatus === "PREPARING") {
      updatePayload.accepted_at = nowIso;
    } else if (toStatus === "READY") {
      updatePayload.ready_at = nowIso;
    } else if (toStatus === "SERVED" || toStatus === "COMPLETED") {
      updatePayload.served_at = nowIso;
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", orderId);

    if (updateError) {
      return { success: false, message: "Failed to update order status." };
    }

    // NOTE: Client-side BaristaBoardView handles broadcastSyncEvent after this server action returns.
    // broadcastSyncEvent is a no-op on the server (typeof window === "undefined").

    return { success: true, currentStatus: toStatus, message: `Brew status updated to ${toStatus}` };
  } catch (err: unknown) {
    captureAppException(err, { requestId, orderId });
    const message = err instanceof Error ? err.message : "Internal server error.";
    return { success: false, message };
  }
}

/**
 * Fast Server Action: Fetch a single active Barista ticket by Order ID (~15ms response)
 */
export async function fetchSingleBaristaTicketAction(
  orderId: string
): Promise<{ success: boolean; ticket?: BaristaTicket; reason?: string }> {
  try {
    const supabase = createAdminClient();
    const { data: o, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (error || !o) return { success: false };

    // Do not return unconfirmed / cashier pending orders to barista desk
    if (o.status === "PENDING_CONFIRMATION" || o.status === "DRAFT" || o.status === "SUBMITTED" || o.status === "CANCELLED" || o.status === "REJECTED") {
      return { success: false };
    }

    let tableLabel = "01";
    let tableId = "table-01";
    if (o.table_session_id) {
      const { data: session } = await supabase
        .from("table_sessions")
        .select("table_id")
        .eq("id", o.table_session_id)
        .maybeSingle();
      if (session?.table_id) {
        tableId = session.table_id;
        const { data: table } = await supabase
          .from("dining_tables")
          .select("label")
          .eq("id", session.table_id)
          .maybeSingle();
        if (table?.label) tableLabel = table.label;
      }
    }

    const { data: orderItems } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);

    // Resolve any missing name snapshots from menu_items table
    const missingNameIds = (orderItems || [])
      .filter((it: { name_snapshot?: string | null; menu_item_id?: string | null }) => (!it.name_snapshot || it.name_snapshot === "Smol Item" || it.name_snapshot === "Artisanal Item") && it.menu_item_id)
      .map((it: { menu_item_id?: string | null }) => it.menu_item_id as string);

    const nameMap = new Map<string, string>();
    if (missingNameIds.length > 0) {
      const { data: items } = await supabase.from("menu_items").select("id, name").in("id", missingNameIds);
      (items || []).forEach((m) => nameMap.set(m.id, m.name));
    }

    const items: BaristaOrderItem[] = (orderItems || []).map((item: { id: string; name_snapshot?: string | null; menu_item_id?: string | null; qty?: number; item_status?: BaristaOrderItem["itemStatus"] }) => {
      const resolvedName =
        item.name_snapshot && item.name_snapshot !== "Smol Item" && item.name_snapshot !== "Artisanal Item"
          ? item.name_snapshot
          : (item.menu_item_id && nameMap.get(item.menu_item_id)) || item.name_snapshot || "Artisanal Item";

      return {
        id: item.id,
        name: resolvedName,
        qty: item.qty || 1,
        itemStatus: item.item_status || "PENDING",
        isBeverage: isBeverageItem(resolvedName),
      };
    });

    const beverageItems = items.filter((item) => item.isBeverage);
    if (beverageItems.length === 0) {
      return { success: false, reason: "NO_BEVERAGE_ITEMS" };
    }

    const ticket: BaristaTicket = {
      id: o.id,
      orderNo: o.order_no,
      tableLabel,
      tableId,
      guestName: null,
      guestPhone: null,
      status: o.status as OrderStatus,
      submittedAt: o.submitted_at || o.created_at,
      acceptedAt: o.accepted_at,
      readyAt: o.ready_at,
      instructions: o.instructions || o.special_instructions || o.notes || null,
      items: beverageItems,
    };

    return { success: true, ticket };
  } catch (err) {
    console.error("Error in fetchSingleBaristaTicketAction:", err);
    return { success: false };
  }
}


/**
 * Server Action: Check if staff is logged in
 */
export async function checkStaffAuthAction(): Promise<boolean> {
  const cookieStore = await cookies();
  return Boolean(cookieStore.get(STAFF_SESSION_COOKIE)?.value);
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
  if (trimmed === creds.barista.pin || (creds.admin.password && trimmed === creds.admin.password)) {
    const cookieStore = await cookies();
    cookieStore.set(STAFF_SESSION_COOKIE, "barista", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return { success: true };
  }

  return { success: false, message: "Invalid Barista Station PIN." };
}

/**
 * Server Action: Staff logout
 */
export async function staffLogoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(STAFF_SESSION_COOKIE);
}
