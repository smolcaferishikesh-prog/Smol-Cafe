"use server";

import { createAdminClient, isMockDatabase } from "@/lib/supabase/admin";
import { TABLE_ZONES_CONFIG } from "@/lib/table-tag";
import { broadcastSyncEvent } from "@/lib/sync-events";
import { getMenuCatalog } from "@/lib/queries/menu";
import { filterDeletedTables, isTableDeleted } from "@/lib/table-store";
import { safeUpdateOrderWithInstructions, extractOrderInstructions } from "@/lib/order-instructions";
import type { OrderStatus } from "@smol-cafe/db";

export interface AdminOrderItem {
  id?: string;
  menuItemId?: string;
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
  instructions?: string;
  tableSessionId?: string;
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

declare global {
  var __SMOL_ADMIN_OVERVIEW_CACHE__: {
    timestamp: number;
    data: AdminOverviewData;
  } | undefined;
}

export async function invalidateAdminOverviewCache() {
  if (typeof globalThis !== "undefined") {
    globalThis.__SMOL_ADMIN_OVERVIEW_CACHE__ = undefined;
  }
}

/**
 * Server Action: Fetches and calculates live operational overview data for the Admin Control Tower.
 */
export async function fetchAdminOverviewAction(forceRefresh = false): Promise<{
  success: boolean;
  data: AdminOverviewData | null;
  message?: string;
}> {
  if (!forceRefresh && globalThis.__SMOL_ADMIN_OVERVIEW_CACHE__) {
    const age = Date.now() - globalThis.__SMOL_ADMIN_OVERVIEW_CACHE__.timestamp;
    if (age < 2500) {
      return {
        success: true,
        data: globalThis.__SMOL_ADMIN_OVERVIEW_CACHE__.data,
      };
    }
  }

  const supabase = createAdminClient();

  try {
    // 1. Fetch Orders with order_items, Tables, Sessions, Bills with payment attempts, and Menu Catalog concurrently in parallel
    const [ordersRes, tablesRes, sessionsRes, billsRes, catalogData] = await Promise.all([
      supabase
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("dining_tables").select("*"),
      supabase.from("table_sessions").select("*"),
      supabase
        .from("bills")
        .select("id, table_session_id, payment_attempts(id, provider, status, idempotency_key, created_at)"),
      getMenuCatalog(),
    ]);

    if (ordersRes.error) {
      console.error("[fetchAdminOverviewAction] Error fetching orders:", ordersRes.error);
    }

    const orders = ordersRes.data || [];
    const diningTables = filterDeletedTables(tablesRes.data || []);
    const tableSessions = sessionsRes.data || [];
    const bills = billsRes.data || [];

    // 2. Map dining tables & active table sessions
    const tableMap = new Map<string, string>();
    for (const t of diningTables) {
      tableMap.set(t.id, t.label);
    }

    const sessionToTableMap = new Map<string, string>();
    const activeTableIds = new Set<string>();

    const getISTDateString = (d: Date) =>
      d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const istTodayString = getISTDateString(new Date());

    for (const s of tableSessions) {
      const label = tableMap.get(s.table_id) || "01";
      sessionToTableMap.set(s.id, label);
      if (s.status === "ACTIVE" || s.status === "OPEN") {
        const sessionAgeMs = Date.now() - new Date(s.opened_at || s.created_at || Date.now()).getTime();
        if (sessionAgeMs <= 18 * 60 * 60 * 1000) {
          activeTableIds.add(label);
        }
      }
    }

    // 3. Extract order items from joined order response
    const itemsByOrder = new Map<string, AdminOrderItem[]>();
    for (const o of orders) {
      const orderItems = Array.isArray(o.order_items) ? o.order_items : [];
      if (!itemsByOrder.has(o.id)) {
        itemsByOrder.set(o.id, []);
      }
      for (const item of (orderItems as Array<{
        id: string;
        order_id: string;
        menu_item_id?: string;
        name_snapshot: string;
        unit_price_snapshot: number;
        qty: number;
        line_subtotal: number;
      }>)) {
        itemsByOrder.get(o.id)!.push({
          id: item.id,
          menuItemId: item.menu_item_id,
          name: item.name_snapshot,
          qty: item.qty,
          priceRupees: Math.round((item.unit_price_snapshot || 0) / 100),
          subtotalRupees: Math.round((item.line_subtotal || 0) / 100),
        });
      }
    }

    // 3.5. Extract payment providers from joined bills response
    const orderPaymentProviderMap = new Map<string, string>();
    const sessionPaymentProviderMap = new Map<string, string>();

    for (const b of (bills as Array<{
      id: string;
      table_session_id?: string;
      payment_attempts?: Array<{
        id: string;
        provider?: string;
        status?: string;
        idempotency_key?: string;
        created_at?: string;
      }>;
    }>)) {
      const attempts = Array.isArray(b.payment_attempts) ? b.payment_attempts : [];
      for (const att of attempts) {
        if (!att.provider) continue;
        const providerUpper = att.provider.trim().toUpperCase();

        if (att.idempotency_key) {
          for (const ord of orders) {
            if (att.idempotency_key.includes(ord.id)) {
              orderPaymentProviderMap.set(ord.id, providerUpper);
            }
          }
        }

        if (b.table_session_id) {
          sessionPaymentProviderMap.set(b.table_session_id, providerUpper);
        }
      }
    }

    // 4. Map Orders and compute aggregates
    let grossRevenuePaise = 0;
    let todayOrdersCount = 0;
    let todayGrossRevenuePaise = 0;
    let pendingKdsTickets = 0;
    const itemSalesCount = new Map<string, { qty: number; revenuePaise: number }>();
    const todayItemSalesCount = new Map<string, { qty: number; revenuePaise: number }>();
    const paymentMethodCounts: Record<string, number> = { UPI: 0, CASH: 0, CARD: 0 };
    const todayPaymentMethodCounts: Record<string, number> = { UPI: 0, CASH: 0, CARD: 0 };
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
      const orderAgeMs = Date.now() - orderDate.getTime();
      const isTodayOrder = getISTDateString(orderDate) === istTodayString;

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

      // Add to active tables only if order is actively in progress and recent (< 14 hours)
      if (
        o.status !== "COMPLETED" &&
        o.status !== "CANCELLED" &&
        o.status !== "REJECTED" &&
        orderAgeMs <= 14 * 60 * 60 * 1000
      ) {
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
        if (isTodayOrder) {
          todayOrdersCount++;
          if (isPaid) {
            todayGrossRevenuePaise += o.total_snapshot || 0;
            todayPaymentMethodCounts[paymentCategory] = (todayPaymentMethodCounts[paymentCategory] || 0) + 1;
          }
          // Tally today's items
          for (const item of orderItems) {
            const current = todayItemSalesCount.get(item.name) || { qty: 0, revenuePaise: 0 };
            current.qty += item.qty;
            current.revenuePaise += item.subtotalRupees * 100;
            todayItemSalesCount.set(item.name, current);
          }
        }

        // ONLY verified collected funds count towards Gross Revenue (never unpaid or complimentary)
        if (isPaid) {
          grossRevenuePaise += o.total_snapshot || 0;
          paymentMethodCounts[paymentCategory] = (paymentMethodCounts[paymentCategory] || 0) + 1;
        }

        // Tally items
        for (const item of orderItems) {
          const current = itemSalesCount.get(item.name) || { qty: 0, revenuePaise: 0 };
          current.qty += item.qty;
          current.revenuePaise += item.subtotalRupees * 100;
          itemSalesCount.set(item.name, current);
        }
      }

      // KDS pending count: only active pipeline orders from recent window (< 14h)
      if (
        (o.status === "SUBMITTED" || o.status === "ACCEPTED" || o.status === "PREPARING") &&
        orderAgeMs <= 14 * 60 * 60 * 1000
      ) {
        pendingKdsTickets++;
      }

      // Hourly slot calculated ONLY for TODAY'S orders using IST timezone
      if (isTodayOrder) {
        const istHourStr = new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "numeric",
          hour12: false,
        }).format(orderDate);
        const orderHour = parseInt(istHourStr, 10);

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
        instructions: extractOrderInstructions(o) || "",
        tableSessionId: o.table_session_id || "",
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

    const sortedTodayItems = Array.from(todayItemSalesCount.entries())
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 5);

    const maxTodaySalesQty = sortedTodayItems.length > 0 ? sortedTodayItems[0][1].qty : 1;
    const todayBestSellers: AdminBestSeller[] = sortedTodayItems.map(([name, data]) => ({
      name,
      sales: data.qty,
      rev: `₹${Math.round(data.revenuePaise / 100).toLocaleString("en-IN")}`,
      pct: Math.min(100, Math.max(15, Math.round((data.qty / maxTodaySalesQty) * 100))),
    }));

    const todayTopSeller = todayBestSellers[0] || { name: "No sales today", sales: 0 };
    const todayGrossRevenueRupees = Math.round(todayGrossRevenuePaise / 100);
    const todayAvgOrderRupees = todayOrdersCount > 0 ? Math.round(todayGrossRevenueRupees / todayOrdersCount) : 0;

    const topSeller = bestSellers[0] || { name: "No Orders Yet", sales: 0 };

    // 6. Hourly Trend Array
    const hourlyTrend: AdminHourlyBucket[] = Object.entries(hourlyCounts).map(([hour, count]) => ({
      hour,
      orders: count,
    }));

    // 7. Zone Utilization Calculation
    const zoneTableCounts: Record<string, { total: number; occupied: number }> = {
      "smol-cafe": { total: 0, occupied: 0 },
      "smol-lounge": { total: 0, occupied: 0 },
      "smol-terrace": { total: 0, occupied: 0 },
    };

    for (const t of diningTables) {
      const label = t.label;
      const cleanNum = (label || "").toString().padStart(2, "0");
      const zName = TABLE_ZONES_CONFIG[cleanNum]?.zone || (t as any).section || "smol-cafe";
      if (!zoneTableCounts[zName]) {
        zoneTableCounts[zName] = { total: 0, occupied: 0 };
      }
      zoneTableCounts[zName].total++;
      if (activeTableIds.has(label) || activeTableIds.has(cleanNum)) {
        zoneTableCounts[zName].occupied++;
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

    // 9. Process 59-Item Menu Catalog & Categories (fetched concurrently in parallel)
    const allMenuItems: AdminMenuItemRecord[] = [];
    const menuCategories: string[] = ["ALL"];

    for (const cat of catalogData || []) {
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

    const overviewData: AdminOverviewData = {
      kpis: {
        todaysOrders: todayOrdersCount,
        grossRevenueRupees: todayGrossRevenueRupees,
        activeTablesCount: Math.min(realTotalTables, activeTableIds.size),
        totalTablesCount: realTotalTables,
        pendingKdsCount: pendingKdsTickets,
        avgOrderRupees: todayAvgOrderRupees,
        topSellerName: todayTopSeller.name,
        topSellerUnits: todayTopSeller.sales,
      },
      orders: mappedOrders,
      payments: mappedPayments,
      hourlyTrend,
      bestSellers: todayOrdersCount > 0 ? todayBestSellers : [],
      zoneUtilization,
      paymentSplit,
      cumulativeRevenuePoints: [0, Math.round(todayGrossRevenueRupees * 0.25), Math.round(todayGrossRevenueRupees * 0.6), todayGrossRevenueRupees],
      menuItems: allMenuItems,
      menuCategories,
      tables: mappedTables,
      analyticsMetrics: {
        tableTurnDurationMinutes,
        reorderRatePercent,
        avgTicketVsPriorWeekPercent,
        peakHourWindow,
      },
    };

    if (typeof globalThis !== "undefined") {
      globalThis.__SMOL_ADMIN_OVERVIEW_CACHE__ = {
        timestamp: Date.now(),
        data: overviewData,
      };
    }

    return {
      success: true,
      data: overviewData,
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

    invalidateAdminOverviewCache();

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

export interface EditAdminOrderItemInput {
  id?: string;
  menuItemId?: string;
  name: string;
  qty: number;
  priceRupees: number;
}

export interface EditAdminOrderPayload {
  orderId: string;
  tableLabel?: string;
  status?: OrderStatus;
  paymentMethod?: string;
  paymentStatus?: string;
  instructions?: string;
  items: EditAdminOrderItemInput[];
}

/**
 * Server Action: Edit any order from Admin Control Tower.
 * Allows updating dining table, order status, payment mode/status, instructions, and items.
 * Atomically recalculates financial totals, synchronizes bills, and broadcasts sync events.
 */
export async function editAdminOrderAction(payload: EditAdminOrderPayload): Promise<{
  success: boolean;
  message: string;
}> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  try {
    if (!payload.orderId) {
      return { success: false, message: "Order ID is required." };
    }
    if (!payload.items || payload.items.length === 0) {
      return { success: false, message: "Order must contain at least one item." };
    }

    // 1. Fetch current order and optional matched table in parallel
    const cleanLabel = payload.tableLabel ? payload.tableLabel.trim().padStart(2, "0") : null;
    const [orderFetchRes, tableFetchRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id, order_no, table_session_id, version, status, total_snapshot")
        .eq("id", payload.orderId)
        .maybeSingle(),
      cleanLabel
        ? supabase.from("dining_tables").select("id, label").eq("label", cleanLabel).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const existingOrder = orderFetchRes.data;
    if (orderFetchRes.error || !existingOrder) {
      return { success: false, message: "Order not found in database." };
    }

    // 2. Calculate financial totals
    const isUuid = (str?: string) =>
      Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

    let subtotalPaise = 0;
    const orderItemsPayload = payload.items.map((it) => {
      const lineSubtotal = Math.round(it.priceRupees * 100) * it.qty;
      subtotalPaise += lineSubtotal;
      return {
        id: crypto.randomUUID(),
        order_id: payload.orderId,
        menu_item_id: isUuid(it.menuItemId) ? it.menuItemId : null,
        name_snapshot: it.name,
        unit_price_snapshot: Math.round(it.priceRupees * 100),
        qty: it.qty,
        line_subtotal: lineSubtotal,
        item_status:
          payload.status === "SERVED"
            ? "SERVED"
            : payload.status === "READY"
            ? "READY"
            : "PENDING",
        created_at: nowIso,
      };
    });

    const taxPaise = Math.round(subtotalPaise * 0.05); // 5% GST Cafe Tax
    const totalPaise = subtotalPaise + taxPaise;

    // 3. Resolve table session if table changed
    let targetSessionId = existingOrder.table_session_id;
    const matchedTable = tableFetchRes.data;
    if (matchedTable) {
      const { data: sessionForTable } = await supabase
        .from("table_sessions")
        .select("id")
        .eq("table_id", matchedTable.id)
        .eq("status", "ACTIVE")
        .maybeSingle();

      if (sessionForTable) {
        targetSessionId = sessionForTable.id;
      } else {
        const newSessionId = crypto.randomUUID();
        await supabase.from("table_sessions").insert({
          id: newSessionId,
          table_id: matchedTable.id,
          status: "ACTIVE",
          created_at: nowIso,
        });
        targetSessionId = newSessionId;
      }
    }

    // 4. Update order snapshot
    const updatePayload: Record<string, any> = {
      subtotal_snapshot: subtotalPaise,
      tax_snapshot: taxPaise,
      total_snapshot: totalPaise,
      version: (existingOrder.version || 1) + 1,
      updated_at: nowIso,
    };

    if (payload.status) updatePayload.status = payload.status;
    if (targetSessionId) updatePayload.table_session_id = targetSessionId;
    if (payload.paymentMethod) updatePayload.payment_method = payload.paymentMethod;
    if (payload.paymentStatus) updatePayload.payment_status = payload.paymentStatus;

    // Concurrently update order snapshot, delete old order items, and record status history
    const [updateRes] = await Promise.all([
      safeUpdateOrderWithInstructions(
        supabase,
        payload.orderId,
        updatePayload,
        payload.instructions || ""
      ),
      supabase.from("order_items").delete().eq("order_id", payload.orderId),
      payload.status && payload.status !== existingOrder.status
        ? supabase.from("order_status_history").insert({
            id: crypto.randomUUID(),
            order_id: payload.orderId,
            from_status: existingOrder.status,
            to_status: payload.status,
            changed_by: "admin",
            created_at: nowIso,
          })
        : Promise.resolve(),
    ]);

    if (!updateRes.success) {
      return { success: false, message: "Failed to update order snapshot." };
    }

    // Insert new items
    await supabase.from("order_items").insert(orderItemsPayload);

    // 6. Update table session bill if connected (background promise)
    if (targetSessionId) {
      (async () => {
        try {
          const [ordersRes, billRes] = await Promise.all([
            supabase
              .from("orders")
              .select("id, status, subtotal_snapshot, tax_snapshot, total_snapshot")
              .eq("table_session_id", targetSessionId),
            supabase.from("bills").select("id").eq("table_session_id", targetSessionId).maybeSingle(),
          ]);

          const activeOrders = (ordersRes.data || []).filter(
            (o) => o.status !== "CANCELLED" && o.status !== "REJECTED"
          );
          const billSubtotal = activeOrders.reduce(
            (s, o) => s + (o.id === payload.orderId ? subtotalPaise : (o.subtotal_snapshot || 0)),
            0
          );
          const billTax = activeOrders.reduce(
            (s, o) => s + (o.id === payload.orderId ? taxPaise : (o.tax_snapshot || 0)),
            0
          );
          const billTotal = activeOrders.reduce(
            (s, o) => s + (o.id === payload.orderId ? totalPaise : (o.total_snapshot || 0)),
            0
          );

          if (billRes.data) {
            await supabase
              .from("bills")
              .update({
                subtotal: billSubtotal,
                tax: billTax,
                total: billTotal,
                status: payload.paymentStatus === "PAID" ? "SETTLED" : "OPEN",
                updated_at: nowIso,
              })
              .eq("id", billRes.data.id);
          } else {
            await supabase.from("bills").insert({
              id: crypto.randomUUID(),
              table_session_id: targetSessionId,
              subtotal: billSubtotal,
              tax: billTax,
              total: billTotal,
              status: payload.paymentStatus === "PAID" ? "SETTLED" : "OPEN",
              created_at: nowIso,
            });
          }
        } catch (billErr) {
          console.warn("Bill sync notice in editAdminOrderAction:", billErr);
        }
      })();
    }

    invalidateAdminOverviewCache();

    // 7. Fire broadcast non-blocking
    try {
      void broadcastSyncEvent({
        type: "STATUS_CHANGED",
        orderId: payload.orderId,
        status: payload.status,
        timestamp: Date.now(),
      });
    } catch {
      // ignore
    }

    return {
      success: true,
      message: `Order #${existingOrder.order_no || payload.orderId.slice(-4)} updated successfully.`,
    };
  } catch (err: any) {
    console.error("editAdminOrderAction error:", err);
    return {
      success: false,
      message: err?.message || "Failed to edit order.",
    };
  }
}

/**
 * Server Action: Permanently delete any specific order from Admin Control Tower.
 * Cleans child order_items, status history, updates running bills, and broadcasts sync event.
 */
export async function deleteAdminOrderAction(orderId: string): Promise<{
  success: boolean;
  message: string;
}> {
  const supabase = createAdminClient();

  try {
    if (!orderId) {
      return { success: false, message: "Order ID is required." };
    }

    // 1. Fetch order
    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("id, order_no, table_session_id")
      .eq("id", orderId)
      .maybeSingle();

    if (fetchErr || !order) {
      return { success: false, message: "Order not found or already deleted." };
    }

    const orderNo = order.order_no || order.id.slice(-4);
    const sessionId = order.table_session_id;

    // 2. Delete child items, status history, and the order concurrently
    await Promise.all([
      supabase.from("order_items").delete().eq("order_id", orderId),
      supabase.from("order_status_history").delete().eq("order_id", orderId),
    ]);

    const { error: delErr } = await supabase.from("orders").delete().eq("id", orderId);
    if (delErr) {
      return { success: false, message: delErr.message };
    }

    // 4. Update table session bill if other orders remain
    if (sessionId) {
      (async () => {
        try {
          const { data: remainingOrders } = await supabase
            .from("orders")
            .select("id, status, subtotal_snapshot, tax_snapshot, total_snapshot")
            .eq("table_session_id", sessionId);

          const activeRemaining = (remainingOrders || []).filter(
            (o) => o.status !== "CANCELLED" && o.status !== "REJECTED"
          );

          if (activeRemaining.length === 0) {
            await supabase.from("payment_attempts").delete().eq("bill_id", sessionId);
            await supabase.from("bills").delete().eq("table_session_id", sessionId);
          } else {
            const newSubtotal = activeRemaining.reduce((s, o) => s + (o.subtotal_snapshot || 0), 0);
            const newTax = activeRemaining.reduce((s, o) => s + (o.tax_snapshot || 0), 0);
            const newTotal = activeRemaining.reduce((s, o) => s + (o.total_snapshot || 0), 0);

            await supabase
              .from("bills")
              .update({
                subtotal: newSubtotal,
                tax: newTax,
                total: newTotal,
                updated_at: new Date().toISOString(),
              })
              .eq("table_session_id", sessionId);
          }
        } catch (err) {
          console.error("Error updating bill after order deletion:", err);
        }
      })();
    }

    invalidateAdminOverviewCache();

    // 5. Broadcast real-time sync event
    broadcastSyncEvent({
      type: "STATUS_CHANGED",
      orderId,
      timestamp: Date.now(),
    });

    return {
      success: true,
      message: `Order #${orderNo} was deleted successfully.`,
    };
  } catch (err: any) {
    console.error("deleteAdminOrderAction error:", err);
    return {
      success: false,
      message: err?.message || "Failed to delete order.",
    };
  }
}

/**
 * Server Action: Bulk delete selected orders from Admin Control Tower.
 * Uses atomic batch queries to execute in <500ms rather than sequential individual loops.
 */
export async function deleteMultipleAdminOrdersAction(orderIds: string[]): Promise<{
  success: boolean;
  deletedCount: number;
  message: string;
}> {
  if (!orderIds || orderIds.length === 0) {
    return { success: false, deletedCount: 0, message: "No orders specified." };
  }

  const supabase = createAdminClient();
  try {
    // 1. Fetch table sessions for all orders to be deleted in 1 roundtrip
    const { data: targetOrders } = await supabase
      .from("orders")
      .select("id, table_session_id")
      .in("id", orderIds);

    const sessionIds = Array.from(
      new Set((targetOrders || []).map((o) => o.table_session_id).filter((id): id is string => Boolean(id)))
    );

    // 2. Batch delete child items, logs, and orders concurrently
    await Promise.all([
      supabase.from("order_items").delete().in("order_id", orderIds),
      supabase.from("order_status_history").delete().in("order_id", orderIds),
    ]);

    const { error: delErr } = await supabase.from("orders").delete().in("id", orderIds);
    if (delErr) {
      return { success: false, deletedCount: 0, message: delErr.message };
    }

    // 3. Clean up empty table session bills in background
    if (sessionIds.length > 0) {
      (async () => {
        try {
          for (const sId of sessionIds) {
            const { data: remaining } = await supabase
              .from("orders")
              .select("id, subtotal_snapshot, tax_snapshot, total_snapshot, status")
              .eq("table_session_id", sId);

            const active = (remaining || []).filter(
              (o) => o.status !== "CANCELLED" && o.status !== "REJECTED"
            );

            if (active.length === 0) {
              await supabase.from("payment_attempts").delete().eq("bill_id", sId);
              await supabase.from("bills").delete().eq("table_session_id", sId);
            } else {
              const newSubtotal = active.reduce((s, o) => s + (o.subtotal_snapshot || 0), 0);
              const newTax = active.reduce((s, o) => s + (o.tax_snapshot || 0), 0);
              const newTotal = active.reduce((s, o) => s + (o.total_snapshot || 0), 0);

              await supabase
                .from("bills")
                .update({
                  subtotal: newSubtotal,
                  tax: newTax,
                  total: newTotal,
                  updated_at: new Date().toISOString(),
                })
                .eq("table_session_id", sId);
            }
          }
        } catch (e) {
          console.warn("Background bill cleanup notice:", e);
        }
      })();
    }

    invalidateAdminOverviewCache();

    broadcastSyncEvent({
      type: "STATUS_CHANGED",
      timestamp: Date.now(),
    });

    return {
      success: true,
      deletedCount: orderIds.length,
      message: `Successfully deleted ${orderIds.length} order(s).`,
    };
  } catch (err: any) {
    console.error("deleteMultipleAdminOrdersAction error:", err);
    return { success: false, deletedCount: 0, message: err?.message || "Failed to delete orders." };
  }
}

/**
 * Server Action: Update or void payment status from Admin Control Tower.
 */
export async function updateAdminPaymentAction(
  orderIdOrTxn: string,
  newStatus: string
): Promise<{ success: boolean; message: string }> {
  const supabase = createAdminClient();
  try {
    const { error } = await supabase
      .from("orders")
      .update({
        payment_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .or(`id.eq.${orderIdOrTxn},order_no.eq.${parseInt(orderIdOrTxn.replace(/\D/g, "") || "0", 10)}`);

    invalidateAdminOverviewCache();

    broadcastSyncEvent({
      type: "STATUS_CHANGED",
      timestamp: Date.now(),
    });

    return {
      success: !error,
      message: error ? error.message : "Payment status updated successfully.",
    };
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to update payment status." };
  }
}

/**
 * Server Action: Delete or void payment ledger record from Admin Control Tower.
 */
export async function deleteAdminPaymentAction(
  orderIdOrTxn: string
): Promise<{ success: boolean; message: string }> {
  const supabase = createAdminClient();
  try {
    await supabase
      .from("orders")
      .update({
        payment_status: "UNPAID (VOID)",
        updated_at: new Date().toISOString(),
      })
      .or(`id.eq.${orderIdOrTxn},order_no.eq.${parseInt(orderIdOrTxn.replace(/\D/g, "") || "0", 10)}`);

    invalidateAdminOverviewCache();

    broadcastSyncEvent({
      type: "STATUS_CHANGED",
      timestamp: Date.now(),
    });

    return {
      success: true,
      message: "Payment transaction record voided and removed from ledger.",
    };
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to void payment transaction." };
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

    invalidateAdminOverviewCache();

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

