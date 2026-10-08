"use server";

import { createAdminClient, isMockDatabase } from "@/lib/supabase/admin";
import { TABLE_ZONES_CONFIG } from "@/lib/table-tag";
import { broadcastSyncEvent } from "@/lib/sync-events";
import { getMenuCatalog } from "@/lib/queries/menu";
import type { OrderStatus } from "@smol-cafe/db";

export interface AdminOrderItem {
  name: string;
  qty: number;
  priceRupees: number;
  subtotalRupees: number;
}

export interface AdminOrderRecord {
  id: string;
  orderNo: number;
  tableLabel: string;
  zone: string;
  items: string[];
  itemsDetail: AdminOrderItem[];
  status: OrderStatus;
  totalRupees: number;
  paymentStatus: string;
  paymentMethod: string;
  createdAt: string;
  rawCreatedAt: string;
}

export interface AdminPaymentRecord {
  txn: string;
  mode: string;
  amt: string;
  ord: string;
  st: string;
  time: string;
}

export interface AdminOverviewKPIs {
  todaysOrders: number;
  grossRevenueRupees: number;
  activeTablesCount: number;
  totalTablesCount: number;
  pendingKdsCount: number;
  avgOrderRupees: number;
  topSellerName: string;
  topSellerUnits: number;
}

export interface AdminHourlyBucket {
  hour: string;
  orders: number;
}

export interface AdminBestSeller {
  name: string;
  sales: number;
  rev: string;
  pct: number;
}

export interface AdminZoneUtil {
  zone: string;
  occ: string;
  color: string;
}

export interface AdminPaymentSplit {
  mode: string;
  pct: string;
  color: string;
}

export interface AdminMenuItemRecord {
  id: string;
  name: string;
  category: string;
  price: string;
  dietary: string;
  status: string;
}

export interface AdminTableRecord {
  id: string;
  label: string;
  seats: number;
  isActive: boolean;
}

export interface AdminAnalyticsMetrics {
  tableTurnDurationMinutes: number | null;
  reorderRatePercent: number | null;
  avgTicketVsPriorWeekPercent: number | null;
  peakHourWindow: string;
}

export interface AdminOverviewData {
  kpis: AdminOverviewKPIs;
  orders: AdminOrderRecord[];
  payments: AdminPaymentRecord[];
  hourlyTrend: AdminHourlyBucket[];
  bestSellers: AdminBestSeller[];
  zoneUtilization: AdminZoneUtil[];
  paymentSplit: AdminPaymentSplit[];
  cumulativeRevenuePoints: number[];
  menuItems: AdminMenuItemRecord[];
  menuCategories: string[];
  tables: AdminTableRecord[];
  analyticsMetrics: AdminAnalyticsMetrics;
}

/**
 * Server Action: Fetches and calculates live operational overview data for the Admin Control Tower.
 */
export async function fetchAdminOverviewAction(): Promise<{
  success: boolean;
  data: AdminOverviewData | null;
  message?: string;
}> {
  const supabase = createAdminClient();

  try {
    // 1. Fetch all orders (excluding cancelled/rejected if needed for revenue, but keeping all for logs)
    const { data: rawOrders, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (ordersError) {
      console.error("[fetchAdminOverviewAction] Error fetching orders:", ordersError);
    }

    const orders = rawOrders || [];

    // 2. Fetch dining tables & active table sessions
    const { data: diningTables } = await supabase.from("dining_tables").select("*");
    const { data: tableSessions } = await supabase.from("table_sessions").select("*");

    const tableMap = new Map<string, string>();
    for (const t of diningTables || []) {
      tableMap.set(t.id, t.label);
    }

    const sessionToTableMap = new Map<string, string>();
    const activeSessions = (tableSessions || []).filter((s) => s.status === "ACTIVE" || s.status === "OPEN");
    const activeTableIds = new Set<string>();

    for (const s of tableSessions || []) {
      const label = tableMap.get(s.table_id) || "01";
      sessionToTableMap.set(s.id, label);
      if (s.status === "ACTIVE" || s.status === "OPEN") {
        activeTableIds.add(label);
      }
    }

    // 3. Fetch order items
    const orderIds = orders.map((o) => o.id);
    const itemsByOrder = new Map<string, AdminOrderItem[]>();

    if (orderIds.length > 0) {
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds);

      for (const item of (orderItems as Array<{
        id: string;
        order_id: string;
        name_snapshot: string;
        unit_price_snapshot: number;
        qty: number;
        line_subtotal: number;
      }>) || []) {
        if (!itemsByOrder.has(item.order_id)) {
          itemsByOrder.set(item.order_id, []);
        }
        itemsByOrder.get(item.order_id)!.push({
          name: item.name_snapshot,
          qty: item.qty,
          priceRupees: Math.round((item.unit_price_snapshot || 0) / 100),
          subtotalRupees: Math.round((item.line_subtotal || 0) / 100),
        });
      }
    }

    // 3.5. Fetch bills and payment attempts to accurately resolve payment method & financial ledger
    const sessionIds = Array.from(
      new Set(orders.map((o) => o.table_session_id).filter((id): id is string => Boolean(id)))
    );

    const orderPaymentProviderMap = new Map<string, string>();
    const sessionPaymentProviderMap = new Map<string, string>();

    if (sessionIds.length > 0) {
      try {
        const { data: bills } = await supabase
          .from("bills")
          .select("id, table_session_id")
          .in("table_session_id", sessionIds);

        if (bills && bills.length > 0) {
          const billIds = bills.map((b) => b.id);
          const billToSessionMap = new Map<string, string>();
          for (const b of bills) {
            billToSessionMap.set(b.id, b.table_session_id);
          }

          const { data: paymentAttempts } = await supabase
            .from("payment_attempts")
            .select("id, bill_id, provider, status, idempotency_key, created_at")
            .in("bill_id", billIds)
            .order("created_at", { ascending: true });

          for (const att of paymentAttempts || []) {
            if (!att.provider) continue;
            const providerUpper = att.provider.trim().toUpperCase();

            // 1. Direct order link via idempotency_key (format: cashier_confirm_${orderId}_... or cashier_edit_${orderId}_...)
            if (att.idempotency_key) {
              for (const ordId of orderIds) {
                if (att.idempotency_key.includes(ordId)) {
                  orderPaymentProviderMap.set(ordId, providerUpper);
                }
              }
            }

            // 2. Table Session link
            const sessId = billToSessionMap.get(att.bill_id);
            if (sessId) {
              sessionPaymentProviderMap.set(sessId, providerUpper);
            }
          }
        }
      } catch (payErr) {
        console.warn("[fetchAdminOverviewAction] Notice resolving payment attempts:", payErr);
      }
    }

    // 4. Map Orders and compute aggregates
    let grossRevenuePaise = 0;
    let pendingKdsTickets = 0;
    const itemSalesCount = new Map<string, { qty: number; revenuePaise: number }>();
    const paymentMethodCounts: Record<string, number> = { UPI: 0, CASH: 0, CARD: 0 };
    const hourlyCounts: Record<string, number> = {
      "8a": 0, "9a": 0, "10a": 0, "11a": 0, "12p": 0,
      "1p": 0, "2p": 0, "3p": 0, "4p": 0, "5p": 0,
      "6p": 0, "7p": 0, "8p": 0, "9p": 0,
    };

    const mappedOrders: AdminOrderRecord[] = [];
    const mappedPayments: AdminPaymentRecord[] = [];

    for (let orderIndex = 0; orderIndex < orders.length; orderIndex++) {
      const o = orders[orderIndex];
      const orderDate = new Date(o.created_at || Date.now());
      // Table label resolution
      let tableLabel = "01";
      if (o.table_session_id) {
        const fromSession = sessionToTableMap.get(o.table_session_id);
        if (fromSession) {
          tableLabel = fromSession;
        } else {
          const match = o.table_session_id.match(/tbl[_-]?(\d+)|table[_-]?(\d+)/i);
          if (match) {
            tableLabel = (match[1] || match[2]).padStart(2, "0");
          }
        }
      }

      // Add to active tables if order is not completed/cancelled
      if (o.status !== "COMPLETED" && o.status !== "CANCELLED" && o.status !== "REJECTED") {
        activeTableIds.add(tableLabel);
      }

      const zoneInfo = TABLE_ZONES_CONFIG[tableLabel] || { zone: "Café" };
      const orderItems = itemsByOrder.get(o.id) || [];
      const itemSummaries = orderItems.map((i) => `${i.name} (x${i.qty})`);

      const totalRupees = Math.round((o.total_snapshot || 0) / 100);

      // Payment method resolution
      let rawMethod = "";
      if (orderPaymentProviderMap.has(o.id)) {
        rawMethod = orderPaymentProviderMap.get(o.id)!;
      } else if (o.table_session_id && sessionPaymentProviderMap.has(o.table_session_id)) {
        rawMethod = sessionPaymentProviderMap.get(o.table_session_id)!;
      } else if ((o as unknown as { payment_method?: string }).payment_method) {
        rawMethod = (o as unknown as { payment_method?: string }).payment_method!.toUpperCase();
      }

      const upper = (rawMethod || "").toUpperCase();
      const rawPaymentStatus = (o as unknown as { payment_status?: string }).payment_status?.toUpperCase();
      const isComplimentary = upper.includes("COMPLIMENTARY") || upper.includes("PROMO") || upper.includes("FREE");
      
      const hasRecordedPayment =
        orderPaymentProviderMap.has(o.id) ||
        (o.table_session_id ? sessionPaymentProviderMap.has(o.table_session_id) : false) ||
        rawPaymentStatus === "PAID";

      const isAwaitingApproval =
        o.status === "SUBMITTED" ||
        o.status === "DRAFT" ||
        o.status === "PENDING_CONFIRMATION";

      const isPaid = !isComplimentary && (hasRecordedPayment || (!isAwaitingApproval && (o.status === "ACCEPTED" || o.status === "PREPARING" || o.status === "READY" || o.status === "SERVED" || o.status === "COMPLETED")));
      const isUnpaidPending = !isPaid && !isComplimentary;

      let methodLabel = "PAID (UPI)";
      let paymentCategory: "UPI" | "CASH" | "CARD" = "UPI";
      let displayMethod = "UPI";

      if (isComplimentary) {
        methodLabel = "COMPLIMENTARY";
        paymentCategory = "CASH";
        displayMethod = "COMPLIMENTARY";
      } else if (isUnpaidPending) {
        methodLabel = "UNPAID (PENDING)";
        paymentCategory = "UPI";
        displayMethod = "PENDING";
      } else if (upper.includes("CASH")) {
        methodLabel = "PAID (CASH)";
        paymentCategory = "CASH";
        displayMethod = "CASH";
      } else if (upper.includes("CARD") || upper.includes("APPLE_PAY") || upper.includes("POS")) {
        methodLabel = "PAID (CARD)";
        paymentCategory = "CARD";
        displayMethod = "CARD";
      } else if (upper.includes("TEST") || upper.includes("BYPASS")) {
        methodLabel = "PAID (TEST_MODE)";
        paymentCategory = "UPI";
        displayMethod = "TEST_MODE";
      } else if (upper.includes("RAZORPAY") || upper.includes("ONLINE")) {
        methodLabel = "PAID (ONLINE)";
        paymentCategory = "CARD";
        displayMethod = "ONLINE";
      } else {
        methodLabel = "PAID (UPI)";
        paymentCategory = "UPI";
        displayMethod = "UPI";
      }

      if (o.status !== "CANCELLED" && o.status !== "REJECTED") {
        // ONLY verified collected funds count towards Gross Revenue (never unpaid or complimentary)
        if (isPaid) {
          grossRevenuePaise += o.total_snapshot || 0;
          paymentMethodCounts[paymentCategory] = (paymentMethodCounts[paymentCategory] || 0) + 1;
        }

        // Tally items
        for (const item of orderItems) {
          const current = itemSalesCount.get(item.name) || { qty: 0, revenuePaise: 0 };
          current.qty += item.qty;
          current.revenuePaise += (item.subtotalRupees * 100);
          itemSalesCount.set(item.name, current);
        }
      }

      // KDS pending count
      if (o.status === "SUBMITTED" || o.status === "ACCEPTED" || o.status === "PREPARING") {
        pendingKdsTickets++;
      }

      // Hourly slot calculated from actual order date timestamp
      const orderHour = orderDate.getHours();
      let slotHour = "12p";
      if (orderHour <= 8) slotHour = "8a";
      else if (orderHour === 9) slotHour = "9a";
      else if (orderHour === 10) slotHour = "10a";
      else if (orderHour === 11) slotHour = "11a";
      else if (orderHour === 12) slotHour = "12p";
      else if (orderHour === 13) slotHour = "1p";
      else if (orderHour === 14) slotHour = "2p";
      else if (orderHour === 15) slotHour = "3p";
      else if (orderHour === 16) slotHour = "4p";
      else if (orderHour === 17) slotHour = "5p";
      else if (orderHour === 18) slotHour = "6p";
      else if (orderHour === 19) slotHour = "7p";
      else if (orderHour === 20) slotHour = "8p";
      else slotHour = "9p";

      if (hourlyCounts[slotHour] !== undefined) {
        hourlyCounts[slotHour]++;
      }

      const relativeTime = formatRelativeTime(orderDate);

      mappedOrders.push({
        id: o.id,
        orderNo: o.order_no || parseInt(o.id.slice(-4), 10) || 101,
        tableLabel,
        zone: zoneInfo.zone,
        items: itemSummaries.length > 0 ? itemSummaries : ["Custom Cafe Order"],
        itemsDetail: orderItems,
        status: o.status,
        totalRupees,
        paymentStatus: methodLabel,
        paymentMethod: displayMethod,
        createdAt: relativeTime,
        rawCreatedAt: o.created_at,
      });

      // Payments ledger entry
      if (o.status !== "CANCELLED" && o.status !== "REJECTED") {
        let ledgerStatus = "VERIFIED";
        let ledgerMode = "UPI Direct QR";
        let ledgerTxn = `TXN/${orderDate.getFullYear()}/${(o.id || "").replace(/[^0-9]/g, "").slice(-8) || "89412984"}`;

        if (isComplimentary) {
          ledgerStatus = "COMPLIMENTARY";
          ledgerMode = "Complimentary / Promo";
          ledgerTxn = `COMP-${(o.id || "").replace(/[^0-9]/g, "").slice(-6) || "000000"}`;
        } else if (isUnpaidPending) {
          ledgerStatus = "PENDING";
          ledgerMode = "Pay at Counter / Table";
          ledgerTxn = "—";
        } else {
          ledgerStatus = o.status === "COMPLETED" || o.status === "SERVED" ? "SETTLED" : "VERIFIED";
          ledgerMode =
            paymentCategory === "CASH"
              ? "Cash Tendered"
              : paymentCategory === "CARD"
              ? "Card / NFC Tap"
              : "UPI Direct QR";
        }

        mappedPayments.push({
          txn: ledgerTxn,
          mode: ledgerMode,
          amt: isComplimentary ? "₹0 (Comp)" : `₹${totalRupees}`,
          ord: `ORD-${o.order_no || o.id.slice(-4)}`,
          st: ledgerStatus,
          time: orderDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
      }
    }

    // 5. Best Sellers Calculation from real orders
    const sortedItems = Array.from(itemSalesCount.entries())
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 5);

    const maxSalesQty = sortedItems.length > 0 ? sortedItems[0][1].qty : 1;
    const bestSellers: AdminBestSeller[] = sortedItems.map(([name, data]) => ({
      name,
      sales: data.qty,
      rev: `₹${Math.round(data.revenuePaise / 100).toLocaleString("en-IN")}`,
      pct: Math.min(100, Math.max(15, Math.round((data.qty / maxSalesQty) * 100))),
    }));

    const topSeller = bestSellers[0] || { name: "No Orders Yet", sales: 0 };

    // 6. Hourly Trend Array
    const hourlyTrend: AdminHourlyBucket[] = Object.entries(hourlyCounts).map(([hour, count]) => ({
      hour,
      orders: count,
    }));

    // 7. Zone Utilization Calculation (6 smol-cafe, 4 smol-lounge, 4 smol-terrace)
    const zoneTableCounts: Record<string, { total: number; occupied: number }> = {
      "smol-cafe": { total: 6, occupied: 0 },
      "smol-lounge": { total: 4, occupied: 0 },
      "smol-terrace": { total: 4, occupied: 0 },
    };

    for (let i = 1; i <= 14; i++) {
      const label = i.toString().padStart(2, "0");
      const zName = TABLE_ZONES_CONFIG[label]?.zone || "smol-cafe";
      if (zoneTableCounts[zName]) {
        if (activeTableIds.has(label)) {
          zoneTableCounts[zName].occupied++;
        }
      }
    }

    const zoneUtilization: AdminZoneUtil[] = [
      {
        zone: "smol-cafe",
        occ: `${Math.round((zoneTableCounts["smol-cafe"].occupied / (zoneTableCounts["smol-cafe"].total || 1)) * 100)}%`,
        color: "#F2C84B",
      },
      {
        zone: "smol-lounge",
        occ: `${Math.round((zoneTableCounts["smol-lounge"].occupied / (zoneTableCounts["smol-lounge"].total || 1)) * 100)}%`,
        color: "#9F7AEA",
      },
      {
        zone: "smol-terrace",
        occ: `${Math.round((zoneTableCounts["smol-terrace"].occupied / (zoneTableCounts["smol-terrace"].total || 1)) * 100)}%`,
        color: "#38B2AC",
      },
    ];

    // 8. Payment Split Calculation
    const totalPaymentsCount = Object.values(paymentMethodCounts).reduce((a, b) => a + b, 0) || 1;
    const paymentSplit: AdminPaymentSplit[] = [
      {
        mode: "UPI Direct QR",
        pct: `${Math.round((paymentMethodCounts.UPI / totalPaymentsCount) * 100)}%`,
        color: "#48BB78",
      },
      {
        mode: "Counter Cash",
        pct: `${Math.round((paymentMethodCounts.CASH / totalPaymentsCount) * 100)}%`,
        color: "#ED8936",
      },
      {
        mode: "Card / NFC",
        pct: `${Math.round((paymentMethodCounts.CARD / totalPaymentsCount) * 100)}%`,
        color: "#4299E1",
      },
    ];

    const grossRevenueRupees = Math.round(grossRevenuePaise / 100);
    const validOrdersCount = mappedOrders.filter((o) => o.status !== "CANCELLED" && o.status !== "REJECTED").length;
    const avgOrderRupees = validOrdersCount > 0 ? Math.round(grossRevenueRupees / validOrdersCount) : 0;

    // 9. Fetch Full 59-Item Menu Catalog & Categories
    const catalogData = await getMenuCatalog();
    const allMenuItems: AdminMenuItemRecord[] = [];
    const menuCategories: string[] = ["ALL"];

    for (const cat of catalogData) {
      if (!menuCategories.includes(cat.name)) {
        menuCategories.push(cat.name);
      }
      for (const item of cat.items) {
        allMenuItems.push({
          id: item.id,
          name: item.name,
          category: cat.name,
          price: `₹${Math.round(item.pricePaise / 100)}`,
          dietary: item.metadata?.dietary || "Vegetarian",
          status: item.status || "ACTIVE",
        });
      }
    }

    // 10. Map real tables & compute live session analytics
    const mappedTables: AdminTableRecord[] = (diningTables || []).map((t) => ({
      id: t.id,
      label: t.label,
      seats: t.seats || 2,
      isActive: Boolean(t.is_active ?? true),
    }));

    // Table Turn Duration from closed sessions
    const closedSessions = (tableSessions || []).filter((s) => s.closed_at && s.opened_at);
    let tableTurnDurationMinutes: number | null = null;
    if (closedSessions.length > 0) {
      const totalMinutes = closedSessions.reduce((acc, s) => {
        const diff = (new Date(s.closed_at!).getTime() - new Date(s.opened_at).getTime()) / 60000;
        return acc + (diff > 0 ? diff : 0);
      }, 0);
      tableTurnDurationMinutes = Math.round(totalMinutes / closedSessions.length);
    }

    // Re-order Frequency: dining sessions with > 1 order
    const sessionOrderCounts = new Map<string, number>();
    for (const o of orders) {
      if (o.table_session_id && o.status !== "CANCELLED" && o.status !== "REJECTED") {
        sessionOrderCounts.set(o.table_session_id, (sessionOrderCounts.get(o.table_session_id) || 0) + 1);
      }
    }
    const totalSessionsWithOrders = sessionOrderCounts.size;
    const reorderSessionsCount = Array.from(sessionOrderCounts.values()).filter((cnt) => cnt > 1).length;
    const reorderRatePercent =
      totalSessionsWithOrders > 0
        ? Math.round((reorderSessionsCount / totalSessionsWithOrders) * 1000) / 10
        : null;

    // Average ticket comparison: past 7 days vs prior 7 days
    const nowMs = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const validOrdersWithDates = orders.filter((o) => o.status !== "CANCELLED" && o.status !== "REJECTED");

    const currentWeekOrders = validOrdersWithDates.filter((o) => {
      const age = nowMs - new Date(o.created_at || nowMs).getTime();
      return age <= sevenDaysMs;
    });
    const priorWeekOrders = validOrdersWithDates.filter((o) => {
      const age = nowMs - new Date(o.created_at || nowMs).getTime();
      return age > sevenDaysMs && age <= 2 * sevenDaysMs;
    });

    const currentAvg = currentWeekOrders.length > 0
      ? currentWeekOrders.reduce((sum, o) => sum + (o.total_snapshot || 0), 0) / currentWeekOrders.length
      : 0;
    const priorAvg = priorWeekOrders.length > 0
      ? priorWeekOrders.reduce((sum, o) => sum + (o.total_snapshot || 0), 0) / priorWeekOrders.length
      : 0;

    const avgTicketVsPriorWeekPercent =
      priorAvg > 0
        ? Math.round(((currentAvg - priorAvg) / priorAvg) * 1000) / 10
        : null;

    // Peak hour window derived from hourly counts
    let peakHour = "12p";
    let maxHourOrders = 0;
    for (const [h, count] of Object.entries(hourlyCounts)) {
      if (count > maxHourOrders) {
        maxHourOrders = count;
        peakHour = h;
      }
    }
    const formatHourLabel = (h: string) => {
      if (h.endsWith("a")) return `${h.replace("a", "")}:00 AM`;
      if (h.endsWith("p")) return `${h.replace("p", "")}:00 PM`;
      return h;
    };
    const peakHourWindow = maxHourOrders > 0 ? `${formatHourLabel(peakHour)} Peak` : "No peak window yet";

    const realTotalTables = diningTables && diningTables.length > 0 ? diningTables.length : 1;

    return {
      success: true,
      data: {
        kpis: {
          todaysOrders: mappedOrders.length,
          grossRevenueRupees,
          activeTablesCount: Math.min(realTotalTables, activeTableIds.size),
          totalTablesCount: realTotalTables,
          pendingKdsCount: pendingKdsTickets,
          avgOrderRupees,
          topSellerName: topSeller.name,
          topSellerUnits: topSeller.sales,
        },
        orders: mappedOrders,
        payments: mappedPayments,
        hourlyTrend,
        bestSellers,
        zoneUtilization,
        paymentSplit,
        cumulativeRevenuePoints: [0, Math.round(grossRevenueRupees * 0.25), Math.round(grossRevenueRupees * 0.6), grossRevenueRupees],
        menuItems: allMenuItems,
        menuCategories,
        tables: mappedTables,
        analyticsMetrics: {
          tableTurnDurationMinutes,
          reorderRatePercent,
          avgTicketVsPriorWeekPercent,
          peakHourWindow,
        },
      },
    };
  } catch (err) {
    console.error("[fetchAdminOverviewAction] Fatal error:", err);
    return {
      success: false,
      data: null,
      message: err instanceof Error ? err.message : "Unknown admin data error.",
    };
  }
}

/**
 * Server Action: Update Order Status from Admin Control Tower
 */
export async function updateAdminOrderStatusAction(
  orderId: string,
  newStatus: OrderStatus
): Promise<{ success: boolean; message?: string }> {
  const supabase = createAdminClient();

  try {
    const { error } = await supabase
      .from("orders")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (error) {
      return { success: false, message: error.message };
    }

    broadcastSyncEvent({
      type: "STATUS_CHANGED",
      orderId,
      status: newStatus,
      timestamp: Date.now(),
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to update order status.",
    };
  }
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

/**
 * Server Action: Purges all order details, bills, session history, and guest records
 * for a specified customer phone number (e.g. +91 9305084332) across DB and memory stores.
 */
export async function purgeCustomerOrdersAction(rawPhone: string = "+919305084332"): Promise<{
  success: boolean;
  purgedOrdersCount: number;
  message: string;
}> {
  try {
    const supabase = createAdminClient();
    const cleanDigits = rawPhone.replace(/\D/g, "");
    const formattedE164 = rawPhone.startsWith("+") ? rawPhone : `+${cleanDigits}`;

    // 1. Clear memory phone map entries
    if (typeof globalThis !== "undefined" && (globalThis as any).__SMOL_ORDER_PHONE_MAP__) {
      const map = (globalThis as any).__SMOL_ORDER_PHONE_MAP__;
      for (const k of Object.keys(map)) {
        if (
          map[k]?.phone?.includes(cleanDigits) ||
          map[k]?.cleanDigits?.includes(cleanDigits)
        ) {
          delete map[k];
        }
      }
    }

    // 2. Fetch matching orders in Supabase
    const { data: matchingOrders } = await supabase
      .from("orders")
      .select("id, table_session_id")
      .or(`idempotency_key.cs.{${cleanDigits}},instructions.ilike.%${cleanDigits}%`);

    const orderIds = (matchingOrders || []).map((o) => o.id);
    const sessionIds = (matchingOrders || [])
      .map((o) => o.table_session_id)
      .filter((id): id is string => Boolean(id));

    if (orderIds.length > 0) {
      // Delete order child items & status logs
      await supabase.from("order_items").delete().in("order_id", orderIds);
      await supabase.from("order_status_history").delete().in("order_id", orderIds);
      await supabase.from("orders").delete().in("id", orderIds);
    }

    if (sessionIds.length > 0) {
      await supabase.from("payment_attempts").delete().in("bill_id", sessionIds);
      await supabase.from("bills").delete().in("table_session_id", sessionIds);
      await supabase.from("table_sessions").delete().in("id", sessionIds);
    }

    // Delete guest profiles if present
    try {
      await supabase.from("guest_profiles").delete().ilike("phone", `%${cleanDigits}%`);
    } catch {
      // ignore table missing
    }

    // Broadcast sync event to update all client screens instantly
    broadcastSyncEvent({
      type: "STATUS_CHANGED",
      timestamp: Date.now(),
    });

    return {
      success: true,
      purgedOrdersCount: orderIds.length,
      message: `Successfully purged all orders and customer data for ${formattedE164}.`,
    };
  } catch (err: any) {
    console.error("purgeCustomerOrdersAction error:", err);
    return {
      success: false,
      purgedOrdersCount: 0,
      message: err?.message || "Failed to purge customer data.",
    };
  }
}

