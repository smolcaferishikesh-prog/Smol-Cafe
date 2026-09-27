"use server";

import { getTableSessionCookie, isValidUuid } from "@/lib/session";
import { resolveQrToken } from "@/app/t/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderStatus } from "@smol-cafe/db";

export interface OrderItemSnapshot {
  id: string;
  name: string;
  unitPricePaise: number;
  qty: number;
  lineSubtotal: number;
  itemStatus: string;
}

export interface CustomerOrderDetails {
  id: string;
  orderNo: number;
  status: OrderStatus;
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
  submittedAt: string | null;
  acceptedAt: string | null;
  readyAt: string | null;
  servedAt: string | null;
  predictedReadyAt?: string | null;
  etaMinMinutes?: number | null;
  etaMaxMinutes?: number | null;
  items: OrderItemSnapshot[];
}

export interface FetchOrdersResult {
  success: boolean;
  hasSession: boolean;
  orders: CustomerOrderDetails[];
  tableLabel?: string;
  locationName?: string;
  guestName?: string;
  guestPhone?: string;
  message?: string;
}

import { getPhoneUuid, normalizePhoneNumber, doesOrderMatchCustomerPhone } from "@/lib/customer-phone";

/**
 * Server Action: Fetches active orders for the current table session, strictly isolated by customer phone.
 */
export async function fetchActiveOrdersAction(overridePhone?: string): Promise<FetchOrdersResult> {
  let session = await getTableSessionCookie();

  if (!session || !session.sessionId || !isValidUuid(session.sessionId)) {
    const tableToken = session?.tableLabel ? `table-${session.tableLabel}` : "table-01";
    const defaultRes = await resolveQrToken(tableToken, false);
    if (defaultRes.success && defaultRes.session && isValidUuid(defaultRes.session.sessionId)) {
      session = defaultRes.session;
    }
  }

  if (!session || !session.sessionId || !isValidUuid(session.sessionId)) {
    return {
      success: true,
      hasSession: false,
      orders: [],
      message: "No active table session found. Please scan your table QR.",
    };
  }

  const cleanPhone = normalizePhoneNumber(overridePhone || session.guestPhone);
  const phoneUuid = cleanPhone ? getPhoneUuid(cleanPhone) : null;
  const supabase = createAdminClient();

  try {
    // 1. Fetch Orders for this table session AND customer profile
    let ordersQuery = supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (cleanPhone && cleanPhone.length >= 8) {
      // Fetch orders belonging to this table session OR matching customer profile UUID OR matching phone idempotency key
      ordersQuery = ordersQuery.or(`table_session_id.eq.${session.sessionId},customer_id.eq.${phoneUuid},idempotency_key.ilike.%${cleanPhone}%`);
    } else {
      ordersQuery = ordersQuery.eq("table_session_id", session.sessionId);
    }

    const { data: rawOrders, error: ordersError } = await ordersQuery;

    if (ordersError) {
      console.error("Error fetching orders:", ordersError);
      return {
        success: false,
        hasSession: true,
        orders: [],
        tableLabel: session.tableLabel,
        locationName: session.locationName,
        message: "Could not fetch orders from the database.",
      };
    }

    // 2. Strict Customer Phone Isolation:
    // Filter out any orders that were placed by a DIFFERENT phone number
    const filteredOrders = (rawOrders || []).filter((order) =>
      doesOrderMatchCustomerPhone(order, cleanPhone, session.sessionId)
    );

    if (filteredOrders.length === 0) {
      return {
        success: true,
        hasSession: true,
        orders: [],
        tableLabel: session.tableLabel,
        locationName: session.locationName,
        guestName: session.guestName,
        guestPhone: cleanPhone || undefined,
      };
    }

    const orderIds = filteredOrders.map((o) => o.id);

    // 3. Fetch Order Items for these filtered orders
    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select("*")
      .in("order_id", orderIds);

    if (itemsError) {
      console.error("Error fetching order items:", itemsError);
    }

    // Resolve real names for any items with generic name snapshots
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

    const itemsByOrder = new Map<string, OrderItemSnapshot[]>();
    for (const item of (orderItems as Array<{
      id: string;
      order_id: string;
      menu_item_id?: string;
      name_snapshot: string;
      unit_price_snapshot: number;
      qty: number;
      line_subtotal: number;
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
        unitPricePaise: item.unit_price_snapshot,
        qty: item.qty,
        lineSubtotal: item.line_subtotal,
        itemStatus: item.item_status,
      });
    }

    // 3. Assemble structured orders
    const structuredOrders: CustomerOrderDetails[] = (
      filteredOrders as Array<{
        id: string;
        order_no: number;
        status: OrderStatus;
        subtotal_snapshot: number;
        tax_snapshot: number;
        total_snapshot: number;
        submitted_at: string | null;
        accepted_at: string | null;
        ready_at: string | null;
        served_at: string | null;
        predicted_ready_at?: string | null;
        eta_min_minutes?: number | null;
        eta_max_minutes?: number | null;
      }>
    ).map((o) => ({
      id: o.id,
      orderNo: o.order_no,
      status: o.status,
      subtotalPaise: o.subtotal_snapshot,
      taxPaise: o.tax_snapshot,
      totalPaise: o.total_snapshot,
      submittedAt: o.submitted_at,
      acceptedAt: o.accepted_at,
      readyAt: o.ready_at,
      servedAt: o.served_at,
      predictedReadyAt: o.predicted_ready_at,
      etaMinMinutes: o.eta_min_minutes || 8,
      etaMaxMinutes: o.eta_max_minutes || 12,
      items: itemsByOrder.get(o.id) || [],
    }));

    return {
      success: true,
      hasSession: true,
      orders: structuredOrders,
      tableLabel: session.tableLabel,
      locationName: session.locationName,
      guestName: session.guestName,
      guestPhone: session.guestPhone,
    };
  } catch (error) {
    console.error("Unexpected error in fetchActiveOrdersAction:", error);
    return {
      success: false,
      hasSession: true,
      orders: [],
      tableLabel: session.tableLabel,
      locationName: session.locationName,
      message: "An unexpected error occurred.",
    };
  }
}
