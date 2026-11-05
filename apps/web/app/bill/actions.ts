"use server";

import { revalidatePath } from "next/cache";
import { getTableSessionCookie, isValidUuid } from "@/lib/session";
import { resolveQrToken } from "@/app/t/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffAuth } from "@/lib/auth/rbac";
import { broadcastSyncEvent } from "@/lib/sync-events";
import { invalidateAdminOverviewCache } from "@/app/admin/actions";
import { filterDeletedTables, getPersistedSectionsMap } from "@/lib/table-store";
import { normalizeTableLabel } from "@/lib/table-label";
import type { TableSessionStatus, OrderStatus } from "@smol-cafe/db";
import { getPhoneUuid, normalizePhoneNumber, doesOrderMatchCustomerPhone } from "@/lib/customer-phone";

export interface BillOrderRoundItem {
  id: string;
  name: string;
  qty: number;
  unitPricePaise: number;
  lineSubtotal: number;
}

export interface BillOrderRound {
  orderId: string;
  orderNo: number;
  status: OrderStatus;
  submittedAt: string | null;
  roundTotalPaise: number;
  items: BillOrderRoundItem[];
}

export interface RunningBillDetails {
  sessionId: string;
  sessionStatus: TableSessionStatus;
  tableLabel: string;
  locationName: string;
  openedAt: string;
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
  paidAmountPaise: number;
  balanceDuePaise: number;
  rounds: BillOrderRound[];
  guestName?: string;
  guestPhone?: string;
}

export interface FetchBillResult {
  success: boolean;
  hasSession: boolean;
  bill?: RunningBillDetails;
  message?: string;
}

export interface RecordCashPaymentResult {
  success: boolean;
  error?: string;
  message?: string;
  billId?: string;
  totalPaise?: number;
  tenderedPaise?: number;
  changePaise?: number;
}

const DEFAULT_ZONE_MAP: Record<string, string> = {
  "01": "smol-cafe",
  "02": "smol-cafe",
  "03": "smol-cafe",
  "04": "smol-cafe",
  "05": "smol-cafe",
  "06": "smol-cafe",
  "07": "smol-lounge",
  "08": "smol-lounge",
  "09": "smol-lounge",
  "10": "smol-lounge",
  "11": "smol-terrace",
  "12": "smol-terrace",
  "13": "smol-terrace",
  "14": "smol-terrace",
};

/**
 * Server Action: Fetches the running bill breakdown for the current customer session
 */
export async function fetchRunningBillAction(overridePhone?: string): Promise<FetchBillResult> {
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
      message: "No active dining session found.",
    };
  }

  const supabase = createAdminClient();

  try {
    // 1. Fetch current session status
    const { data: currentSession, error: sessionErr } = await supabase
      .from("table_sessions")
      .select("*")
      .eq("id", session.sessionId)
      .single();

    if (sessionErr || !currentSession) {
      return {
        success: false,
        hasSession: false,
        message: "Table session not found in database.",
      };
    }

    const cleanPhone = normalizePhoneNumber(overridePhone || session.guestPhone);
    const phoneUuid = cleanPhone ? getPhoneUuid(cleanPhone) : null;

    // 2. Fetch all orders for this table session
    let ordersQuery = supabase
      .from("orders")
      .select("*")
      .order("order_no", { ascending: true });

    if (phoneUuid) {
      ordersQuery = ordersQuery.or(`table_session_id.eq.${session.sessionId},customer_id.eq.${phoneUuid}`);
    } else {
      ordersQuery = ordersQuery.eq("table_session_id", session.sessionId);
    }

    const { data: rawOrders, error: ordersErr } = await ordersQuery;

    if (ordersErr) {
      console.error("Error fetching orders for bill:", ordersErr);
    }

    // Filter orders strictly for this customer's phone number
    const orders = (rawOrders || []).filter((o) => doesOrderMatchCustomerPhone(o, cleanPhone, session.sessionId));

    const orderIds = orders.map((o) => o.id);

    // 3. Fetch order items
    const itemsByOrder = new Map<string, BillOrderRoundItem[]>();

    if (orderIds.length > 0) {
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds);

      for (const item of (orderItems as Array<{
        id: string;
        order_id: string;
        name_snapshot: string;
        qty: number;
        unit_price_snapshot: number;
        line_subtotal: number;
      }>) || []) {
        if (!itemsByOrder.has(item.order_id)) {
          itemsByOrder.set(item.order_id, []);
        }
        itemsByOrder.get(item.order_id)!.push({
          id: item.id,
          name: item.name_snapshot,
          qty: item.qty,
          unitPricePaise: item.unit_price_snapshot,
          lineSubtotal: item.line_subtotal,
        });
      }
    }

    // 4. Calculate rounds and financial sums
    let subtotalPaise = 0;
    let taxPaise = 0;
    let totalPaise = 0;

    const rounds: BillOrderRound[] = (orders || [])
      .filter((o) => o.status !== "CANCELLED" && o.status !== "REJECTED")
      .map((o) => {
        subtotalPaise += o.subtotal_snapshot || 0;
        taxPaise += o.tax_snapshot || 0;
        totalPaise += o.total_snapshot || 0;

        return {
          orderId: o.id,
          orderNo: o.order_no,
          status: o.status,
          submittedAt: o.submitted_at,
          roundTotalPaise: o.total_snapshot || 0,
          items: itemsByOrder.get(o.id) || [],
        };
      });

    const paidAmountPaise = currentSession.status === "CLOSED" ? totalPaise : 0;
    const balanceDuePaise = totalPaise - paidAmountPaise;

    return {
      success: true,
      hasSession: true,
      bill: {
        sessionId: currentSession.id,
        sessionStatus: currentSession.status,
        tableLabel: session.tableLabel,
        locationName: session.locationName,
        openedAt: currentSession.opened_at,
        subtotalPaise,
        taxPaise,
        totalPaise,
        paidAmountPaise,
        balanceDuePaise,
        rounds,
        guestName: session.guestName,
        guestPhone: session.guestPhone,
      },
    };
  } catch (err) {
    console.error("Error in fetchRunningBillAction:", err);
    return {
      success: false,
      hasSession: true,
      message: "An unexpected error occurred while loading your bill.",
    };
  }
}

/**
 * Server Action: Customer requests bill, setting table_session status to PAYMENT_PENDING
 */
export async function requestBillAction(): Promise<{ success: boolean; message?: string }> {
  const session = await getTableSessionCookie();
  if (!session || !session.sessionId) {
    return { success: false, message: "No active session found." };
  }

  const supabase = createAdminClient();

  try {
    const { error } = await supabase
      .from("table_sessions")
      .update({
        status: "PAYMENT_PENDING",
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", session.sessionId)
      .eq("status", "OPEN");

    if (error) {
      console.error("Failed to request bill:", error);
      return { success: false, message: "Could not notify staff. Please call a server." };
    }

    return { success: true, message: "Bill requested! Staff is on the way." };
  } catch (err) {
    console.error("Error in requestBillAction:", err);
    return { success: false, message: "Unexpected error requesting bill." };
  }
}

export interface BypassPaymentResult {
  success: boolean;
  message?: string;
  billId?: string;
  orderId?: string;
  orderNo?: number;
  totalPaise?: number;
  transactionId?: string;
}

/**
 * Server Action: Bypass Payment (Test / Pre-Production Mode)
 * Instantly settles table session and marks orders as completed without gateway.
 */
export async function bypassPaymentAction(params?: {
  tableSessionId?: string;
  amountPaise?: number;
  tableLabel?: string;
}): Promise<BypassPaymentResult> {
  const auth = await requireStaffAuth(["cashier", "admin", "super_admin"]);
  if (!auth.authorized) {
    return { success: false, message: auth.message || "Unauthorized: Staff access required." };
  }

  let session = await getTableSessionCookie();

  if (!session || !session.sessionId || !isValidUuid(session.sessionId)) {
    const cleanTbl = params?.tableLabel
      ? params.tableLabel.toString().replace(/^(?:table|t)[-\s_]*/i, "").trim()
      : "01";
    const defaultRes = await resolveQrToken(
      `table-${/^\d+$/.test(cleanTbl) ? cleanTbl.padStart(2, "0") : cleanTbl}`,
      true
    );
    if (defaultRes.success && defaultRes.session && isValidUuid(defaultRes.session.sessionId)) {
      session = defaultRes.session;
    }
  }

  const rawSessionId = params?.tableSessionId || session?.sessionId;
  const sessionId = isValidUuid(rawSessionId) ? rawSessionId : undefined;
  const transactionId = `TEST-BYPASS-${Date.now().toString().slice(-6)}`;
  const now = new Date().toISOString();

  if (!sessionId) {
    return {
      success: true,
      transactionId,
      totalPaise: params?.amountPaise || 6300,
      message: "Test payment bypassed (simulated).",
    };
  }

  const supabase = createAdminClient();

  try {
    // 1. Fetch current session's orders to calculate total
    const { data: orders } = await supabase
      .from("orders")
      .select("id, total_snapshot, status, order_no")
      .eq("table_session_id", sessionId)
      .not("status", "in", '("CANCELLED","REJECTED")');

    let totalPaise = (orders || []).reduce((sum, o) => sum + (o.total_snapshot || 0), 0);
    if (totalPaise === 0 && params?.amountPaise) {
      totalPaise = params.amountPaise;
    }
    if (totalPaise === 0) {
      totalPaise = 6300;
    }

    // 2. Find or create bill record marked as PAID
    let billId: string | null = null;
    const { data: existingBill } = await supabase
      .from("bills")
      .select("id")
      .eq("table_session_id", sessionId)
      .maybeSingle();

    if (existingBill) {
      billId = existingBill.id;
      await supabase.from("bills").update({
        status: "PAID",
        paid_amount: totalPaise,
        total: totalPaise,
        closed_at: now,
      }).eq("id", billId);
    } else {
      const { data: newBill } = await supabase.from("bills").insert({
        table_session_id: sessionId,
        status: "PAID",
        subtotal: Math.round(totalPaise / 1.05),
        tax: Math.round(totalPaise - totalPaise / 1.05),
        total: totalPaise,
        paid_amount: totalPaise,
        closed_at: now,
      }).select("id").single();
      billId = newBill?.id || null;
    }

    // 3. Record payment attempt and mark orders as PAID
    if (billId) {
      await supabase.from("payment_attempts").insert({
        bill_id: billId,
        provider: "TEST_BYPASS",
        amount: totalPaise,
        currency: "INR",
        status: "CAPTURED",
        idempotency_key: `bypass_${transactionId}`,
        created_at: now,
        captured_at: now,
      });

      // Mark all session orders as confirmed & paid
      await supabase
        .from("orders")
        .update({
          payment_status: "PAID",
          payment_method: "UPI",
          status: "CONFIRMED",
          confirmed_at: now,
          confirmed_by: "Test Bypass Gateway (PAID)",
        })
        .eq("table_session_id", sessionId)
        .not("status", "in", '("CANCELLED","REJECTED")');
    }

    // 4. Touch table session activity timestamp (keep it OPEN so Cashier controls when table becomes available)
    await supabase
      .from("table_sessions")
      .update({
        status: "OPEN",
        last_activity_at: now,
      })
      .eq("id", sessionId);

    const latestOrder = (orders || [])[orders?.length ? orders.length - 1 : 0];

    return {
      success: true,
      billId: billId || `bill_${sessionId}`,
      orderId: latestOrder?.id,
      orderNo: latestOrder?.order_no,
      totalPaise,
      transactionId,
      message: "Test payment bypassed and session settled successfully!",
    };
  } catch (err) {
    console.error("Error in bypassPaymentAction:", err);
    return {
      success: true,
      transactionId,
      totalPaise: params?.amountPaise || 6300,
      message: "Test payment bypassed (fallback).",
    };
  }
}

/**
 * Server Action: Staff records cash payment and settles table session
 */
export async function recordCashPaymentAction(
  tableSessionId: string,
  amountTenderedPaise: number,
  staffIdentifier = "Staff",
  idempotencyKey?: string
): Promise<RecordCashPaymentResult> {
  const auth = await requireStaffAuth(["cashier", "admin", "super_admin"]);
  if (!auth.authorized) {
    return { success: false, error: "UNAUTHORIZED", message: auth.message || "Unauthorized: Cashier access required." };
  }

  const supabase = createAdminClient();

  try {
    const { data: rpcResult, error: rpcError } = await supabase.rpc("record_cash_payment", {
      p_table_session_id: tableSessionId,
      p_amount_tendered_paise: amountTenderedPaise,
      p_staff_identifier: staffIdentifier,
      p_idempotency_key: idempotencyKey || crypto.randomUUID(),
    });

    if (rpcError) {
      console.error("Error executing record_cash_payment RPC:", rpcError);
      return {
        success: false,
        error: "DB_ERROR",
        message: "Failed to record cash payment in database.",
      };
    }

    const result = rpcResult as {
      success: boolean;
      error?: string;
      message?: string;
      bill_id?: string;
      total_paise?: number;
      tendered_paise?: number;
      change_paise?: number;
    };

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        message: result.message || "Failed to settle payment.",
      };
    }

    void invalidateAdminOverviewCache();

    return {
      success: true,
      billId: result.bill_id,
      totalPaise: result.total_paise,
      tenderedPaise: result.tendered_paise,
      changePaise: result.change_paise,
      message: result.message,
    };
  } catch (err) {
    console.error("Unexpected error in recordCashPaymentAction:", err);
    return {
      success: false,
      error: "DB_ERROR",
      message: "An unexpected error occurred during cash settlement.",
    };
  }
}

export interface ActiveCashierTable {
  sessionId: string;
  sessionIds?: string[];
  tableId: string;
  tableLabel: string;
  section?: string;
  seats?: number;
  sessionStatus: TableSessionStatus;
  openedAt: string;
  orderCount: number;
  totalPaise: number;
  latestOrderNo?: number;
  latestOrderStatus?: string;
}

/**
 * Server Action: Fetches all occupied dining tables where a customer has placed at least one order
 * and the table session has not yet been marked available by the Cashier.
 */
export async function fetchActiveCashierTablesAction(): Promise<ActiveCashierTable[]> {
  const supabase = createAdminClient();

  try {
    // 1. Fetch all OPEN or PAYMENT_PENDING sessions
    const { data: sessions, error: sessionErr } = await supabase
      .from("table_sessions")
      .select("*")
      .in("status", ["OPEN", "PAYMENT_PENDING"])
      .order("opened_at", { ascending: false });

    if (sessionErr || !sessions || sessions.length === 0) {
      return [];
    }

    const sessionIds = sessions.map((s) => s.id);
    const tableIds = Array.from(new Set(sessions.map((s) => s.table_id).filter(Boolean)));

    // 2. Fetch dining tables & orders for these sessions in parallel
    const [tablesRes, ordersRes] = await Promise.all([
      tableIds.length > 0
        ? supabase.from("dining_tables").select("*").in("id", tableIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from("orders")
        .select("id, order_no, table_session_id, total_snapshot, status, created_at")
        .in("table_session_id", sessionIds)
        .order("created_at", { ascending: false }),
    ]);

    const activeDiningTables = filterDeletedTables(tablesRes.data || []);
    const tableInfoMap = new Map<
      string,
      { label: string; section: string; seats: number; active: boolean }
    >();
    const persistedSections = getPersistedSectionsMap();
    const globalSections = (globalThis as any).__SMOL_TABLE_SECTIONS_MAP__ || {};

    for (const t of activeDiningTables as any[]) {
      const cleanNum = (t.label || "").toString().padStart(2, "0");
      const section =
        t.section ||
        globalSections[t.id] ||
        globalSections[t.label] ||
        globalSections[cleanNum] ||
        persistedSections[t.id] ||
        persistedSections[t.label] ||
        persistedSections[cleanNum] ||
        DEFAULT_ZONE_MAP[cleanNum] ||
        "smol-cafe";
      const seats =
        t.seats ||
        (["07", "08", "09", "10", "13", "14"].includes(cleanNum) ? 4 : 2);

      tableInfoMap.set(t.id, {
        label: t.label,
        section,
        seats,
        active: t.active !== false,
      });
    }

    // 3. Compute order counts and totals per session (excluding CANCELLED and REJECTED orders)
    const sessionTotals = new Map<
      string,
      {
        count: number;
        totalPaise: number;
        latestOrderNo?: number;
        latestOrderStatus?: string;
      }
    >();

    for (const o of ordersRes.data || []) {
      if (o.status !== "CANCELLED" && o.status !== "REJECTED" && o.table_session_id) {
        if (!sessionTotals.has(o.table_session_id)) {
          sessionTotals.set(o.table_session_id, {
            count: 0,
            totalPaise: 0,
            latestOrderNo: o.order_no,
            latestOrderStatus: o.status,
          });
        }
        const st = sessionTotals.get(o.table_session_id)!;
        st.count += 1;
        st.totalPaise += o.total_snapshot || 0;
      }
    }

    // 4. Filter strictly to sessions where at least 1 order was placed by a customer,
    // and deduplicate by physical table so each occupied table appears once.
    const groupedByTable = new Map<string, ActiveCashierTable>();

    for (const s of sessions) {
      const stats = sessionTotals.get(s.id);
      // Only reflect in Dining Tables AFTER an order is placed by customer
      if (!stats || stats.count <= 0) {
        continue;
      }

      const tblInfo = tableInfoMap.get(s.table_id);
      if (tblInfo && !tblInfo.active) {
        continue;
      }

      const tableLabel = tblInfo?.label || "01";
      const tableKey = s.table_id || tableLabel.trim().toLowerCase();

      if (!groupedByTable.has(tableKey)) {
        groupedByTable.set(tableKey, {
          sessionId: s.id,
          sessionIds: [s.id],
          tableId: s.table_id,
          tableLabel,
          section: tblInfo?.section || "smol-cafe",
          seats: tblInfo?.seats || 4,
          sessionStatus: s.status,
          openedAt: s.opened_at,
          orderCount: stats.count,
          totalPaise: stats.totalPaise,
          latestOrderNo: stats.latestOrderNo,
          latestOrderStatus: stats.latestOrderStatus,
        });
      } else {
        const existing = groupedByTable.get(tableKey)!;
        existing.sessionIds = Array.from(new Set([...(existing.sessionIds || []), s.id]));
        existing.orderCount += stats.count;
        existing.totalPaise += stats.totalPaise;
        if (!existing.latestOrderNo && stats.latestOrderNo) {
          existing.latestOrderNo = stats.latestOrderNo;
          existing.latestOrderStatus = stats.latestOrderStatus;
        }
      }
    }

    return Array.from(groupedByTable.values());
  } catch (err) {
    console.error("Error in fetchActiveCashierTablesAction:", err);
    return [];
  }
}

/**
 * Server Action: Cashier marks an occupied dining table as Available once the table is empty.
 * Closes all active table_sessions for that table and synchronizes availability with Admin.
 */
export async function markTableAvailableAction(
  sessionId: string,
  tableId?: string,
  tableLabel?: string,
  staffName = "Cashier"
): Promise<{ success: boolean; message?: string }> {
  const auth = await requireStaffAuth(["cashier", "admin", "super_admin", "barista", "kitchen", "chef"]);
  if (!auth.authorized) {
    return {
      success: false,
      message: auth.message || "Unauthorized: Cashier access required.",
    };
  }

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  try {
    const targetTableIds = new Set<string>();
    if (tableId && tableId.trim()) {
      targetTableIds.add(tableId.trim());
    }

    let resolvedLabel = (tableLabel || "").trim();

    // 1. Look up session in table_sessions if sessionId provided
    if (sessionId && sessionId.trim()) {
      const { data: sessRow } = await supabase
        .from("table_sessions")
        .select("id, table_id")
        .eq("id", sessionId.trim())
        .maybeSingle();

      if (sessRow?.table_id) {
        targetTableIds.add(sessRow.table_id);
      }

      await supabase
        .from("table_sessions")
        .update({
          status: "CLOSED",
          closed_at: nowIso,
          last_activity_at: nowIso,
        })
        .eq("id", sessionId.trim());
    }

    // 2. Also resolve any matching dining_tables by label so all open sessions for this physical table are closed
    if (resolvedLabel) {
      const variations = normalizeTableLabel(resolvedLabel);
      const cleanRaw = resolvedLabel.replace(/^(?:table|t)[-\s_]*/i, "").trim();
      const candidateLabels = Array.from(
        new Set([resolvedLabel, cleanRaw, cleanRaw.padStart(2, "0"), ...variations].filter(Boolean))
      );

      const { data: matchingTables } = await supabase
        .from("dining_tables")
        .select("id, label")
        .in("label", candidateLabels);

      for (const mt of matchingTables || []) {
        if (mt.id) targetTableIds.add(mt.id);
        if (!resolvedLabel && mt.label) resolvedLabel = mt.label;
      }
    } else if (targetTableIds.size > 0) {
      const firstId = Array.from(targetTableIds)[0];
      const { data: tbl } = await supabase
        .from("dining_tables")
        .select("label")
        .eq("id", firstId)
        .maybeSingle();
      if (tbl?.label) {
        resolvedLabel = tbl.label;
      }
    }

    // 3. Close all OPEN or PAYMENT_PENDING sessions for the resolved table IDs
    const tableIdsArray = Array.from(targetTableIds);
    if (tableIdsArray.length > 0) {
      await supabase
        .from("table_sessions")
        .update({
          status: "CLOSED",
          closed_at: nowIso,
          last_activity_at: nowIso,
        })
        .in("table_id", tableIdsArray)
        .in("status", ["OPEN", "PAYMENT_PENDING"]);
    }

    const primaryTableId = tableIdsArray[0] || tableId || "";

    // 4. Invalidate Admin overview cache and broadcast real-time availability sync events
    await invalidateAdminOverviewCache();

    void broadcastSyncEvent({
      type: "TABLE_AVAILABILITY_CHANGED",
      tableId: primaryTableId,
      tableLabel: resolvedLabel,
      status: "AVAILABLE",
      timestamp: Date.now(),
      metadata: {
        id: primaryTableId,
        tableId: primaryTableId,
        label: resolvedLabel,
        isOccupied: false,
        sessionStatus: "CLOSED",
        staffName,
      },
    });

    void broadcastSyncEvent({
      type: "TABLE_RENAMED",
      tableId: primaryTableId,
      tableLabel: resolvedLabel,
      timestamp: Date.now(),
      metadata: {
        id: primaryTableId,
        label: resolvedLabel,
        isOccupied: false,
      },
    });

    void broadcastSyncEvent({
      type: "STATUS_CHANGED",
      tableId: primaryTableId,
      tableLabel: resolvedLabel,
      status: "AVAILABLE",
      timestamp: Date.now(),
    });

    try {
      revalidatePath("/cashier");
      revalidatePath("/smol-backdoor/cashier");
      revalidatePath("/admin");
      revalidatePath("/admin/tables");
      revalidatePath("/smol-backdoor/admin");
    } catch {
      // ignore outside request context
    }

    return {
      success: true,
      message: resolvedLabel
        ? `Table ${resolvedLabel} marked as available!`
        : "Table marked as available!",
    };
  } catch (err) {
    console.error("Error in markTableAvailableAction:", err);
    return {
      success: false,
      message: "Failed to mark table as available. Please try again.",
    };
  }
}

/**
 * Server Action: Allows Cashier to open/activate a table session for walk-in guests
 */
export async function openTableSessionAction(
  tableLabel: string
): Promise<{ success: boolean; message?: string }> {
  const cleanTbl = tableLabel.toString().replace(/^(?:table|t)[-\s_]*/i, "").trim();
  const token = `table-${/^\d+$/.test(cleanTbl) ? cleanTbl.padStart(2, "0") : cleanTbl}`;
  const res = await resolveQrToken(token, false);
  return {
    success: res.success,
    message: res.success ? `Table ${tableLabel} is now open.` : res.message,
  };
}
