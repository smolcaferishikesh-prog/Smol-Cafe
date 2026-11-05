# Smol Cafe — Complete Codebase Remediation Guide

This guide provides the exact, copy-pasteable code changes required to resolve all 10 defects (`DEF-01` through `DEF-10`) identified in the **Smol Cafe Code Testing & Audit Report**.

---

## Quick Remediation Summary

| Defect ID | Severity | Target File(s) | Summary of Fix |
| :--- | :--- | :--- | :--- |
| **DEF-01** | **CRITICAL** | `apps/web/app/menu/actions.ts` | Query `menu_prices` (`amount_paise`) alongside `menu_items`, use nullish coalescing `verified?.pricePaise ?? it.expected_unit_price_paise` so prices never evaluate to `undefined`/`NaN`, and update `bills` using `subtotal`, `tax`, and `total`. |
| **DEF-02** | **CRITICAL** | `apps/web/app/api/webhooks/razorpay/route.ts` | Call `process_razorpay_webhook(p_event_id, p_event_type, p_payload)` to match migration `20260823000006_webhook_events.sql`. |
| **DEF-03** | **HIGH** | `apps/web/app/admin/menu-actions.ts`<br>`apps/web/app/kitchen/menu-actions.ts`<br>`apps/web/app/account/loyalty-actions.ts`<br>`apps/web/app/bill/actions.ts` | Add `await requireStaffAuth([...])` from `@/lib/auth/rbac` at the entry of all 12 unprotected mutating Server Actions. |
| **DEF-04** | **HIGH** | `packages/db/supabase/migrations/20261103000026_extend_order_status_enum.sql`<br>`apps/web/app/cashier/actions.ts` | Add `'PENDING_CONFIRMATION'`, `'CONFIRMED'`, and `'COMPLETED'` to PostgreSQL `order_status` enum and remove invalid enum literals (`"PENDING"`, `"PLACED"`, `"NEW"`). |
| **DEF-05** | **HIGH** | `apps/web/lib/mock-db/index.ts` | Implement `if (this.mutationType === "UPSERT")` inside `MockQueryBuilder.executeQuery()`. |
| **DEF-06** | **HIGH** | `apps/web/lib/mock-db/seedData.ts` | Align seed property names, active flags, future event dates, and budget category enum keys with SQL schema & Server Action queries. |
| **DEF-07** | **MEDIUM** | `apps/web/app/kitchen/actions.ts`<br>`apps/web/app/barista/actions.ts` | Replace unsigned role cookie assignment with `await setStaffSessionCookie("kitchen" \| "barista")`. |
| **DEF-08** | **MEDIUM** | `apps/web/lib/mock-db/index.ts` | Attach relational `order_items` and `payment_attempts` in `MockQueryBuilder.executeQuery()` and add `submit_song_request`, `cast_song_vote`, and `process_razorpay_webhook` to `MockSupabaseClient.rpc()`. |
| **DEF-09** | **LOW** | `apps/web/lib/mock-db/index.ts` | Match `"Masala Milk Tea"` / `"Chai"` in `seedInitialSessionAndOrder()` so initial Order `#101` appears on the Barista Desk. |
| **DEF-10** | **LOW** | `apps/web/components/menu/MenuClientView.tsx`<br>`apps/web/app/admin/menu-actions.ts` | Replace missing `/images/food-placeholder.png` with `null` and add `MOCK_MENU_ITEMS` UUIDs to `deletedStore` in `clearAllMenuItemsAction()`. |

---

## Step-by-Step Fixes by Defect

### 1. Fix `DEF-01` (Critical): Order Editing Price `NaN` Corruption & Bill Column Sync
**File:** `apps/web/app/menu/actions.ts`

**Why it fails:**
1. `editPendingOrderAction` selects `id, name, price_paise` from `menu_items`, whereas prices are stored in `menu_prices.amount_paise`. Because `m.price_paise` is `undefined` and `verified` is truthy (`{ name, pricePaise: undefined }`), `const unitPrice = verified ? verified.pricePaise : it.expected_unit_price_paise` evaluates to `undefined`, turning `subtotalPaise` into `NaN`.
2. It updates `bills` using `subtotal_paise`, `tax_paise`, and `total_paise`, whereas `bills` (`20260823000001_initial_schema.sql`) uses `subtotal`, `tax`, and `total`.

**Replace step 2 and the bill update inside `editPendingOrderAction` (`apps/web/app/menu/actions.ts`):**
```ts
    // 2. Fetch fresh prices from menu_items and menu_prices
    const itemIds = items.map((i) => i.menu_item_id).filter((id) => isValidUuid(id));
    const [{ data: dbMenuItems }, { data: dbMenuPrices }] = await Promise.all([
      supabase.from("menu_items").select("id, name").in("id", itemIds),
      supabase.from("menu_prices").select("menu_item_id, amount_paise").in("menu_item_id", itemIds),
    ]);

    const priceLookup = new Map<string, number>();
    for (const p of (dbMenuPrices as Array<{ menu_item_id: string; amount_paise: number }>) || []) {
      if (!priceLookup.has(p.menu_item_id)) {
        priceLookup.set(p.menu_item_id, p.amount_paise);
      }
    }

    const priceMap = new Map<string, { name: string; pricePaise?: number }>();
    for (const m of dbMenuItems || []) {
      priceMap.set(m.id, { name: m.name, pricePaise: priceLookup.get(m.id) });
    }

    let subtotalPaise = 0;
    const orderItemsPayload = items.map((it) => {
      const verified = priceMap.get(it.menu_item_id);
      const unitPrice = verified?.pricePaise ?? it.expected_unit_price_paise;
```
And update the `bills` recalculation block just below it:
```ts
        await supabase
          .from("bills")
          .update({
            subtotal: sessionSubtotal,
            tax: sessionTax,
            total: sessionTotal,
          })
          .eq("table_session_id", existingOrder.table_session_id);
```

---

### 2. Fix `DEF-02` (Critical): Razorpay Webhook RPC Signature Mismatch
**File:** `apps/web/app/api/webhooks/razorpay/route.ts`

**Why it fails:**
The webhook route calls `supabase.rpc("handle_razorpay_webhook_event", ...)`, which does not exist in PostgreSQL. Migration `20260823000006_webhook_events.sql` defines `process_razorpay_webhook(p_event_id TEXT, p_event_type TEXT, p_payload JSONB)`.

**Replace the RPC call in `apps/web/app/api/webhooks/razorpay/route.ts`:**
```ts
    // Execute idempotent payment webhook ingestion RPC (matches 20260823000006_webhook_events.sql)
    const { data: rpcResult, error: rpcError } = await supabase.rpc("process_razorpay_webhook", {
      p_event_id: eventId,
      p_event_type: payload.event || "payment.captured",
      p_payload: payload,
    });
```

---

### 3. Fix `DEF-03` (High): Enforce `requireStaffAuth` on 12 Mutating Staff Actions
**Files:**
- `apps/web/app/admin/menu-actions.ts`
- `apps/web/app/kitchen/menu-actions.ts`
- `apps/web/app/account/loyalty-actions.ts`
- `apps/web/app/bill/actions.ts`

Import `requireStaffAuth` from `@/lib/auth/rbac` in each file and guard all 12 mutating actions:

1. **`apps/web/app/admin/menu-actions.ts`**:
```ts
import { requireStaffAuth } from "@/lib/auth/rbac";

// At the start of saveMenuItemAction:
const auth = await requireStaffAuth(["admin", "super_admin"]);
if (!auth.authorized) return { success: false, message: auth.message || "Unauthorized.", itemId: payload.id || "" };

// At the start of deleteMenuItemAction, clearAllMenuItemsAction, and resetToMasterMenuAction:
const auth = await requireStaffAuth(["admin", "super_admin"]);
if (!auth.authorized) return { success: false, message: auth.message || "Unauthorized." };
```

2. **`apps/web/app/kitchen/menu-actions.ts`**:
```ts
import { requireStaffAuth } from "@/lib/auth/rbac";

// At the start of updateMenuItemStockAction:
const auth = await requireStaffAuth(["kitchen", "chef", "barista", "admin", "super_admin"]);
if (!auth.authorized) return { success: false, message: auth.message || "Unauthorized.", itemId, stockStatus };

// At the start of bulkSetCategoryStockAction:
const auth = await requireStaffAuth(["kitchen", "chef", "barista", "admin", "super_admin"]);
if (!auth.authorized) return { success: false, message: auth.message || "Unauthorized.", updatedCount: 0, updatedItemIds: [] };

// At the start of updateChefItemNotesAction:
const auth = await requireStaffAuth(["kitchen", "chef", "admin", "super_admin"]);
if (!auth.authorized) return { success: false, message: auth.message || "Unauthorized." };

// At the start of updateIngredientStockAction:
const auth = await requireStaffAuth(["kitchen", "chef", "barista", "admin", "super_admin"]);
if (!auth.authorized) return { success: false, message: auth.message || "Unauthorized." };
```

3. **`apps/web/app/account/loyalty-actions.ts`**:
```ts
import { requireStaffAuth } from "@/lib/auth/rbac";

// At the start of updateLoyaltyConfigAction:
const auth = await requireStaffAuth(["admin", "super_admin"]);
if (!auth.authorized) return { success: false, config: getLoyaltyConfigStore(), message: auth.message || "Unauthorized." };

// At the start of grantLoyaltyPointsManualAction:
const auth = await requireStaffAuth(["admin", "super_admin"]);
if (!auth.authorized) return { success: false, message: auth.message || "Unauthorized." };
```

4. **`apps/web/app/bill/actions.ts`**:
```ts
import { requireStaffAuth } from "@/lib/auth/rbac";

// At the start of recordCashPaymentAction:
const auth = await requireStaffAuth(["cashier", "admin", "super_admin"]);
if (!auth.authorized) return { success: false, error: "UNAUTHORIZED", message: auth.message || "Unauthorized: Cashier access required." };

// At the start of bypassPaymentAction:
const auth = await requireStaffAuth(["cashier", "admin", "super_admin"]);
if (!auth.authorized) return { success: false, message: auth.message || "Unauthorized: Staff access required." };
```

---

### 4. Fix `DEF-04` (High): Extend PostgreSQL `order_status` Enum
**Files:**
- `packages/db/supabase/migrations/20261103000026_extend_order_status_enum.sql` *(new migration)*
- `apps/web/app/cashier/actions.ts`

**Step 4A — Create `packages/db/supabase/migrations/20261103000026_extend_order_status_enum.sql`:**
```sql
-- ==============================================================================
-- Smol Café — Migration 20261103000026: Extend order_status Enum
-- Adds PENDING_CONFIRMATION, CONFIRMED, and COMPLETED to order_status enum
-- ==============================================================================

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'PENDING_CONFIRMATION';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'CONFIRMED';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'COMPLETED';
```

**Step 4B — Remove invalid enum literals in `apps/web/app/cashier/actions.ts` (`clearAllPendingCashierOrdersAction`):**
```ts
    // Replace .in("status", ["PENDING_CONFIRMATION", "SUBMITTED", "DRAFT", "PENDING", "PLACED", "NEW"]) with:
    .in("status", ["PENDING_CONFIRMATION", "SUBMITTED", "DRAFT"])
```

---

### 5. Fix `DEF-05`, `DEF-08`, and `DEF-09`: Update `MockQueryBuilder` & `MockSupabaseClient`
**File:** `apps/web/lib/mock-db/index.ts`

**Step 5A (`DEF-09`) — Fix initial beverage item lookup in `seedInitialSessionAndOrder()`:**
```ts
    const chaiItem =
      this.menu_items.find((i) => i.name.includes("Masala Milk Tea") || i.name.includes("Chai")) ||
      this.menu_items[10];
```

**Step 5B (`DEF-05`) — Add `UPSERT` execution inside `MockQueryBuilder.executeQuery()` (just before `if (this.mutationType === "DELETE")`):**
```ts
    if (this.mutationType === "UPSERT") {
      const items = Array.isArray(this.mutationPayload)
        ? this.mutationPayload
        : [this.mutationPayload];
      const now = new Date().toISOString();
      return items.map((rawItem) => {
        const item = (rawItem || {}) as Record<string, unknown>;
        const existingIdx = table.findIndex((r) =>
          (item.id && r.id === item.id) ||
          (this.tableName === "budgets" && r.category === item.category && r.month === item.month) ||
          (this.tableName === "profiles" && ((item.id && r.id === item.id) || (item.phone && r.phone === item.phone))) ||
          (this.tableName === "menu_prices" && r.menu_item_id === item.menu_item_id)
        );
        if (existingIdx >= 0) {
          Object.assign(table[existingIdx], item, { updated_at: now });
          return table[existingIdx];
        }
        const id = (item.id as string) || `mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const record = {
          ...item,
          id,
          created_at: item.created_at || now,
          updated_at: item.updated_at || now,
        };
        table.push(record);
        return record;
      });
    }
```

**Step 5C (`DEF-08`) — Attach relational joins (`order_items`, `payment_attempts`) at the end of `MockQueryBuilder.executeQuery()`:**
```ts
    if (this.limitCount !== null) {
      result = result.slice(0, this.limitCount);
    }

    // Attach relational joins when requested in selectCols (e.g. "*, order_items(*)")
    if (this.selectCols && this.tableName === "orders" && this.selectCols.includes("order_items")) {
      result = result.map((row) => ({
        ...row,
        order_items: mockStore.order_items.filter((oi) => oi.order_id === row.id),
      }));
    }
    if (this.selectCols && this.tableName === "bills" && this.selectCols.includes("payment_attempts")) {
      result = result.map((row) => ({
        ...row,
        payment_attempts: mockStore.payment_attempts.filter((pa) => pa.bill_id === row.id),
      }));
    }

    return result;
```

**Step 5D (`DEF-08`) — Add `process_razorpay_webhook`, `submit_song_request`, and `cast_song_vote` to `MockSupabaseClient.rpc()`:**
```ts
    if (fnName === "process_razorpay_webhook" || fnName === "handle_razorpay_webhook_event") {
      return {
        data: {
          success: true,
          is_duplicate: false,
          status: "PROCESSED",
          message: "Webhook processed successfully.",
        },
        error: null,
      };
    }

    if (fnName === "submit_song_request") {
      const sessionId = (params.p_location_id as string) ? (mockStore.music_sessions[0]?.id || "music_ses_01") : "music_ses_01";
      const tableSessionId = (params.p_table_session_id as string) || "ses_tbl_01_init";
      const trackName = (params.p_track_name as string) || "Untitled Track";
      const artist = (params.p_artist as string) || "Unknown Artist";
      const newReq = {
        id: `song_${Date.now()}`,
        session_id: sessionId,
        music_session_id: sessionId,
        table_session_id: tableSessionId,
        requested_by_table: "01",
        track_name: trackName,
        title: trackName,
        artist,
        status: "QUEUED" as const,
        vote_count: 1,
        votes: 1,
        created_at: now,
        updated_at: now,
      };
      mockStore.song_requests.push(newReq as any);
      return { data: { success: true, request_id: newReq.id, message: "Song added to jukebox queue!" }, error: null };
    }

    if (fnName === "cast_song_vote") {
      const requestId = params.p_request_id as string;
      const track = mockStore.song_requests.find((t) => t.id === requestId) as any;
      if (track) {
        track.vote_count = (track.vote_count || track.votes || 0) + 1;
        track.votes = track.vote_count;
      }
      return { data: { success: true, vote_count: track?.vote_count || 1, message: "Vote recorded!" }, error: null };
    }
```

---

### 6. Fix `DEF-06` (High): Align `seedData.ts` Entities with SQL Schema & Server Action Queries
**File:** `apps/web/lib/mock-db/seedData.ts`

Update `MOCK_BLACKBOARD_POSTS`, `MOCK_CAFE_EVENTS`, `MOCK_MUSIC_SESSION`, `MOCK_SONG_REQUESTS`, `MOCK_REWARDS`, and `MOCK_BUDGETS` in `apps/web/lib/mock-db/seedData.ts` so they include the exact columns queried by Server Actions (`body`, `active`, `starts_at`, `ends_at`, `capacity`, `location_id`, `status: "OPEN"`, `session_id`, `track_name`, `vote_count`, `status: "QUEUED"`, `name`, `type`, `points_cost`, `discount_value`, `budgeted_amount_paise`, and enum keys `DAIRY`, `COFFEE_BEANS`, `BAKERY_RAW`, `SPICES_TEA`):

```ts
// Blackboard Posts
export const MOCK_BLACKBOARD_POSTS: MockBlackboardPost[] = [
  {
    id: "bb_01",
    title: "Rishikesh Morning Special",
    body: "Kanpur Bun Makkhan + Hot Smol Chai at ₹99 all morning. Freshly baked buns with salted Amul butter.",
    content: "Kanpur Bun Makkhan + Hot Smol Chai at ₹99 all morning. Freshly baked buns with salted Amul butter.",
    image_url: null,
    starts_at: "2026-08-01T00:00:00.000Z",
    ends_at: "2027-12-31T23:59:59.000Z",
    active: true,
    is_active: true,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "bb_02",
    title: "Himalayan Buransh Fizz",
    body: "Wild Rhododendron flower cordial, fresh lime and chilled sparkling water — local forage from Garhwal hills.",
    content: "Wild Rhododendron flower cordial, fresh lime and chilled sparkling water — local forage from Garhwal hills.",
    image_url: null,
    starts_at: "2026-08-01T00:00:00.000Z",
    ends_at: "2027-12-31T23:59:59.000Z",
    active: true,
    is_active: true,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
  },
];

// Community Events
export const MOCK_CAFE_EVENTS: MockCafeEvent[] = [
  {
    id: "evt_01",
    title: "Chai & Poetry Circle",
    description: "An intimate evening of Hindi, Urdu & English spoken word by the Ganges. Chai is on the house.",
    starts_at: "2026-12-15T18:00:00.000Z",
    ends_at: "2026-12-15T20:30:00.000Z",
    date_time: "2026-12-15T18:00:00.000Z",
    location: "Smol Café Rooftop Garden",
    join_url_or_note: "Smol Café Rooftop Garden",
    capacity: 25,
    max_capacity: 25,
    active: true,
    is_active: true,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "evt_02",
    title: "Sunday Acoustic Jam",
    description: "Unplugged indie folk & classical guitar session over pour-over brews & warm brownies.",
    starts_at: "2026-12-20T17:30:00.000Z",
    ends_at: "2026-12-20T20:00:00.000Z",
    date_time: "2026-12-20T17:30:00.000Z",
    location: "Smol Café Ground Floor",
    join_url_or_note: "Smol Café Ground Floor",
    capacity: 35,
    max_capacity: 35,
    active: true,
    is_active: true,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
  },
];

// Jukebox
export const MOCK_MUSIC_SESSION: MockMusicSession = {
  id: "music_ses_01",
  location_id: MOCK_LOCATION_ID,
  status: "OPEN",
  opened_at: "2026-08-24T08:00:00.000Z",
  closed_at: null,
  started_at: "2026-08-24T08:00:00.000Z",
  ended_at: null,
  created_at: "2026-08-24T08:00:00.000Z",
};

export const MOCK_SONG_REQUESTS: MockSongRequest[] = [
  {
    id: "song_01",
    session_id: "music_ses_01",
    music_session_id: "music_ses_01",
    table_session_id: "ses_tbl_03",
    track_name: "Ghar",
    title: "Ghar",
    artist: "Bharat Chauhan",
    vote_count: 8,
    votes: 8,
    status: "PLAYING",
    requested_by_table: "03",
    created_at: "2026-08-24T09:00:00.000Z",
    updated_at: "2026-08-24T09:00:00.000Z",
  },
  {
    id: "song_02",
    session_id: "music_ses_01",
    music_session_id: "music_ses_01",
    table_session_id: "ses_tbl_05",
    track_name: "Kasoor (Acoustic)",
    title: "Kasoor (Acoustic)",
    artist: "Prateek Kuhad",
    vote_count: 5,
    votes: 5,
    status: "QUEUED",
    requested_by_table: "05",
    created_at: "2026-08-24T09:15:00.000Z",
    updated_at: "2026-08-24T09:15:00.000Z",
  },
];

// Budgets
export const MOCK_BUDGETS: MockBudget[] = [
  {
    id: "bud_01",
    month: "2026-08",
    category: "DAIRY",
    budgeted_amount_paise: 4500000,
    allocated_paise: 4500000,
    created_at: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "bud_02",
    month: "2026-08",
    category: "COFFEE_BEANS",
    budgeted_amount_paise: 3500000,
    allocated_paise: 3500000,
    created_at: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "bud_03",
    month: "2026-08",
    category: "BAKERY_RAW",
    budgeted_amount_paise: 2000000,
    allocated_paise: 2000000,
    created_at: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "bud_04",
    month: "2026-08",
    category: "SPICES_TEA",
    budgeted_amount_paise: 3000000,
    allocated_paise: 3000000,
    created_at: "2026-08-01T00:00:00.000Z",
  },
];
```

---

### 7. Fix `DEF-07` (Medium): Issue Signed HMAC Staff Session Cookies in Kitchen & Barista Login
**Files:**
- `apps/web/app/kitchen/actions.ts`
- `apps/web/app/barista/actions.ts`

1. In **`apps/web/app/kitchen/actions.ts`**, import `setStaffSessionCookie` from `@/lib/auth/rbac` and update `staffLoginAction`:
```ts
export async function staffLoginAction(
  pinOrPassword: string
): Promise<{ success: boolean; message?: string }> {
  const creds = await getStoredCredentials();
  const trimmed = pinOrPassword.trim();
  if (trimmed === creds.kitchen.pin || (creds.admin.password && trimmed === creds.admin.password)) {
    await setStaffSessionCookie("kitchen");
    return { success: true };
  }

  return { success: false, message: "Invalid Kitchen Station PIN." };
}
```

2. In **`apps/web/app/barista/actions.ts`**, import `setStaffSessionCookie` from `@/lib/auth/rbac` and update `staffLoginAction`:
```ts
export async function staffLoginAction(
  pinOrPassword: string
): Promise<{ success: boolean; message?: string }> {
  const creds = await getStoredCredentials();
  const trimmed = pinOrPassword.trim();
  if (trimmed === creds.barista.pin || (creds.admin.password && trimmed === creds.admin.password)) {
    await setStaffSessionCookie("barista");
    return { success: true };
  }

  return { success: false, message: "Invalid Barista Station PIN." };
}
```

---

### 8. Fix `DEF-10` (Low): Remove Broken Image Fallback & Clear Mock Menu Seed Items
**Files:**
- `apps/web/components/menu/MenuClientView.tsx`
- `apps/web/app/admin/menu-actions.ts`

1. In **`apps/web/components/menu/MenuClientView.tsx`**, replace the non-existent `/images/food-placeholder.png` path with `null` so `MenuItemCard` renders its built-in SVG cup illustration:
```ts
        imageUrl: null,
```

2. In **`apps/web/app/admin/menu-actions.ts`** (`clearAllMenuItemsAction`), add all `MOCK_MENU_ITEMS` UUIDs to `deletedStore`:
```ts
    for (let i = 1; i <= 66; i++) {
      deletedStore.add(`item_${i.toString().padStart(2, "0")}`);
      deletedStore.add(`item_${i}`);
    }
    MOCK_MENU_ITEMS.forEach((it) => deletedStore.add(it.id));
```
