/**
 * Smol Café — Universal In-Memory Mock Database & Supabase Adapter
 * Provides full PostgREST fluent query chaining, relation resolution,
 * and PL/pgSQL RPC parity for local development & offline evaluation.
 */

import {
  MOCK_LOCATION,
  MOCK_TABLES,
  MOCK_QR_TOKENS,
  MOCK_CATEGORIES,
  MOCK_MENU_ITEMS,
  MOCK_MENU_VERSIONS,
  MOCK_MENU_PRICES,
  MOCK_BLACKBOARD_POSTS,
  MOCK_CAFE_EVENTS,
  MOCK_EVENT_RSVPS,
  MOCK_MUSIC_SESSION,
  MOCK_SONG_REQUESTS,
  MOCK_REWARDS,
  MOCK_VENDORS,
  MOCK_BUDGETS,
  MOCK_INGREDIENTS,
  type MockDiningTable,
  type MockTableQrToken,
  type MockMenuCategory,
  type MockMenuItem,
  type MockMenuItemVersion,
  type MockMenuPrice,
  type MockBlackboardPost,
  type MockCafeEvent,
  type MockEventRsvp,
  type MockMusicSession,
  type MockSongRequest,
  type MockReward,
  type MockVendor,
  type MockBudget,
  type MockIngredient,
} from "./seedData";

export interface MockTableSession {
  id: string;
  location_id: string;
  table_id: string;
  status: "OPEN" | "PAYMENT_PENDING" | "CLOSED";
  opened_at: string;
  closed_at: string | null;
  guest_count: number;
  bill_id: string | null;
  session_token_version: number;
  last_activity_at: string;
  created_at: string;
}

export interface MockOrder {
  id: string;
  location_id: string;
  table_session_id: string | null;
  customer_session_id?: string | null;
  verification_code?: string | null;
  order_no: number;
  status:
    | "DRAFT"
    | "PENDING_CONFIRMATION"
    | "SUBMITTED"
    | "CONFIRMED"
    | "ACCEPTED"
    | "PREPARING"
    | "READY"
    | "COMPLETED"
    | "SERVED"
    | "CANCELLED"
    | "REJECTED";
  service_mode: string;
  instructions?: string | null;
  submitted_at: string | null;
  confirmed_at?: string | null;
  confirmed_by?: string | null;
  accepted_at: string | null;
  ready_at: string | null;
  served_at: string | null;
  predicted_ready_at: string | null;
  eta_min_minutes: number | null;
  eta_max_minutes: number | null;
  subtotal_snapshot: number;
  tax_snapshot: number;
  total_snapshot: number;
  idempotency_key: string;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface MockOrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  menu_item_version_id: string | null;
  name_snapshot: string;
  unit_price_snapshot: number;
  qty: number;
  line_subtotal: number;
  item_status: string;
  created_at: string;
}

export interface MockOrderStatusHistory {
  id: string;
  order_id: string;
  from_status: string | null;
  to_status: string;
  actor_type: string;
  actor_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface MockBill {
  id: string;
  table_session_id: string;
  status: "UNPAID" | "PENDING" | "PAID";
  subtotal: number;
  tax: number;
  total: number;
  paid_amount: number;
  created_at: string;
  closed_at: string | null;
}

export interface MockPaymentAttempt {
  id: string;
  bill_id: string;
  provider: string;
  amount: number;
  currency: string;
  status: "PENDING" | "AUTHORIZED" | "CAPTURED" | "FAILED" | "REFUNDED";
  idempotency_key: string;
  created_at: string;
  captured_at: string | null;
}

export interface MockProfile {
  id: string;
  phone: string;
  full_name: string | null;
  current_balance_cached: number;
  created_at: string;
}

export interface MockLoyaltyLedger {
  id: string;
  profile_id: string;
  points_change: number;
  reason: string;
  reference_order_id: string | null;
  created_at: string;
}

class MockDatabaseStore {
  locations = [MOCK_LOCATION];
  dining_tables: MockDiningTable[] = [...MOCK_TABLES];
  table_qr_tokens: MockTableQrToken[] = [...MOCK_QR_TOKENS];
  table_sessions: MockTableSession[] = [];
  menu_categories: MockMenuCategory[] = [...MOCK_CATEGORIES];
  menu_items: MockMenuItem[] = [...MOCK_MENU_ITEMS];
  menu_item_versions: MockMenuItemVersion[] = [...MOCK_MENU_VERSIONS];
  menu_prices: MockMenuPrice[] = [...MOCK_MENU_PRICES];
  orders: MockOrder[] = [];
  order_items: MockOrderItem[] = [];
  order_status_history: MockOrderStatusHistory[] = [];
  bills: MockBill[] = [];
  payment_attempts: MockPaymentAttempt[] = [];
  blackboard_posts: MockBlackboardPost[] = [...MOCK_BLACKBOARD_POSTS];
  cafe_events: MockCafeEvent[] = [...MOCK_CAFE_EVENTS];
  event_rsvps: MockEventRsvp[] = [...MOCK_EVENT_RSVPS];
  music_sessions: MockMusicSession[] = [{ ...MOCK_MUSIC_SESSION }];
  song_requests: MockSongRequest[] = [...MOCK_SONG_REQUESTS];
  song_votes: Array<{ id: string; song_request_id: string; table_session_id: string; created_at: string }> = [];
  rewards: MockReward[] = [...MOCK_REWARDS];
  reward_redemptions: Array<{ id: string; reward_id: string; order_id: string; profile_id: string | null; discount_paise: number; created_at: string }> = [];
  vendors: MockVendor[] = [...MOCK_VENDORS];
  budgets: MockBudget[] = [...MOCK_BUDGETS];
  ingredients: MockIngredient[] = [...MOCK_INGREDIENTS];
  profiles: MockProfile[] = [];
  loyalty_ledger: MockLoyaltyLedger[] = [];

  private orderCounter = 100;

  constructor() {
    this.seedInitialSessionAndOrder();
  }

  private seedInitialSessionAndOrder() {
    // Seed Table 01 as an open active session with a sample ticket for immediate KDS & Live Status visibility
    const session1Id = "ses_tbl_01_init";
    const now = new Date().toISOString();
    const table01 = this.dining_tables.find((t) => t.label === "01") || this.dining_tables[0];

    const session: MockTableSession = {
      id: session1Id,
      location_id: MOCK_LOCATION.id,
      table_id: table01.id,
      status: "OPEN",
      opened_at: now,
      closed_at: null,
      guest_count: 2,
      bill_id: null,
      session_token_version: 1,
      last_activity_at: now,
      created_at: now,
    };
    this.table_sessions.push(session);

    // Initial Order #101 on Table 01
    const order1Id = "ord_init_101";
    const bunItem = this.menu_items.find((i) => i.name.includes("Bun Makkhan")) || this.menu_items[0];
    const chaiItem = this.menu_items.find((i) => i.name.includes("Smol Chai")) || this.menu_items[1];

    const order: MockOrder = {
      id: order1Id,
      location_id: MOCK_LOCATION.id,
      table_session_id: session1Id,
      order_no: 101,
      status: "PREPARING",
      service_mode: "DINE_IN",
      submitted_at: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
      accepted_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
      ready_at: null,
      served_at: null,
      predicted_ready_at: new Date(Date.now() + 4 * 60 * 1000).toISOString(),
      eta_min_minutes: 8,
      eta_max_minutes: 12,
      subtotal_snapshot: 10800,
      tax_snapshot: 540,
      total_snapshot: 11340,
      idempotency_key: "seed_idem_101",
      version: 1,
      created_at: now,
      updated_at: now,
    };
    this.orders.push(order);
    this.orderCounter = 101;

    this.order_items.push(
      {
        id: "oi_101_1",
        order_id: order1Id,
        menu_item_id: bunItem.id,
        menu_item_version_id: "ver_01",
        name_snapshot: bunItem.name,
        unit_price_snapshot: 7900,
        qty: 1,
        line_subtotal: 7900,
        item_status: "PREPARING",
        created_at: now,
      },
      {
        id: "oi_101_2",
        order_id: order1Id,
        menu_item_id: chaiItem.id,
        menu_item_version_id: "ver_51",
        name_snapshot: chaiItem.name,
        unit_price_snapshot: 2900,
        qty: 1,
        line_subtotal: 2900,
        item_status: "PREPARING",
        created_at: now,
      }
    );

    this.order_status_history.push(
      {
        id: "osh_101_1",
        order_id: order1Id,
        from_status: null,
        to_status: "SUBMITTED",
        actor_type: "CUSTOMER",
        actor_id: null,
        notes: "Order placed via QR",
        created_at: order.submitted_at!,
      },
      {
        id: "osh_101_2",
        order_id: order1Id,
        from_status: "SUBMITTED",
        to_status: "ACCEPTED",
        actor_type: "STAFF",
        actor_id: "kitchen_01",
        notes: "Ticket accepted",
        created_at: order.accepted_at!,
      },
      {
        id: "osh_101_3",
        order_id: order1Id,
        from_status: "ACCEPTED",
        to_status: "PREPARING",
        actor_type: "STAFF",
        actor_id: "kitchen_01",
        notes: "Brewing chai & toasting bun",
        created_at: now,
      }
    );
  }

  getNextOrderNo(): number {
    this.orderCounter += 1;
    return this.orderCounter;
  }
}

// Global singleton instance for hot-reloading preservation across Server Actions and Route Handlers
declare global {
  var __SMOL_MOCK_DB__: MockDatabaseStore | undefined;
}

export const mockStore: MockDatabaseStore = (() => {
  const store =
    (globalThis as unknown as { __SMOL_MOCK_DB__?: MockDatabaseStore }).__SMOL_MOCK_DB__ ||
    new MockDatabaseStore();

  // Always keep master menu items, versions and prices in sync with seedData
  store.menu_categories = [...MOCK_CATEGORIES];
  store.menu_items = [...MOCK_MENU_ITEMS];
  store.menu_item_versions = [...MOCK_MENU_VERSIONS];
  store.menu_prices = [...MOCK_MENU_PRICES];

  (globalThis as unknown as { __SMOL_MOCK_DB__?: MockDatabaseStore }).__SMOL_MOCK_DB__ = store;
  return store;
})();


type FilterFn = (row: Record<string, unknown>) => boolean;

/**
 * Fluent query builder implementing Supabase PostgREST client methods
 */
export class MockQueryBuilder {
  private tableName: string;
  private filters: FilterFn[] = [];
  private sortField: string | null = null;
  private sortAscending = true;
  private limitCount: number | null = null;
  private selectCols: string | null = null;
  private mutationType: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "UPSERT" = "SELECT";
  private mutationPayload: unknown = null;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(cols = "*"): this {
    if (this.mutationType === "SELECT") {
      this.selectCols = cols;
    }
    return this;
  }

  insert(values: unknown): this {
    this.mutationType = "INSERT";
    this.mutationPayload = values;
    return this;
  }

  update(values: unknown): this {
    this.mutationType = "UPDATE";
    this.mutationPayload = values;
    return this;
  }

  upsert(values: unknown): this {
    this.mutationType = "UPSERT";
    this.mutationPayload = values;
    return this;
  }

  delete(): this {
    this.mutationType = "DELETE";
    return this;
  }

  eq(col: string, val: unknown): this {
    this.filters.push((row) => row[col] === val);
    return this;
  }

  neq(col: string, val: unknown): this {
    this.filters.push((row) => row[col] !== val);
    return this;
  }

  in(col: string, vals: unknown[]): this {
    const set = new Set(vals);
    this.filters.push((row) => set.has(row[col]));
    return this;
  }

  not(col: string, op: string, val: unknown): this {
    if (op === "in") {
      let excluded: string[] = [];
      if (typeof val === "string") {
        excluded = val.replace(/[()"]/g, "").split(",").map((s) => s.trim());
      } else if (Array.isArray(val)) {
        excluded = val.map(String);
      }
      const set = new Set(excluded);
      this.filters.push((row) => !set.has(String(row[col])));
    } else if (op === "eq" || op === "is") {
      this.filters.push((row) => row[col] !== val);
    }
    return this;
  }

  or(orCondition: string): this {
    // Basic parser for or strings: e.g. "token_hash.eq.table-01,token_hash.eq.hash"
    const clauses = orCondition.split(",").map((s) => s.trim());
    this.filters.push((row) => {
      return clauses.some((clause) => {
        const parts = clause.split(".");
        if (parts.length === 3 && parts[1] === "eq") {
          const col = parts[0];
          const val = parts[2];
          return String(row[col]) === String(val);
        }
        if (clause.includes("effective_to.is.null") || clause.includes("effective_to.gt.")) {
          const val = row["effective_to"];
          return val === null || val === undefined || (typeof val === "string" && val > new Date().toISOString());
        }
        return false;
      });
    });
    return this;
  }

  lte(col: string, val: unknown): this {
    this.filters.push((row) => {
      const rVal = row[col];
      if (rVal === null || rVal === undefined) return false;
      return (rVal as number | string) <= (val as number | string);
    });
    return this;
  }

  gte(col: string, val: unknown): this {
    this.filters.push((row) => {
      const rVal = row[col];
      if (rVal === null || rVal === undefined) return false;
      return (rVal as number | string) >= (val as number | string);
    });
    return this;
  }

  gt(col: string, val: unknown): this {
    this.filters.push((row) => {
      const rVal = row[col];
      if (rVal === null || rVal === undefined) return false;
      return (rVal as number | string) > (val as number | string);
    });
    return this;
  }

  lt(col: string, val: unknown): this {
    this.filters.push((row) => {
      const rVal = row[col];
      if (rVal === null || rVal === undefined) return false;
      return (rVal as number | string) < (val as number | string);
    });
    return this;
  }

  is(col: string, val: unknown): this {
    this.filters.push((row) => row[col] === val);
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }): this {
    this.sortField = col;
    this.sortAscending = opts?.ascending ?? true;
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  private getTableArray(): Array<Record<string, unknown>> {
    const store = mockStore as unknown as Record<string, Array<Record<string, unknown>>>;
    if (!store[this.tableName]) {
      store[this.tableName] = [];
    }
    return store[this.tableName];
  }

  private executeQuery(): Array<Record<string, unknown>> {
    const table = this.getTableArray();

    if (this.mutationType === "INSERT") {
      const items = Array.isArray(this.mutationPayload)
        ? this.mutationPayload
        : [this.mutationPayload];

      const inserted = items.map((item) => {
        const id = item.id || `mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const now = new Date().toISOString();
        const record = {
          ...item,
          id,
          created_at: item.created_at || now,
          updated_at: item.updated_at || now,
        };
        table.push(record);
        return record;
      });

      return inserted;
    }

    if (this.mutationType === "UPDATE") {
      const payload = (this.mutationPayload || {}) as Record<string, unknown>;
      const matched = table.filter((row) => this.filters.every((fn) => fn(row)));
      matched.forEach((row) => {
        Object.assign(row, payload, { updated_at: new Date().toISOString() });
      });
      return matched;
    }

    if (this.mutationType === "DELETE") {
      const toDeleteIndices: number[] = [];
      table.forEach((row, idx) => {
        if (this.filters.every((fn) => fn(row))) {
          toDeleteIndices.push(idx);
        }
      });
      const deleted: Array<Record<string, unknown>> = [];
      for (let i = toDeleteIndices.length - 1; i >= 0; i--) {
        const [removed] = table.splice(toDeleteIndices[i], 1);
        deleted.push(removed);
      }
      return deleted;
    }

    // SELECT
    let result = table.filter((row) => this.filters.every((fn) => fn(row)));

    if (this.sortField) {
      const field = this.sortField;
      const asc = this.sortAscending;
      result = [...result].sort((a, b) => {
        const aVal = a[field];
        const bVal = b[field];
        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        if (typeof aVal === "number" && typeof bVal === "number") {
          return asc ? aVal - bVal : bVal - aVal;
        }
        return asc
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });
    }

    if (this.limitCount !== null) {
      result = result.slice(0, this.limitCount);
    }

    return result;
  }

  // Chainable promise resolution
  async then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    try {
      const data = this.executeQuery();
      const response = { data, error: null };
      return onfulfilled ? onfulfilled(response) : (response as unknown as TResult1);
    } catch (err) {
      if (onrejected) return onrejected(err);
      throw err;
    }
  }

  async single(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> {
    const results = this.executeQuery();
    if (results.length === 0) {
      return { data: null, error: { message: `No rows found in ${this.tableName}` } };
    }
    return { data: results[0], error: null };
  }

  async maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: null }> {
    const results = this.executeQuery();
    return { data: results[0] || null, error: null };
  }
}

/**
 * Universal Mock Supabase Client
 */
export class MockSupabaseClient {
  from(tableName: string) {
    return new MockQueryBuilder(tableName);
  }

  auth = {
    getUser: async () => ({
      data: {
        user: {
          id: "usr_guest_demo",
          email: "guest@smolcafe.in",
          phone: "+919876543210",
        },
      },
      error: null,
    }),
    getSession: async () => ({
      data: {
        session: {
          user: { id: "usr_guest_demo" },
          access_token: "mock-token",
        },
      },
      error: null,
    }),
    signInWithOtp: async () => ({ data: {}, error: null }),
    verifyOtp: async () => ({ data: { session: {} }, error: null }),
    signOut: async () => ({ error: null }),
  };

  async rpc(
    fnName: string,
    params: Record<string, unknown>
  ): Promise<{ data: unknown; error: { message: string } | null }> {
    const now = new Date().toISOString();

    if (fnName === "submit_order") {
      const locationId = params.p_location_id as string;
      const tableSessionId = params.p_table_session_id as string;
      const customerSessionId = (params.p_customer_session_id as string) || `cust_${tableSessionId}`;
      const verificationCode = (params.p_verification_code as string) || String(Math.floor(1000 + Math.random() * 9000));
      const instructions = params.p_instructions as string | undefined;
      const idempotencyKey = params.p_idempotency_key as string;
      const items = (params.p_items || []) as Array<{
        menu_item_id: string;
        expected_unit_price_paise: number;
        qty: number;
      }>;
      const rewardId = params.p_reward_id as string | undefined;
      const customerName = (params.p_customer_name as string) || null;
      const customerPhone = (params.p_customer_phone as string) || null;
      const profileId = (params.p_profile_id as string) || (customerPhone ? `prof_${customerPhone.replace(/\D/g, "")}` : null);

      // 1. Idempotency Check
      const existing = mockStore.orders.find((o) => o.idempotency_key === idempotencyKey);
      if (existing) {
        return {
          data: {
            success: true,
            is_duplicate: true,
            order_id: existing.id,
            order_no: existing.order_no,
            verification_code: existing.verification_code,
            status: existing.status,
            total_paise: existing.total_snapshot,
          },
          error: null,
        };
      }

      // 2. Validate Session
      const session = mockStore.table_sessions.find((s) => s.id === tableSessionId);
      if (session && session.status === "CLOSED") {
        return {
          data: {
            success: false,
            error: "SESSION_NOT_OPEN",
            message: "This table session is already closed.",
          },
          error: null,
        };
      }

      // 3. Price Re-validation
      let subtotalPaise = 0;
      const changedItems: Array<{
        menu_item_id: string;
        name: string;
        expected_price_paise: number;
        current_price_paise: number;
      }> = [];

      const orderItemRecords: MockOrderItem[] = [];
      const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const orderNo = mockStore.getNextOrderNo();

      for (const itemInput of items) {
        const menuItem = mockStore.menu_items.find((i) => i.id === itemInput.menu_item_id);
        const menuPrice = mockStore.menu_prices.find((p) => p.menu_item_id === itemInput.menu_item_id);
        const currentPrice = menuPrice?.amount_paise || itemInput.expected_unit_price_paise;

        if (currentPrice !== itemInput.expected_unit_price_paise) {
          changedItems.push({
            menu_item_id: itemInput.menu_item_id,
            name: menuItem?.name || "Item",
            expected_price_paise: itemInput.expected_unit_price_paise,
            current_price_paise: currentPrice,
          });
        }

        const lineSubtotal = currentPrice * itemInput.qty;
        subtotalPaise += lineSubtotal;

        orderItemRecords.push({
          id: `oi_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          order_id: orderId,
          menu_item_id: itemInput.menu_item_id,
          menu_item_version_id: `ver_${itemInput.menu_item_id}`,
          name_snapshot: menuItem?.name || "Café Item",
          unit_price_snapshot: currentPrice,
          qty: itemInput.qty,
          line_subtotal: lineSubtotal,
          item_status: "PENDING_CONFIRMATION",
          created_at: now,
        });
      }

      if (changedItems.length > 0) {
        return {
          data: {
            success: false,
            error: "PRICE_CHANGED",
            message: "Some menu item prices have updated. Please review your cart.",
            changed_items: changedItems,
          },
          error: null,
        };
      }

      // 4. Reward Discount
      let discountPaise = 0;
      if (rewardId) {
        const reward = mockStore.rewards.find((r) => r.id === rewardId);
        if (reward) {
          discountPaise = reward.discount_paise;
        }
      }

      const taxableAmount = Math.max(0, subtotalPaise - discountPaise);
      const taxPaise = Math.round(taxableAmount * 0.05); // 5% GST
      const totalPaise = taxableAmount + taxPaise;

      // 5. Create Order with SUBMITTED initial state
      const newOrder: MockOrder = {
        id: orderId,
        location_id: locationId || MOCK_LOCATION.id,
        table_session_id: tableSessionId || null,
        customer_session_id: customerSessionId,
        verification_code: verificationCode,
        order_no: orderNo,
        status: "SUBMITTED",
        service_mode: "DINE_IN",
        instructions: instructions || null,
        submitted_at: now,
        confirmed_at: now,
        confirmed_by: "Payment Gateway (PAID)",
        accepted_at: null,
        ready_at: null,
        served_at: null,
        predicted_ready_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        eta_min_minutes: 8,
        eta_max_minutes: 12,
        subtotal_snapshot: subtotalPaise,
        tax_snapshot: taxPaise,
        total_snapshot: totalPaise,
        idempotency_key: idempotencyKey,
        customer_id: profileId,
        customer_name: customerName,
        customer_phone: customerPhone,
        payment_status: "PAID",
        payment_method: "UPI",
        version: 1,
        created_at: now,
        updated_at: now,
      };

      mockStore.orders.push(newOrder);
      mockStore.order_items.push(...orderItemRecords);

      // Link / credit loyalty points to phone
      if (customerPhone) {
        const cleanDigits = customerPhone.replace(/\D/g, "");
        const formattedPhone = cleanDigits.startsWith("+") ? cleanDigits : `+91${cleanDigits}`;
        let prof = mockStore.profiles.find((p) => p.phone === formattedPhone || p.phone === cleanDigits || p.phone.includes(cleanDigits));
        if (!prof) {
          prof = {
            id: `prof_${cleanDigits}`,
            phone: formattedPhone,
            full_name: customerName || "Sonu",
            current_balance_cached: 50, // 50 welcome points
            created_at: now,
          };
          mockStore.profiles.push(prof);
        }
        const earned = Math.max(1, Math.floor(totalPaise / 1000));
        prof.current_balance_cached += earned;
        mockStore.loyalty_ledger.push({
          id: `ll_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          profile_id: prof.id,
          points_change: earned,
          reason: `Earned from Order #${orderNo}`,
          reference_order_id: orderId,
          created_at: now,
        });
      }

      mockStore.order_status_history.push({
        id: `osh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        order_id: orderId,
        from_status: null,
        to_status: "SUBMITTED",
        actor_type: "CUSTOMER",
        actor_id: customerSessionId,
        notes: "Payment successful (PAID). Order submitted to Cashier queue",
        created_at: now,
      });

      return {
        data: {
          success: true,
          order_id: orderId,
          order_no: orderNo,
          verification_code: verificationCode,
          status: "CONFIRMED",
          payment_status: "PAID",
          discount_paise: discountPaise,
          total_paise: totalPaise,
          is_duplicate: false,
        },
        error: null,
      };
    }

    if (fnName === "edit_pending_order") {
      const orderId = params.p_order_id as string;
      const customerSessionId = params.p_customer_session_id as string | undefined;
      const newItems = (params.p_items || []) as Array<{
        menu_item_id: string;
        expected_unit_price_paise: number;
        qty: number;
      }>;
      const instructions = params.p_instructions as string | undefined;

      const order = mockStore.orders.find((o) => o.id === orderId);
      if (!order) {
        return { data: { success: false, error: "NOT_FOUND", message: "Order not found." }, error: null };
      }

      // Strict enforcement: Customer can ONLY edit while in PENDING_CONFIRMATION
      if (order.status !== "PENDING_CONFIRMATION" && order.status !== "DRAFT") {
        return {
          data: {
            success: false,
            error: "ORDER_LOCKED",
            message: `Order #${order.order_no} is already ${order.status.toLowerCase()} and can no longer be edited.`,
          },
          error: null,
        };
      }

      // Validate ownership if customerSessionId is provided
      if (customerSessionId && order.customer_session_id && order.customer_session_id !== customerSessionId) {
        return {
          data: { success: false, error: "UNAUTHORIZED", message: "You do not have permission to edit this order." },
          error: null,
        };
      }

      // Rebuild items and calculate updated totals
      let subtotalPaise = 0;
      const updatedItemRecords: MockOrderItem[] = [];

      for (const itemInput of newItems) {
        const menuItem = mockStore.menu_items.find((i) => i.id === itemInput.menu_item_id);
        const menuPrice = mockStore.menu_prices.find((p) => p.menu_item_id === itemInput.menu_item_id);
        const currentPrice = menuPrice?.amount_paise || itemInput.expected_unit_price_paise;
        const lineSubtotal = currentPrice * itemInput.qty;
        subtotalPaise += lineSubtotal;

        updatedItemRecords.push({
          id: `oi_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          order_id: orderId,
          menu_item_id: itemInput.menu_item_id,
          menu_item_version_id: `ver_${itemInput.menu_item_id}`,
          name_snapshot: menuItem?.name || "Café Item",
          unit_price_snapshot: currentPrice,
          qty: itemInput.qty,
          line_subtotal: lineSubtotal,
          item_status: "PENDING_CONFIRMATION",
          created_at: now,
        });
      }

      const taxPaise = Math.round(subtotalPaise * 0.05);
      const totalPaise = subtotalPaise + taxPaise;

      // Update Order
      order.subtotal_snapshot = subtotalPaise;
      order.tax_snapshot = taxPaise;
      order.total_snapshot = totalPaise;
      if (instructions !== undefined) order.instructions = instructions;
      order.updated_at = now;
      order.version += 1;

      // Replace Order Items
      mockStore.order_items = mockStore.order_items.filter((oi) => oi.order_id !== orderId);
      mockStore.order_items.push(...updatedItemRecords);

      mockStore.order_status_history.push({
        id: `osh_${Date.now()}`,
        order_id: orderId,
        from_status: "PENDING_CONFIRMATION",
        to_status: "PENDING_CONFIRMATION",
        actor_type: "CUSTOMER",
        actor_id: customerSessionId || null,
        notes: "Customer edited items & recalculated total",
        created_at: now,
      });

      return {
        data: {
          success: true,
          order_id: orderId,
          order_no: order.order_no,
          total_paise: totalPaise,
          message: `Order #${order.order_no} updated successfully!`,
        },
        error: null,
      };
    }

    if (fnName === "confirm_order_by_cashier") {
      const orderId = params.p_order_id as string;
      const staffName = (params.p_staff_name as string) || "Cashier";

      const order = mockStore.orders.find((o) => o.id === orderId);
      if (!order) {
        return { data: { success: false, error: "NOT_FOUND", message: "Order not found." }, error: null };
      }

      const prevStatus = order.status;
      order.status = "CONFIRMED";
      order.confirmed_at = now;
      order.confirmed_by = staffName;
      order.accepted_at = now;
      order.updated_at = now;

      // Update item statuses
      mockStore.order_items
        .filter((oi) => oi.order_id === orderId)
        .forEach((oi) => {
          oi.item_status = "CONFIRMED";
        });

      mockStore.order_status_history.push({
        id: `osh_${Date.now()}`,
        order_id: orderId,
        from_status: prevStatus,
        to_status: "CONFIRMED",
        actor_type: "STAFF",
        actor_id: staffName,
        notes: `Order confirmed by ${staffName} and sent to kitchen queue`,
        created_at: now,
      });

      return {
        data: {
          success: true,
          order_id: orderId,
          order_no: order.order_no,
          status: "CONFIRMED",
          message: `Order #${order.order_no} confirmed and sent to kitchen!`,
        },
        error: null,
      };
    }

    if (fnName === "reject_order_by_cashier") {
      const orderId = params.p_order_id as string;
      const reason = (params.p_reason as string) || "Cancelled by staff";
      const staffName = (params.p_staff_name as string) || "Cashier";

      const order = mockStore.orders.find((o) => o.id === orderId);
      if (!order) {
        return { data: { success: false, error: "NOT_FOUND", message: "Order not found." }, error: null };
      }

      order.status = "REJECTED";
      order.updated_at = now;

      mockStore.order_status_history.push({
        id: `osh_${Date.now()}`,
        order_id: orderId,
        from_status: order.status,
        to_status: "REJECTED",
        actor_type: "STAFF",
        actor_id: staffName,
        notes: `Order rejected: ${reason}`,
        created_at: now,
      });

      return {
        data: {
          success: true,
          order_id: orderId,
          order_no: order.order_no,
          status: "REJECTED",
          message: `Order #${order.order_no} rejected.`,
        },
        error: null,
      };
    }

    if (fnName === "redeem_loyalty_reward") {
      const profileId = params.p_profile_id as string;
      const rewardId = params.p_reward_id as string;

      const reward = mockStore.rewards.find((r) => r.id === rewardId);
      if (!reward) {
        return { data: { success: false, error: "REWARD_NOT_FOUND", message: "Reward not found." }, error: null };
      }

      let profile = mockStore.profiles.find((p) => p.id === profileId);
      if (!profile) {
        profile = {
          id: profileId || "usr_guest_demo",
          phone: "+919876543210",
          full_name: "Sonu Singh",
          current_balance_cached: 240,
          created_at: now,
        };
        mockStore.profiles.push(profile);
      }

      const cost = reward.points_required || 100;

      if (profile.current_balance_cached < cost) {
        return {
          data: {
            success: false,
            error: "INSUFFICIENT_POINTS",
            message: `Insufficient points. You need ${cost} points (Current balance: ${profile.current_balance_cached}).`,
          },
          error: null,
        };
      }

      // Deduct points atomically
      profile.current_balance_cached -= cost;

      mockStore.loyalty_ledger.push({
        id: `ll_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        profile_id: profile.id,
        points_change: -cost,
        reason: `REWARD_REDEMPTION: ${reward.title}`,
        reference_order_id: null,
        created_at: now,
      });

      return {
        data: {
          success: true,
          reward_id: reward.id,
          title: reward.title,
          discount_paise: reward.discount_paise,
          new_balance: profile.current_balance_cached,
          message: `Redeemed ${reward.title}! Points balance: ${profile.current_balance_cached}`,
        },
        error: null,
      };
    }

    if (fnName === "record_cash_payment") {
      const tableSessionId = params.p_table_session_id as string;
      const tenderedPaise = params.p_amount_tendered_paise as number;

      // Sum all active orders for this table session
      const sessionOrders = mockStore.orders.filter(
        (o) => o.table_session_id === tableSessionId && o.status !== "CANCELLED" && o.status !== "REJECTED"
      );

      let totalPaise = 0;
      sessionOrders.forEach((o) => {
        totalPaise += o.total_snapshot;
      });

      if (tenderedPaise < totalPaise) {
        return {
          data: {
            success: false,
            error: "INSUFFICIENT_TENDER",
            message: `Tendered amount (₹${(tenderedPaise / 100).toFixed(2)}) is less than total due (₹${(totalPaise / 100).toFixed(2)}).`,
          },
          error: null,
        };
      }

      const changePaise = tenderedPaise - totalPaise;

      // Update table session status to CLOSED
      const session = mockStore.table_sessions.find((s) => s.id === tableSessionId);
      if (session) {
        session.status = "CLOSED";
        session.closed_at = now;
        session.last_activity_at = now;
      }

      // Mark all orders as SERVED
      sessionOrders.forEach((o) => {
        if (o.status !== "SERVED") {
          o.status = "SERVED";
          o.served_at = now;
          o.updated_at = now;
        }
      });

      const billId = `bill_${tableSessionId}`;
      let bill = mockStore.bills.find((b) => b.table_session_id === tableSessionId);
      if (!bill) {
        bill = {
          id: billId,
          table_session_id: tableSessionId,
          status: "PAID",
          subtotal: Math.round(totalPaise / 1.05),
          tax: totalPaise - Math.round(totalPaise / 1.05),
          total: totalPaise,
          paid_amount: totalPaise,
          created_at: now,
          closed_at: now,
        };
        mockStore.bills.push(bill);
      } else {
        bill.status = "PAID";
        bill.paid_amount = totalPaise;
        bill.closed_at = now;
      }

      return {
        data: {
          success: true,
          bill_id: billId,
          total_paise: totalPaise,
          tendered_paise: tenderedPaise,
          change_paise: changePaise,
          message: `Payment of ₹${(totalPaise / 100).toFixed(2)} settled. Change: ₹${(changePaise / 100).toFixed(2)}.`,
        },
        error: null,
      };
    }

    if (fnName === "handle_order_inventory_transition") {
      return { data: { success: true }, error: null };
    }

    if (fnName === "claim_session_orders") {
      const profileId = params.p_profile_id as string;
      const pointsEarned = 25;
      let profile = mockStore.profiles.find((p) => p.id === profileId);
      if (!profile) {
        profile = {
          id: profileId,
          phone: "+919876543210",
          full_name: "Smol Guest",
          current_balance_cached: pointsEarned,
          created_at: now,
        };
        mockStore.profiles.push(profile);
      } else {
        profile.current_balance_cached += pointsEarned;
      }

      mockStore.loyalty_ledger.push({
        id: `ll_${Date.now()}`,
        profile_id: profileId,
        points_change: pointsEarned,
        reason: "ORDER_CLAIM",
        reference_order_id: null,
        created_at: now,
      });

      return {
        data: {
          success: true,
          points_earned: pointsEarned,
          new_balance: profile.current_balance_cached,
        },
        error: null,
      };
    }

    if (fnName === "record_loyalty_movement") {
      const profileId = params.p_profile_id as string;
      const points = (params.p_points as number) || 0;
      const reason = (params.p_reason as string) || "ADJUSTMENT";

      let profile = mockStore.profiles.find((p) => p.id === profileId);
      if (!profile) {
        profile = {
          id: profileId,
          phone: "+919876543210",
          full_name: "Smol Guest",
          current_balance_cached: Math.max(0, points),
          created_at: now,
        };
        mockStore.profiles.push(profile);
      } else {
        profile.current_balance_cached = Math.max(0, profile.current_balance_cached + points);
      }

      mockStore.loyalty_ledger.push({
        id: `ll_${Date.now()}`,
        profile_id: profileId,
        points_change: points,
        reason,
        reference_order_id: null,
        created_at: now,
      });

      return {
        data: {
          success: true,
          balance: profile.current_balance_cached,
        },
        error: null,
      };
    }

    return { data: { success: true }, error: null };
  }
}
