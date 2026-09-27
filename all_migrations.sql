-- ==============================================================================
-- Smol Café — Core Schema Migration (Step 0.3)
-- Money-critical tables, enums, constraints, partial indexes & audit history
-- ==============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Custom Enums
CREATE TYPE order_status AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'SERVED',
  'CLOSED',
  'CANCELLED',
  'REJECTED'
);

CREATE TYPE payment_status AS ENUM (
  'CREATED',
  'PENDING',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'CANCELLED',
  'PARTIALLY_REFUNDED',
  'REFUNDED'
);

CREATE TYPE table_session_status AS ENUM (
  'OPEN',
  'PAYMENT_PENDING',
  'CLOSED',
  'EXPIRED'
);

-- 3. Locations
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Dining Tables
CREATE TABLE IF NOT EXISTS dining_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  seats INTEGER NOT NULL DEFAULT 2,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Table QR Tokens
CREATE TABLE IF NOT EXISTS table_qr_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES dining_tables(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Table Sessions
CREATE TABLE IF NOT EXISTS table_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES dining_tables(id) ON DELETE CASCADE,
  status table_session_status NOT NULL DEFAULT 'OPEN',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  guest_count INTEGER NOT NULL DEFAULT 1,
  bill_id UUID,
  session_token_version INTEGER NOT NULL DEFAULT 1,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial Unique Index: Only ONE active OPEN table_session allowed per physical dining table
CREATE UNIQUE INDEX IF NOT EXISTS idx_table_sessions_single_open 
  ON table_sessions (table_id) 
  WHERE status = 'OPEN';

-- Index for session queries by location and status
CREATE INDEX IF NOT EXISTS idx_table_sessions_location_status 
  ON table_sessions (location_id, status);

-- 7. Menu Categories
CREATE TABLE IF NOT EXISTS menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'AVAILABLE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Menu Item Versions (Auditing and versioned descriptions/images)
CREATE TABLE IF NOT EXISTS menu_item_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Menu Prices (Effective-dated pricing in paise integer)
CREATE TABLE IF NOT EXISTS menu_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  amount_paise INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_prices_item_effective 
  ON menu_prices (menu_item_id, effective_from, effective_to);

-- 11. Orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  table_session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
  order_no INTEGER NOT NULL,
  status order_status NOT NULL DEFAULT 'DRAFT',
  service_mode TEXT NOT NULL DEFAULT 'DINE_IN',
  submitted_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  served_at TIMESTAMPTZ,
  subtotal_snapshot INTEGER NOT NULL DEFAULT 0,
  tax_snapshot INTEGER NOT NULL DEFAULT 0,
  total_snapshot INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_orders_location_order_no UNIQUE (location_id, order_no)
);

CREATE INDEX IF NOT EXISTS idx_orders_status_created 
  ON orders (location_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_table_session 
  ON orders (table_session_id);

-- 12. Order Items (Snapshotting item name and unit price at order time)
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  menu_item_version_id UUID REFERENCES menu_item_versions(id) ON DELETE SET NULL,
  name_snapshot TEXT NOT NULL,
  unit_price_snapshot INTEGER NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  line_subtotal INTEGER NOT NULL,
  item_status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id 
  ON order_items (order_id);

-- 13. Order Status History (Audit trail of lifecycle changes)
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status order_status,
  to_status order_status NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id 
  ON order_status_history (order_id, created_at);

-- 14. Bills
CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_session_id UUID NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  subtotal INTEGER NOT NULL DEFAULT 0,
  tax INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

-- Foreign key from table_sessions.bill_id to bills.id
ALTER TABLE table_sessions 
  ADD CONSTRAINT fk_table_sessions_bill 
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE SET NULL;

-- 15. Payment Attempts (Idempotent payment tracking)
CREATE TABLE IF NOT EXISTS payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status payment_status NOT NULL DEFAULT 'CREATED',
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  captured_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_bill_id 
  ON payment_attempts (bill_id);
-- ==============================================================================
-- Smol Café — Row Level Security (RLS) Policies (Step 0.4)
-- Deny-by-default, customer table_session isolation, and staff RBAC
-- ==============================================================================

-- 1. Helper Functions
-- Extract table_session_id claim from JWT for anonymous customer sessions
CREATE OR REPLACE FUNCTION current_table_session_id() RETURNS UUID AS $$
  SELECT NULLIF(
    COALESCE(
      current_setting('request.jwt.claims', true)::json->>'table_session_id',
      current_setting('request.jwt.claim.table_session_id', true)
    ),
    ''
  )::UUID;
$$ LANGUAGE sql STABLE;

-- Extract staff role from authenticated JWT claims
CREATE OR REPLACE FUNCTION current_staff_role() RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role',
    current_setting('request.jwt.claims', true)::json->'user_metadata'->>'role'
  );
$$ LANGUAGE sql STABLE;

-- Check if current user is an authenticated staff member
CREATE OR REPLACE FUNCTION is_staff() RETURNS BOOLEAN AS $$
  SELECT auth.role() = 'authenticated' AND current_staff_role() IN ('super_admin', 'admin', 'cashier', 'kitchen', 'chef');
$$ LANGUAGE sql STABLE;

-- Check if current user is admin or super_admin
CREATE OR REPLACE FUNCTION is_admin_or_super() RETURNS BOOLEAN AS $$
  SELECT auth.role() = 'authenticated' AND current_staff_role() IN ('super_admin', 'admin');
$$ LANGUAGE sql STABLE;

-- Check if current user is cashier, admin, or super_admin
CREATE OR REPLACE FUNCTION is_cashier_or_above() RETURNS BOOLEAN AS $$
  SELECT auth.role() = 'authenticated' AND current_staff_role() IN ('super_admin', 'admin', 'cashier');
$$ LANGUAGE sql STABLE;

-- 2. Enable RLS on all 13 Tables (Deny by default)
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_qr_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 3. Public Read Catalogs (Menu & Locations)
-- ------------------------------------------------------------------------------

-- locations: public read, admin write
CREATE POLICY "locations_public_read" ON locations
  FOR SELECT USING (true);

CREATE POLICY "locations_admin_write" ON locations
  FOR ALL USING (is_admin_or_super());

-- dining_tables: public read active tables, admin write
CREATE POLICY "dining_tables_public_read" ON dining_tables
  FOR SELECT USING (active = true OR is_staff());

CREATE POLICY "dining_tables_admin_write" ON dining_tables
  FOR ALL USING (is_admin_or_super());

-- table_qr_tokens: public read active tokens only (for QR scanner resolution), admin write
CREATE POLICY "table_qr_tokens_resolve" ON table_qr_tokens
  FOR SELECT USING (revoked_at IS NULL OR is_staff());

CREATE POLICY "table_qr_tokens_admin_write" ON table_qr_tokens
  FOR ALL USING (is_admin_or_super());

-- menu_categories: public read, admin write
CREATE POLICY "menu_categories_public_read" ON menu_categories
  FOR SELECT USING (true);

CREATE POLICY "menu_categories_admin_write" ON menu_categories
  FOR ALL USING (is_admin_or_super());

-- menu_items: public read, admin write
CREATE POLICY "menu_items_public_read" ON menu_items
  FOR SELECT USING (true);

CREATE POLICY "menu_items_admin_write" ON menu_items
  FOR ALL USING (is_admin_or_super());

-- menu_item_versions: public read, admin write
CREATE POLICY "menu_item_versions_public_read" ON menu_item_versions
  FOR SELECT USING (true);

CREATE POLICY "menu_item_versions_admin_write" ON menu_item_versions
  FOR ALL USING (is_admin_or_super());

-- menu_prices: public read, admin write
CREATE POLICY "menu_prices_public_read" ON menu_prices
  FOR SELECT USING (true);

CREATE POLICY "menu_prices_admin_write" ON menu_prices
  FOR ALL USING (is_admin_or_super());

-- ------------------------------------------------------------------------------
-- 4. Customer Session-Scoped Policies (Isolated to current table_session_id)
-- ------------------------------------------------------------------------------

-- table_sessions:
-- 1) Customers can SELECT their own session
-- 2) Customers can INSERT a new session (or through Server Action)
-- 3) Staff can SELECT/UPDATE all sessions
CREATE POLICY "table_sessions_customer_select" ON table_sessions
  FOR SELECT USING (
    id = current_table_session_id() OR is_staff()
  );

CREATE POLICY "table_sessions_customer_insert" ON table_sessions
  FOR INSERT WITH CHECK (
    id = current_table_session_id() OR is_staff() OR auth.role() = 'anon'
  );

CREATE POLICY "table_sessions_staff_update" ON table_sessions
  FOR UPDATE USING (is_staff());

-- orders:
-- 1) Customers can SELECT and INSERT orders tied to their own table_session_id
-- 2) Staff can SELECT all orders; Cashier/Admin can INSERT/UPDATE; Kitchen can UPDATE status
CREATE POLICY "orders_customer_select" ON orders
  FOR SELECT USING (
    (table_session_id IS NOT NULL AND table_session_id = current_table_session_id())
    OR is_staff()
  );

CREATE POLICY "orders_customer_insert" ON orders
  FOR INSERT WITH CHECK (
    (table_session_id IS NOT NULL AND table_session_id = current_table_session_id())
    OR is_cashier_or_above()
  );

CREATE POLICY "orders_staff_update" ON orders
  FOR UPDATE USING (is_staff());

-- order_items:
-- 1) Customers can SELECT and INSERT items for their session's orders
-- 2) Staff can SELECT all order items, Kitchen/Cashier can UPDATE item status
CREATE POLICY "order_items_customer_select" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND (orders.table_session_id = current_table_session_id() OR is_staff())
    )
  );

CREATE POLICY "order_items_customer_insert" ON order_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND (orders.table_session_id = current_table_session_id() OR is_cashier_or_above())
    )
  );

CREATE POLICY "order_items_staff_update" ON order_items
  FOR UPDATE USING (is_staff());

-- order_status_history:
-- 1) Customers can SELECT audit history for their own orders
-- 2) Staff and backend can INSERT history rows
CREATE POLICY "order_status_history_customer_select" ON order_status_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_status_history.order_id
        AND (orders.table_session_id = current_table_session_id() OR is_staff())
    )
  );

CREATE POLICY "order_status_history_insert" ON order_status_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_status_history.order_id
        AND (orders.table_session_id = current_table_session_id() OR is_staff())
    )
  );

-- bills:
-- 1) Customers can SELECT the bill tied to their own table_session_id
-- 2) Cashier/Admin can manage all bills
CREATE POLICY "bills_customer_select" ON bills
  FOR SELECT USING (
    table_session_id = current_table_session_id() OR is_staff()
  );

CREATE POLICY "bills_staff_write" ON bills
  FOR ALL USING (is_cashier_or_above());

-- payment_attempts:
-- 1) Customers can SELECT and INSERT payment attempts for their own session's bill
-- 2) Cashier/Admin can manage payment attempts
CREATE POLICY "payment_attempts_customer_select" ON payment_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bills
      WHERE bills.id = payment_attempts.bill_id
        AND (bills.table_session_id = current_table_session_id() OR is_staff())
    )
  );

CREATE POLICY "payment_attempts_customer_insert" ON payment_attempts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM bills
      WHERE bills.id = payment_attempts.bill_id
        AND (bills.table_session_id = current_table_session_id() OR is_cashier_or_above())
    )
  );

CREATE POLICY "payment_attempts_staff_update" ON payment_attempts
  FOR UPDATE USING (is_cashier_or_above());
-- ==============================================================================
-- Smol Café — Menu Metadata & JSONB Support (Step 0.5)
-- Adds metadata column to menu_items and menu_item_versions with GIN indexes
-- ==============================================================================

-- Add metadata column to menu_items
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Add metadata column to menu_item_versions
ALTER TABLE menu_item_versions
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Create GIN index for fast JSON querying
CREATE INDEX IF NOT EXISTS idx_menu_items_metadata ON menu_items USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_menu_item_versions_metadata ON menu_item_versions USING gin (metadata);
-- ==============================================================================
-- Smol Café — Atomic Order Submission Transaction (Step 1.3)
-- Server-side price re-validation, idempotency, snapshotting, and audit logging
-- ==============================================================================

-- 1. Ensure idempotency_key column exists on orders table
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_orders_idempotency_key 
  ON orders (idempotency_key);

-- 2. Atomic submit_order PostgreSQL Function
CREATE OR REPLACE FUNCTION submit_order(
  p_location_id UUID,
  p_table_session_id UUID,
  p_idempotency_key TEXT,
  p_items JSONB -- Array of { menu_item_id: UUID, expected_unit_price_paise: INTEGER, qty: INTEGER }
) RETURNS JSONB AS $$
DECLARE
  v_session_status table_session_status;
  v_existing_order orders%ROWTYPE;
  v_order_no INTEGER;
  v_order_id UUID;
  v_item JSONB;
  v_menu_item_id UUID;
  v_expected_price INTEGER;
  v_current_price INTEGER;
  v_item_name TEXT;
  v_version_id UUID;
  v_qty INTEGER;
  v_line_subtotal INTEGER;
  v_subtotal_paise INTEGER := 0;
  v_tax_paise INTEGER := 0;
  v_total_paise INTEGER := 0;
  v_price_conflicts JSONB := '[]'::jsonb;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- 1. Check Idempotency (Prevent double-taps from creating duplicate orders)
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key != '' THEN
    SELECT * INTO v_existing_order FROM orders WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'is_duplicate', true,
        'order_id', v_existing_order.id,
        'order_no', v_existing_order.order_no,
        'total_paise', v_existing_order.total_snapshot
      );
    END IF;
  END IF;

  -- 2. Verify Table Session is OPEN
  SELECT status INTO v_session_status 
  FROM table_sessions 
  WHERE id = p_table_session_id AND location_id = p_location_id;

  IF NOT FOUND OR v_session_status != 'OPEN' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'SESSION_NOT_OPEN',
      'message', 'Your table session is no longer active. Please scan the QR code again.'
    );
  END IF;

  -- 3. Re-validate Current Prices & Catalog Status
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_menu_item_id := (v_item->>'menu_item_id')::UUID;
    v_expected_price := (v_item->>'expected_unit_price_paise')::INTEGER;
    v_qty := (v_item->>'qty')::INTEGER;

    -- Fetch item name and latest version
    SELECT mi.name, mv.id INTO v_item_name, v_version_id
    FROM menu_items mi
    LEFT JOIN menu_item_versions mv ON mv.menu_item_id = mi.id
    WHERE mi.id = v_menu_item_id
    ORDER BY mv.created_at DESC
    LIMIT 1;

    -- Fetch current effective price
    SELECT amount_paise INTO v_current_price
    FROM menu_prices
    WHERE menu_item_id = v_menu_item_id
      AND effective_from <= v_now
      AND (effective_to IS NULL OR effective_to > v_now)
    ORDER BY effective_from DESC
    LIMIT 1;

    IF v_current_price IS NULL OR v_current_price != v_expected_price THEN
      v_price_conflicts := v_price_conflicts || jsonb_build_object(
        'menu_item_id', v_menu_item_id,
        'name', COALESCE(v_item_name, 'Unknown item'),
        'expected_price_paise', v_expected_price,
        'current_price_paise', COALESCE(v_current_price, 0)
      );
    ELSE
      v_subtotal_paise := v_subtotal_paise + (v_current_price * v_qty);
    END IF;
  END LOOP;

  -- If any item had price change, abort and return diff
  IF jsonb_array_length(v_price_conflicts) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PRICE_CHANGED',
      'message', 'Some item prices have changed. Please review your updated order.',
      'changed_items', v_price_conflicts
    );
  END IF;

  -- 4. Calculate Financial Totals
  v_tax_paise := 0;
  v_total_paise := v_subtotal_paise + v_tax_paise;

  -- 5. Generate Next Sequential Order Number for Location
  SELECT COALESCE(MAX(order_no), 0) + 1 INTO v_order_no 
  FROM orders 
  WHERE location_id = p_location_id;

  -- 6. Insert Order Record
  INSERT INTO orders (
    location_id,
    table_session_id,
    order_no,
    status,
    service_mode,
    submitted_at,
    subtotal_snapshot,
    tax_snapshot,
    total_snapshot,
    idempotency_key,
    version
  ) VALUES (
    p_location_id,
    p_table_session_id,
    v_order_no,
    'SUBMITTED',
    'DINE_IN',
    v_now,
    v_subtotal_paise,
    v_tax_paise,
    v_total_paise,
    p_idempotency_key,
    1
  ) RETURNING id INTO v_order_id;

  -- 7. Insert Order Items (Immutable Price & Name Snapshot)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_menu_item_id := (v_item->>'menu_item_id')::UUID;
    v_qty := (v_item->>'qty')::INTEGER;

    SELECT mi.name, mv.id, mp.amount_paise 
    INTO v_item_name, v_version_id, v_current_price
    FROM menu_items mi
    LEFT JOIN menu_item_versions mv ON mv.menu_item_id = mi.id
    JOIN menu_prices mp ON mp.menu_item_id = mi.id
    WHERE mi.id = v_menu_item_id
      AND mp.effective_from <= v_now
      AND (mp.effective_to IS NULL OR mp.effective_to > v_now)
    ORDER BY mv.created_at DESC, mp.effective_from DESC
    LIMIT 1;

    v_line_subtotal := v_current_price * v_qty;

    INSERT INTO order_items (
      order_id,
      menu_item_id,
      menu_item_version_id,
      name_snapshot,
      unit_price_snapshot,
      qty,
      line_subtotal,
      item_status
    ) VALUES (
      v_order_id,
      v_menu_item_id,
      v_version_id,
      COALESCE(v_item_name, 'Unknown Item'),
      v_current_price,
      v_qty,
      v_line_subtotal,
      'PENDING'
    );
  END LOOP;

  -- 8. Insert Order Status History (Audit Trail: DRAFT -> SUBMITTED)
  INSERT INTO order_status_history (
    order_id,
    from_status,
    to_status,
    actor_type,
    created_at
  ) VALUES (
    v_order_id,
    'DRAFT',
    'SUBMITTED',
    'CUSTOMER',
    v_now
  );

  -- 9. Return Success Response
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_no', v_order_no,
    'subtotal_paise', v_subtotal_paise,
    'tax_paise', v_tax_paise,
    'total_paise', v_total_paise
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- ==============================================================================
-- Smol Café — Record Cash Payment & Session Closure Transaction (Step 1.6)
-- Atomic bill generation, payment capture, table closure, and mutation locking
-- ==============================================================================

CREATE OR REPLACE FUNCTION record_cash_payment(
  p_table_session_id UUID,
  p_amount_tendered_paise INTEGER,
  p_staff_identifier TEXT,
  p_idempotency_key TEXT
) RETURNS JSONB AS $$
DECLARE
  v_session table_sessions%ROWTYPE;
  v_subtotal INTEGER := 0;
  v_tax INTEGER := 0;
  v_total INTEGER := 0;
  v_bill_id UUID;
  v_now TIMESTAMPTZ := now();
  v_existing_attempt payment_attempts%ROWTYPE;
BEGIN
  -- 1. Check idempotency (Prevent double cash settlement)
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key != '' THEN
    SELECT * INTO v_existing_attempt FROM payment_attempts WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'is_duplicate', true,
        'bill_id', v_existing_attempt.bill_id,
        'message', 'Payment was already recorded.'
      );
    END IF;
  END IF;

  -- 2. Verify Session exists and is not already closed
  SELECT * INTO v_session FROM table_sessions WHERE id = p_table_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'SESSION_NOT_FOUND', 'message', 'Table session not found.');
  END IF;

  IF v_session.status = 'CLOSED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'SESSION_ALREADY_CLOSED', 'message', 'This dining session is already settled and closed.');
  END IF;

  -- 3. Calculate financial totals across all valid orders in this session
  SELECT 
    COALESCE(SUM(subtotal_snapshot), 0),
    COALESCE(SUM(tax_snapshot), 0),
    COALESCE(SUM(total_snapshot), 0)
  INTO v_subtotal, v_tax, v_total
  FROM orders
  WHERE table_session_id = p_table_session_id
    AND status NOT IN ('CANCELLED', 'REJECTED');

  IF v_total = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'EMPTY_BILL', 'message', 'No payable orders found in this session.');
  END IF;

  IF p_amount_tendered_paise < v_total THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'INSUFFICIENT_AMOUNT', 
      'message', 'Tendered amount is less than the total bill.'
    );
  END IF;

  -- 4. Create or Update Bill Record
  IF v_session.bill_id IS NOT NULL THEN
    UPDATE bills SET
      subtotal = v_subtotal,
      tax = v_tax,
      total = v_total,
      paid_amount = v_total,
      status = 'PAID',
      closed_at = v_now
    WHERE id = v_session.bill_id
    RETURNING id INTO v_bill_id;
  ELSE
    INSERT INTO bills (
      table_session_id,
      status,
      subtotal,
      tax,
      total,
      paid_amount,
      closed_at
    ) VALUES (
      p_table_session_id,
      'PAID',
      v_subtotal,
      v_tax,
      v_total,
      v_total,
      v_now
    ) RETURNING id INTO v_bill_id;
  END IF;

  -- 5. Insert Payment Attempt Record
  INSERT INTO payment_attempts (
    bill_id,
    provider,
    amount,
    currency,
    status,
    idempotency_key,
    created_at,
    captured_at
  ) VALUES (
    v_bill_id,
    'CASH',
    v_total,
    'INR',
    'CAPTURED',
    COALESCE(p_idempotency_key, gen_random_uuid()::text),
    v_now,
    v_now
  );

  -- 6. Close Table Session (Freeing the table)
  UPDATE table_sessions SET
    status = 'CLOSED',
    closed_at = v_now,
    bill_id = v_bill_id,
    last_activity_at = v_now
  WHERE id = p_table_session_id;

  -- 7. Update all orders in this session to SERVED if still active
  UPDATE orders SET
    status = 'SERVED',
    served_at = COALESCE(served_at, v_now),
    updated_at = v_now
  WHERE table_session_id = p_table_session_id
    AND status IN ('SUBMITTED', 'ACCEPTED', 'PREPARING', 'READY');

  RETURN jsonb_build_object(
    'success', true,
    'bill_id', v_bill_id,
    'total_paise', v_total,
    'tendered_paise', p_amount_tendered_paise,
    'change_paise', p_amount_tendered_paise - v_total,
    'staff', p_staff_identifier,
    'message', 'Payment recorded successfully. Table session is closed.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- ==============================================================================
-- Smol Café — Webhook Events & Atomic Processing (Deduplication & Out-of-Order Safety)
-- ==============================================================================

-- 1. Create webhook_events table
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'RAZORPAY',
  provider_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PROCESSED',
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_event_id 
  ON webhook_events (provider_event_id);

-- 2. Atomic process_razorpay_webhook PL/pgSQL Function
CREATE OR REPLACE FUNCTION process_razorpay_webhook(
  p_event_id TEXT,
  p_event_type TEXT,
  p_payload JSONB
) RETURNS JSONB AS $$
DECLARE
  v_inserted_id UUID;
  v_payment_payload JSONB;
  v_razorpay_order_id TEXT;
  v_razorpay_payment_id TEXT;
  v_amount_paise INTEGER;
  v_attempt payment_attempts%ROWTYPE;
  v_bill_id UUID;
  v_bill bills%ROWTYPE;
  v_net_paid INTEGER := 0;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- 1. Deduplication Check via UNIQUE provider_event_id
  INSERT INTO webhook_events (
    provider,
    provider_event_id,
    event_type,
    payload,
    status,
    processed_at
  ) VALUES (
    'RAZORPAY',
    p_event_id,
    p_event_type,
    p_payload,
    'PROCESSED',
    v_now
  ) ON CONFLICT (provider_event_id) DO NOTHING
  RETURNING id INTO v_inserted_id;

  -- If no row was inserted, this event was already processed (Dedupe hit!)
  IF v_inserted_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_duplicate', true,
      'event_id', p_event_id,
      'message', 'Webhook event already processed (idempotent acknowledge).'
    );
  END IF;

  -- Extract payment and order details from payload
  v_payment_payload := p_payload->'payload'->'payment'->'entity';
  IF v_payment_payload IS NOT NULL THEN
    v_razorpay_payment_id := v_payment_payload->>'id';
    v_razorpay_order_id := v_payment_payload->>'order_id';
    v_amount_paise := (v_payment_payload->>'amount')::INTEGER;
  END IF;

  -- If no payment entity found (e.g. order.paid or refund), try order entity
  IF v_razorpay_order_id IS NULL THEN
    v_razorpay_order_id := p_payload->'payload'->'order'->'entity'->>'id';
  END IF;

  -- 2. Handle 'payment.captured' Event
  IF p_event_type = 'payment.captured' OR p_event_type = 'order.paid' THEN
    -- Find the associated payment attempt by razorpay order id or payment id
    SELECT * INTO v_attempt 
    FROM payment_attempts 
    WHERE idempotency_key = v_razorpay_order_id OR id = v_razorpay_payment_id
    LIMIT 1;

    IF FOUND THEN
      v_bill_id := v_attempt.bill_id;

      -- Update payment attempt to CAPTURED
      UPDATE payment_attempts SET
        status = 'CAPTURED',
        captured_at = v_now
      WHERE id = v_attempt.id;

      -- Calculate Net Paid Amount from all successful captures for this bill
      SELECT COALESCE(SUM(amount), 0) INTO v_net_paid
      FROM payment_attempts
      WHERE bill_id = v_bill_id
        AND status = 'CAPTURED';

      -- Fetch bill details
      SELECT * INTO v_bill FROM bills WHERE id = v_bill_id;

      -- Update bill status based on net paid calculation
      IF v_bill.id IS NOT NULL THEN
        IF v_net_paid >= v_bill.total THEN
          UPDATE bills SET
            paid_amount = v_net_paid,
            status = 'PAID',
            closed_at = COALESCE(closed_at, v_now)
          WHERE id = v_bill_id;

          -- Close table session
          UPDATE table_sessions SET
            status = 'CLOSED',
            closed_at = COALESCE(closed_at, v_now),
            last_activity_at = v_now
          WHERE bill_id = v_bill_id OR id = v_bill.table_session_id;

          -- Update orders to SERVED
          UPDATE orders SET
            status = 'SERVED',
            served_at = COALESCE(served_at, v_now),
            updated_at = v_now
          WHERE table_session_id = v_bill.table_session_id
            AND status IN ('SUBMITTED', 'ACCEPTED', 'PREPARING', 'READY');
        ELSE
          UPDATE bills SET
            paid_amount = v_net_paid,
            status = 'PARTIALLY_PAID'
          WHERE id = v_bill_id;
        END IF;
      END IF;
    END IF;

  -- 3. Handle 'payment.authorized' Event (Out-of-Order Protection)
  ELSIF p_event_type = 'payment.authorized' THEN
    -- DO NOT overwrite if status is already CAPTURED
    UPDATE payment_attempts SET
      status = 'AUTHORIZED'
    WHERE (idempotency_key = v_razorpay_order_id OR id = v_razorpay_payment_id)
      AND status != 'CAPTURED';

  -- 4. Handle 'payment.failed' Event
  ELSIF p_event_type = 'payment.failed' THEN
    -- DO NOT overwrite if status was already CAPTURED
    UPDATE payment_attempts SET
      status = 'FAILED'
    WHERE (idempotency_key = v_razorpay_order_id OR id = v_razorpay_payment_id)
      AND status != 'CAPTURED';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'is_duplicate', false,
    'event_id', p_event_id,
    'event_type', p_event_type,
    'message', 'Webhook processed successfully.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- ==============================================================================
-- Smol Café — Inventory, Recipes & Auto-86 Availability Engine
-- ==============================================================================

-- 1. Units Table (e.g. g, ml, pcs, shots)
CREATE TABLE IF NOT EXISTS units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  symbol TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'weight', -- 'weight', 'volume', 'count'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default standard units
INSERT INTO units (name, symbol, category) VALUES
  ('Gram', 'g', 'weight'),
  ('Kilogram', 'kg', 'weight'),
  ('Millilitre', 'ml', 'volume'),
  ('Litre', 'L', 'volume'),
  ('Piece', 'pcs', 'count'),
  ('Shot', 'shot', 'count')
ON CONFLICT (name) DO NOTHING;

-- 2. Ingredients Table
CREATE TABLE IF NOT EXISTS ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit_id UUID REFERENCES units(id),
  cost_per_unit_paise INTEGER NOT NULL DEFAULT 0,
  min_threshold NUMERIC(12, 4) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ingredients_location_id ON ingredients (location_id);

-- 3. Recipes Table
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipes_menu_item_id ON recipes (menu_item_id);

-- 4. Recipe Components Table
CREATE TABLE IF NOT EXISTS recipe_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  qty_per_item NUMERIC(12, 4) NOT NULL,
  unit_id UUID REFERENCES units(id),
  is_optional BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipe_components_recipe_id ON recipe_components (recipe_id);

-- 5. Append-Only Inventory Movements Table
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('RECEIVE', 'RESERVE', 'RELEASE', 'CONSUME', 'WASTE', 'ADJUST')),
  quantity NUMERIC(12, 4) NOT NULL,
  reference_type TEXT, -- 'ORDER', 'PURCHASE', 'MANUAL_86', 'WASTE', 'AUDIT'
  reference_id UUID,
  actor_type TEXT NOT NULL DEFAULT 'SYSTEM', -- 'SYSTEM', 'CHEF', 'STAFF'
  actor_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_ingredient_id ON inventory_movements (ingredient_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference_id ON inventory_movements (reference_id);

-- 6. Function: Get Available Quantity for an Ingredient
CREATE OR REPLACE FUNCTION get_ingredient_available_qty(p_ingredient_id UUID) 
RETURNS NUMERIC AS $$
DECLARE
  v_available NUMERIC;
BEGIN
  SELECT COALESCE(
    SUM(
      CASE 
        WHEN movement_type IN ('RECEIVE', 'RELEASE') THEN quantity
        WHEN movement_type = 'ADJUST' THEN quantity
        WHEN movement_type IN ('RESERVE', 'CONSUME', 'WASTE') THEN -quantity
        ELSE 0
      END
    ), 0
  ) INTO v_available
  FROM inventory_movements
  WHERE ingredient_id = p_ingredient_id;

  RETURN GREATEST(0, v_available);
END;
$$ LANGUAGE plpgsql STABLE;

-- 7. Function: Servable Quantity for a Menu Item
CREATE OR REPLACE FUNCTION servable_qty(p_menu_item_id UUID) 
RETURNS INTEGER AS $$
DECLARE
  v_item_status TEXT;
  v_active_recipe_id UUID;
  v_min_servable INTEGER := 9999;
  v_comp RECORD;
  v_avail_qty NUMERIC;
  v_comp_servable INTEGER;
  v_has_components BOOLEAN := false;
BEGIN
  -- A. Manual 86 Check: Chef/Admin sold-out override always wins
  SELECT status INTO v_item_status FROM menu_items WHERE id = p_menu_item_id;
  IF NOT FOUND OR v_item_status IN ('SOLD_OUT', '86', 'INACTIVE') THEN
    RETURN 0;
  END IF;

  -- B. Find active recipe
  SELECT id INTO v_active_recipe_id 
  FROM recipes 
  WHERE menu_item_id = p_menu_item_id AND is_active = true 
  ORDER BY version DESC 
  LIMIT 1;

  -- If no active recipe exists, treat as unconstrained
  IF v_active_recipe_id IS NULL THEN
    RETURN 9999;
  END IF;

  -- C. Compute bottleneck across mandatory components
  FOR v_comp IN 
    SELECT ingredient_id, qty_per_item 
    FROM recipe_components 
    WHERE recipe_id = v_active_recipe_id AND is_optional = false
  LOOP
    v_has_components := true;
    v_avail_qty := get_ingredient_available_qty(v_comp.ingredient_id);

    IF v_avail_qty <= 0 OR v_comp.qty_per_item <= 0 THEN
      RETURN 0;
    END IF;

    v_comp_servable := FLOOR(v_avail_qty / v_comp.qty_per_item);
    IF v_comp_servable < v_min_servable THEN
      v_min_servable := v_comp_servable;
    END IF;
  END LOOP;

  IF NOT v_has_components THEN
    RETURN 9999;
  END IF;

  RETURN v_min_servable;
END;
$$ LANGUAGE plpgsql STABLE;

-- 8. Helper: Handle Inventory Transition on Order Status Changes
CREATE OR REPLACE FUNCTION handle_order_inventory_transition(
  p_order_id UUID,
  p_to_status TEXT
) RETURNS VOID AS $$
DECLARE
  v_item RECORD;
  v_recipe_id UUID;
  v_comp RECORD;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- When kitchen moves to PREPARING: Release reservation & record CONSUME
  IF p_to_status = 'PREPARING' THEN
    FOR v_item IN SELECT menu_item_id, qty FROM order_items WHERE order_id = p_order_id
    LOOP
      SELECT id INTO v_recipe_id FROM recipes WHERE menu_item_id = v_item.menu_item_id AND is_active = true LIMIT 1;
      IF v_recipe_id IS NOT NULL THEN
        FOR v_comp IN SELECT ingredient_id, qty_per_item FROM recipe_components WHERE recipe_id = v_recipe_id
        LOOP
          -- 1. Release Reservation
          INSERT INTO inventory_movements (
            ingredient_id, movement_type, quantity, reference_type, reference_id, notes, created_at
          ) VALUES (
            v_comp.ingredient_id, 'RELEASE', v_comp.qty_per_item * v_item.qty, 'ORDER', p_order_id, 'Released on kitchen start prep', v_now
          );

          -- 2. Record Permanent Consumption
          INSERT INTO inventory_movements (
            ingredient_id, movement_type, quantity, reference_type, reference_id, notes, created_at
          ) VALUES (
            v_comp.ingredient_id, 'CONSUME', v_comp.qty_per_item * v_item.qty, 'ORDER', p_order_id, 'Consumed in kitchen cooking', v_now
          );
        END LOOP;
      END IF;
    END LOOP;

  -- When order is CANCELLED or REJECTED: Release any existing reservations
  ELSIF p_to_status IN ('CANCELLED', 'REJECTED') THEN
    FOR v_item IN SELECT menu_item_id, qty FROM order_items WHERE order_id = p_order_id
    LOOP
      SELECT id INTO v_recipe_id FROM recipes WHERE menu_item_id = v_item.menu_item_id AND is_active = true LIMIT 1;
      IF v_recipe_id IS NOT NULL THEN
        FOR v_comp IN SELECT ingredient_id, qty_per_item FROM recipe_components WHERE recipe_id = v_recipe_id
        LOOP
          INSERT INTO inventory_movements (
            ingredient_id, movement_type, quantity, reference_type, reference_id, notes, created_at
          ) VALUES (
            v_comp.ingredient_id, 'RELEASE', v_comp.qty_per_item * v_item.qty, 'ORDER', p_order_id, 'Released on order cancellation', v_now
          );
        END LOOP;
      END IF;
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Update submit_order to Reserve Inventory Atomically in the Same Transaction
CREATE OR REPLACE FUNCTION submit_order(
  p_location_id UUID,
  p_table_session_id UUID,
  p_idempotency_key TEXT,
  p_items JSONB -- Array of { menu_item_id, expected_unit_price_paise, qty }
) RETURNS JSONB AS $$
DECLARE
  v_session_status table_session_status;
  v_existing_order orders%ROWTYPE;
  v_order_no INTEGER;
  v_order_id UUID;
  v_item JSONB;
  v_menu_item_id UUID;
  v_expected_price INTEGER;
  v_current_price INTEGER;
  v_item_name TEXT;
  v_version_id UUID;
  v_qty INTEGER;
  v_servable INTEGER;
  v_line_subtotal INTEGER;
  v_subtotal_paise INTEGER := 0;
  v_tax_paise INTEGER := 0;
  v_total_paise INTEGER := 0;
  v_price_conflicts JSONB := '[]'::jsonb;
  v_stock_conflicts JSONB := '[]'::jsonb;
  v_recipe_id UUID;
  v_comp RECORD;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- 1. Check Idempotency (Prevent double-taps)
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key != '' THEN
    SELECT * INTO v_existing_order FROM orders WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'is_duplicate', true,
        'order_id', v_existing_order.id,
        'order_no', v_existing_order.order_no,
        'total_paise', v_existing_order.total_snapshot
      );
    END IF;
  END IF;

  -- 2. Verify Table Session is OPEN
  SELECT status INTO v_session_status 
  FROM table_sessions 
  WHERE id = p_table_session_id AND location_id = p_location_id;

  IF NOT FOUND OR v_session_status != 'OPEN' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'SESSION_NOT_OPEN',
      'message', 'Your table session is no longer active. Please scan the QR code again.'
    );
  END IF;

  -- 3. Re-validate Current Prices & Servable Stock Quantities
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_menu_item_id := (v_item->>'menu_item_id')::UUID;
    v_expected_price := (v_item->>'expected_unit_price_paise')::INTEGER;
    v_qty := (v_item->>'qty')::INTEGER;

    -- Fetch item name and latest version
    SELECT mi.name, mv.id INTO v_item_name, v_version_id
    FROM menu_items mi
    LEFT JOIN menu_item_versions mv ON mv.menu_item_id = mi.id
    WHERE mi.id = v_menu_item_id
    ORDER BY mv.created_at DESC
    LIMIT 1;

    -- Check Servable Quantity
    v_servable := servable_qty(v_menu_item_id);
    IF v_servable < v_qty THEN
      v_stock_conflicts := v_stock_conflicts || jsonb_build_object(
        'menu_item_id', v_menu_item_id,
        'name', COALESCE(v_item_name, 'Item'),
        'requested_qty', v_qty,
        'servable_qty', v_servable
      );
    END IF;

    -- Fetch current effective price
    SELECT amount_paise INTO v_current_price
    FROM menu_prices
    WHERE menu_item_id = v_menu_item_id
      AND effective_from <= v_now
      AND (effective_to IS NULL OR effective_to > v_now)
    ORDER BY effective_from DESC
    LIMIT 1;

    IF v_current_price IS NULL OR v_current_price != v_expected_price THEN
      v_price_conflicts := v_price_conflicts || jsonb_build_object(
        'menu_item_id', v_menu_item_id,
        'name', COALESCE(v_item_name, 'Unknown item'),
        'expected_price_paise', v_expected_price,
        'current_price_paise', COALESCE(v_current_price, 0)
      );
    ELSE
      v_subtotal_paise := v_subtotal_paise + (v_current_price * v_qty);
    END IF;
  END LOOP;

  -- Stock Conflict Abort
  IF jsonb_array_length(v_stock_conflicts) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'OUT_OF_STOCK',
      'message', 'Some items are currently sold out or have insufficient ingredients.',
      'stock_conflicts', v_stock_conflicts
    );
  END IF;

  -- Price Conflict Abort
  IF jsonb_array_length(v_price_conflicts) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PRICE_CHANGED',
      'message', 'Some item prices have changed. Please review your updated order.',
      'changed_items', v_price_conflicts
    );
  END IF;

  -- 4. Calculate Financial Totals
  v_tax_paise := 0;
  v_total_paise := v_subtotal_paise + v_tax_paise;

  -- 5. Generate Next Sequential Order Number for Location
  SELECT COALESCE(MAX(order_no), 0) + 1 INTO v_order_no 
  FROM orders 
  WHERE location_id = p_location_id;

  -- 6. Insert Order Record
  INSERT INTO orders (
    location_id,
    table_session_id,
    order_no,
    status,
    service_mode,
    submitted_at,
    subtotal_snapshot,
    tax_snapshot,
    total_snapshot,
    idempotency_key,
    version
  ) VALUES (
    p_location_id,
    p_table_session_id,
    v_order_no,
    'SUBMITTED',
    'DINE_IN',
    v_now,
    v_subtotal_paise,
    v_tax_paise,
    v_total_paise,
    p_idempotency_key,
    1
  ) RETURNING id INTO v_order_id;

  -- 7. Insert Order Items & Reserve Ingredient Stock in the SAME Transaction
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_menu_item_id := (v_item->>'menu_item_id')::UUID;
    v_qty := (v_item->>'qty')::INTEGER;

    SELECT mi.name, mv.id, mp.amount_paise 
    INTO v_item_name, v_version_id, v_current_price
    FROM menu_items mi
    LEFT JOIN menu_item_versions mv ON mv.menu_item_id = mi.id
    JOIN menu_prices mp ON mp.menu_item_id = mi.id
    WHERE mi.id = v_menu_item_id
      AND mp.effective_from <= v_now
      AND (mp.effective_to IS NULL OR mp.effective_to > v_now)
    ORDER BY mv.created_at DESC, mp.effective_from DESC
    LIMIT 1;

    v_line_subtotal := v_current_price * v_qty;

    INSERT INTO order_items (
      order_id,
      menu_item_id,
      menu_item_version_id,
      name_snapshot,
      unit_price_snapshot,
      qty,
      line_subtotal,
      item_status
    ) VALUES (
      v_order_id,
      v_menu_item_id,
      v_version_id,
      COALESCE(v_item_name, 'Unknown Item'),
      v_current_price,
      v_qty,
      v_line_subtotal,
      'PENDING'
    );

    -- Reserve Ingredients for this item's active recipe
    SELECT id INTO v_recipe_id FROM recipes WHERE menu_item_id = v_menu_item_id AND is_active = true LIMIT 1;
    IF v_recipe_id IS NOT NULL THEN
      FOR v_comp IN SELECT ingredient_id, qty_per_item FROM recipe_components WHERE recipe_id = v_recipe_id
      LOOP
        INSERT INTO inventory_movements (
          ingredient_id,
          movement_type,
          quantity,
          reference_type,
          reference_id,
          notes,
          created_at
        ) VALUES (
          v_comp.ingredient_id,
          'RESERVE',
          v_comp.qty_per_item * v_qty,
          'ORDER',
          v_order_id,
          'Reserved on order submission',
          v_now
        );
      END LOOP;
    END IF;
  END LOOP;

  -- 8. Insert Order Status History (Audit Trail: DRAFT -> SUBMITTED)
  INSERT INTO order_status_history (
    order_id,
    from_status,
    to_status,
    actor_type,
    created_at
  ) VALUES (
    v_order_id,
    'DRAFT',
    'SUBMITTED',
    'CUSTOMER',
    v_now
  );

  -- 9. Return Success Response
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_no', v_order_no,
    'subtotal_paise', v_subtotal_paise,
    'tax_paise', v_tax_paise,
    'total_paise', v_total_paise
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- ==============================================================================
-- Smol Café — Profiles, Optional Accounts & 24h Order Claiming Engine
-- ==============================================================================

-- 1. Profiles Table linked to auth.users
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  phone TEXT UNIQUE,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Add nullable customer_id to orders and bills
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

ALTER TABLE bills 
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bills_customer_id ON bills(customer_id);

-- 3. Function: claim_session_orders with 24-hour claim window validation
CREATE OR REPLACE FUNCTION claim_session_orders(
  p_profile_id UUID,
  p_session_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_session table_sessions%ROWTYPE;
  v_count INTEGER := 0;
  v_window_start TIMESTAMPTZ := now() - INTERVAL '24 hours';
BEGIN
  -- Verify session exists
  SELECT * INTO v_session FROM table_sessions WHERE id = p_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'SESSION_NOT_FOUND',
      'message', 'Dining table session could not be found.'
    );
  END IF;

  -- Verify 24-Hour Claim Window
  IF v_session.opened_at < v_window_start THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'CLAIM_EXPIRED',
      'message', 'The 24-hour claim window for this dining session has expired.'
    );
  END IF;

  -- Link orders to customer profile
  UPDATE orders 
  SET customer_id = p_profile_id,
      updated_at = now()
  WHERE table_session_id = p_session_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Link bills to customer profile
  UPDATE bills 
  SET customer_id = p_profile_id
  WHERE table_session_id = p_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'claimed_orders_count', v_count,
    'message', format('Successfully linked %s orders to your account!', v_count)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Row Level Security for Profiles & Customer Order History Lookups
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Allow authenticated customers to view their claimed orders
CREATE POLICY "orders_select_claimed" ON orders
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

-- Allow authenticated customers to view their claimed bills
CREATE POLICY "bills_select_claimed" ON bills
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid());
-- ==============================================================================
-- Smol Café — Append-Only Loyalty Ledger & Balance Recomputation Engine
-- ==============================================================================

-- 1. Loyalty Accounts Table
CREATE TABLE IF NOT EXISTS loyalty_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  current_balance_cached INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_profile_id ON loyalty_accounts(profile_id);

-- 2. Loyalty Ledger Table (Append-Only)
CREATE TABLE IF NOT EXISTS loyalty_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loyalty_account_id UUID NOT NULL REFERENCES loyalty_accounts(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('EARN', 'REDEEM', 'EXPIRE', 'ADJUST', 'REVERSAL')),
  points INTEGER NOT NULL,
  related_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  related_bill_id UUID REFERENCES bills(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_account_id ON loyalty_ledger(loyalty_account_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_bill_id ON loyalty_ledger(related_bill_id);

-- 3. Atomic Balance-Recompute Function: record_loyalty_movement
CREATE OR REPLACE FUNCTION record_loyalty_movement(
  p_profile_id UUID,
  p_type TEXT, -- 'EARN', 'REDEEM', 'EXPIRE', 'ADJUST', 'REVERSAL'
  p_points INTEGER,
  p_related_order_id UUID DEFAULT NULL,
  p_related_bill_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_account_id UUID;
  v_new_balance INTEGER := 0;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF p_points <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_POINTS',
      'message', 'Points must be greater than zero.'
    );
  END IF;

  -- 1. Ensure or find loyalty account with ROW-LEVEL LOCK
  INSERT INTO loyalty_accounts (profile_id, current_balance_cached, created_at, updated_at)
  VALUES (p_profile_id, 0, v_now, v_now)
  ON CONFLICT (profile_id) DO NOTHING;

  SELECT id INTO v_account_id
  FROM loyalty_accounts
  WHERE profile_id = p_profile_id
  FOR UPDATE; -- Prevents concurrent balance race conditions

  -- 2. Validate redemption cannot exceed available balance
  IF p_type IN ('REDEEM', 'EXPIRE', 'REVERSAL') THEN
    SELECT COALESCE(
      SUM(
        CASE 
          WHEN type IN ('EARN', 'ADJUST') THEN points
          WHEN type IN ('REDEEM', 'EXPIRE', 'REVERSAL') THEN -points
          ELSE 0
        END
      ), 0
    ) INTO v_new_balance
    FROM loyalty_ledger
    WHERE loyalty_account_id = v_account_id;

    IF v_new_balance < p_points AND p_type = 'REDEEM' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INSUFFICIENT_POINTS',
        'current_balance', v_new_balance,
        'message', 'Insufficient loyalty points balance.'
      );
    END IF;
  END IF;

  -- 3. Insert Append-Only Ledger Row (Immutable audit log)
  INSERT INTO loyalty_ledger (
    loyalty_account_id,
    type,
    points,
    related_order_id,
    related_bill_id,
    notes,
    created_at
  ) VALUES (
    v_account_id,
    p_type,
    p_points,
    p_related_order_id,
    p_related_bill_id,
    p_notes,
    v_now
  );

  -- 4. Recompute exact balance from full ledger history in the SAME transaction
  SELECT COALESCE(
    SUM(
      CASE 
        WHEN type IN ('EARN', 'ADJUST') THEN points
        WHEN type IN ('REDEEM', 'EXPIRE', 'REVERSAL') THEN -points
        ELSE 0
      END
    ), 0
  ) INTO v_new_balance
  FROM loyalty_ledger
  WHERE loyalty_account_id = v_account_id;

  -- 5. Cache the derived balance
  UPDATE loyalty_accounts SET
    current_balance_cached = GREATEST(0, v_new_balance),
    updated_at = v_now
  WHERE id = v_account_id;

  RETURN jsonb_build_object(
    'success', true,
    'account_id', v_account_id,
    'movement_type', p_type,
    'points', p_points,
    'new_balance', GREATEST(0, v_new_balance)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Helper: award_bill_loyalty_points (Hooked into payment capture)
CREATE OR REPLACE FUNCTION award_bill_loyalty_points(p_bill_id UUID)
RETURNS VOID AS $$
DECLARE
  v_bill bills%ROWTYPE;
  v_already_earned BOOLEAN;
  v_points INTEGER;
BEGIN
  SELECT * INTO v_bill FROM bills WHERE id = p_bill_id;

  IF FOUND AND v_bill.customer_id IS NOT NULL AND v_bill.status = 'PAID' THEN
    -- Check if already awarded for this bill
    SELECT EXISTS (
      SELECT 1 FROM loyalty_ledger 
      WHERE related_bill_id = p_bill_id AND type = 'EARN'
    ) INTO v_already_earned;

    IF NOT v_already_earned THEN
      -- 1 point per ₹10 spent (1000 paise)
      v_points := FLOOR(v_bill.paid_amount / 1000);
      IF v_points > 0 THEN
        PERFORM record_loyalty_movement(
          v_bill.customer_id,
          'EARN',
          v_points,
          NULL,
          p_bill_id,
          format('Earned %s points for Bill payment', v_points)
        );
      END IF;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Helper: reverse_bill_loyalty_points (Proportional refund reversal)
CREATE OR REPLACE FUNCTION reverse_bill_loyalty_points(
  p_bill_id UUID,
  p_refund_amount_paise INTEGER,
  p_reason TEXT DEFAULT 'Payment refund reversal'
) RETURNS VOID AS $$
DECLARE
  v_bill bills%ROWTYPE;
  v_points INTEGER;
BEGIN
  SELECT * INTO v_bill FROM bills WHERE id = p_bill_id;

  IF FOUND AND v_bill.customer_id IS NOT NULL THEN
    v_points := FLOOR(p_refund_amount_paise / 1000);
    IF v_points > 0 THEN
      PERFORM record_loyalty_movement(
        v_bill.customer_id,
        'REVERSAL',
        v_points,
        NULL,
        p_bill_id,
        format('Reversed %s points due to refund (%s)', v_points, p_reason)
      );
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- ==============================================================================
-- Smol Café — Rewards Catalog & Atomic Cart Redemption Engine
-- ==============================================================================

-- 1. Rewards Table
CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('FIXED_ITEM', 'FIXED_VALUE', 'PERCENTAGE')),
  discount_value INTEGER NOT NULL DEFAULT 0, -- paise for FIXED_VALUE, percentage (1-100) for PERCENTAGE
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  points_cost INTEGER NOT NULL,
  expiry_days INTEGER DEFAULT 30,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Reward Redemptions Table
CREATE TABLE IF NOT EXISTS reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE RESTRICT,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  points_spent INTEGER NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reward_redemptions_profile_id ON reward_redemptions(profile_id);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_order_id ON reward_redemptions(order_id);

-- 3. Add discount_snapshot to orders
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS discount_snapshot INTEGER NOT NULL DEFAULT 0;

-- 4. Seed Default Rewards
INSERT INTO rewards (name, description, type, discount_value, points_cost, expiry_days, active)
VALUES
  ('₹50 Off Any Order', 'Flat ₹50 discount on your current table bill.', 'FIXED_VALUE', 5000, 50, 30, true),
  ('15% Off Your Meal', 'Enjoy 15% off your entire dining round.', 'PERCENTAGE', 15, 75, 30, true),
  ('Free Bun Maska Treat', 'Complimentary classic Irani Bun Maska up to ₹80.', 'FIXED_VALUE', 8000, 40, 30, true)
ON CONFLICT DO NOTHING;

-- 5. Updated submit_order Function with Atomic Reward Redemption & Points Debit
CREATE OR REPLACE FUNCTION submit_order(
  p_location_id UUID,
  p_table_session_id UUID,
  p_idempotency_key TEXT,
  p_items JSONB, -- Array of { menu_item_id, expected_unit_price_paise, qty }
  p_reward_id UUID DEFAULT NULL,
  p_profile_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_session_status table_session_status;
  v_existing_order orders%ROWTYPE;
  v_order_no INTEGER;
  v_order_id UUID;
  v_item JSONB;
  v_menu_item_id UUID;
  v_expected_price INTEGER;
  v_current_price INTEGER;
  v_item_name TEXT;
  v_version_id UUID;
  v_qty INTEGER;
  v_servable INTEGER;
  v_line_subtotal INTEGER;
  v_subtotal_paise INTEGER := 0;
  v_discount_paise INTEGER := 0;
  v_tax_paise INTEGER := 0;
  v_total_paise INTEGER := 0;
  v_price_conflicts JSONB := '[]'::jsonb;
  v_stock_conflicts JSONB := '[]'::jsonb;
  v_recipe_id UUID;
  v_comp RECORD;
  v_reward rewards%ROWTYPE;
  v_user_balance INTEGER := 0;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- 1. Check Idempotency (Prevent double-taps)
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key != '' THEN
    SELECT * INTO v_existing_order FROM orders WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'is_duplicate', true,
        'order_id', v_existing_order.id,
        'order_no', v_existing_order.order_no,
        'discount_paise', v_existing_order.discount_snapshot,
        'total_paise', v_existing_order.total_snapshot
      );
    END IF;
  END IF;

  -- 2. Verify Table Session is OPEN
  SELECT status INTO v_session_status 
  FROM table_sessions 
  WHERE id = p_table_session_id AND location_id = p_location_id;

  IF NOT FOUND OR v_session_status != 'OPEN' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'SESSION_NOT_OPEN',
      'message', 'Your table session is no longer active. Please scan the QR code again.'
    );
  END IF;

  -- 3. Re-validate Current Prices & Servable Stock Quantities
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_menu_item_id := (v_item->>'menu_item_id')::UUID;
    v_expected_price := (v_item->>'expected_unit_price_paise')::INTEGER;
    v_qty := (v_item->>'qty')::INTEGER;

    -- Fetch item name and latest version
    SELECT mi.name, mv.id INTO v_item_name, v_version_id
    FROM menu_items mi
    LEFT JOIN menu_item_versions mv ON mv.menu_item_id = mi.id
    WHERE mi.id = v_menu_item_id
    ORDER BY mv.created_at DESC
    LIMIT 1;

    -- Check Servable Quantity
    v_servable := servable_qty(v_menu_item_id);
    IF v_servable < v_qty THEN
      v_stock_conflicts := v_stock_conflicts || jsonb_build_object(
        'menu_item_id', v_menu_item_id,
        'name', COALESCE(v_item_name, 'Item'),
        'requested_qty', v_qty,
        'servable_qty', v_servable
      );
    END IF;

    -- Fetch current effective price
    SELECT amount_paise INTO v_current_price
    FROM menu_prices
    WHERE menu_item_id = v_menu_item_id
      AND effective_from <= v_now
      AND (effective_to IS NULL OR effective_to > v_now)
    ORDER BY effective_from DESC
    LIMIT 1;

    IF v_current_price IS NULL OR v_current_price != v_expected_price THEN
      v_price_conflicts := v_price_conflicts || jsonb_build_object(
        'menu_item_id', v_menu_item_id,
        'name', COALESCE(v_item_name, 'Unknown item'),
        'expected_price_paise', v_expected_price,
        'current_price_paise', COALESCE(v_current_price, 0)
      );
    ELSE
      v_subtotal_paise := v_subtotal_paise + (v_current_price * v_qty);
    END IF;
  END LOOP;

  -- Stock Conflict Abort
  IF jsonb_array_length(v_stock_conflicts) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'OUT_OF_STOCK',
      'message', 'Some items are currently sold out or have insufficient ingredients.',
      'stock_conflicts', v_stock_conflicts
    );
  END IF;

  -- Price Conflict Abort
  IF jsonb_array_length(v_price_conflicts) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PRICE_CHANGED',
      'message', 'Some item prices have changed. Please review your updated order.',
      'changed_items', v_price_conflicts
    );
  END IF;

  -- 4. Server-Side Reward & Discount Validation
  IF p_reward_id IS NOT NULL THEN
    IF p_profile_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'AUTH_REQUIRED',
        'message', 'Please sign in to redeem loyalty rewards.'
      );
    END IF;

    SELECT * INTO v_reward FROM rewards WHERE id = p_reward_id AND active = true;
    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INVALID_REWARD',
        'message', 'Selected reward is inactive or does not exist.'
      );
    END IF;

    -- Check customer points balance
    SELECT COALESCE(current_balance_cached, 0) INTO v_user_balance
    FROM loyalty_accounts
    WHERE profile_id = p_profile_id;

    IF v_user_balance < v_reward.points_cost THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INSUFFICIENT_POINTS',
        'message', format('Insufficient points. You need %s points for this reward.', v_reward.points_cost)
      );
    END IF;

    -- Calculate Discount Amount
    IF v_reward.type = 'PERCENTAGE' THEN
      v_discount_paise := FLOOR(v_subtotal_paise * v_reward.discount_value / 100);
    ELSIF v_reward.type = 'FIXED_VALUE' THEN
      v_discount_paise := LEAST(v_subtotal_paise, v_reward.discount_value);
    ELSIF v_reward.type = 'FIXED_ITEM' THEN
      v_discount_paise := LEAST(v_subtotal_paise, v_reward.discount_value);
    END IF;
  END IF;

  -- 5. Calculate Final Financial Totals
  v_tax_paise := 0;
  v_total_paise := GREATEST(0, (v_subtotal_paise - v_discount_paise) + v_tax_paise);

  -- 6. Generate Next Sequential Order Number
  SELECT COALESCE(MAX(order_no), 0) + 1 INTO v_order_no 
  FROM orders 
  WHERE location_id = p_location_id;

  -- 7. Insert Order Record
  INSERT INTO orders (
    location_id,
    table_session_id,
    customer_id,
    order_no,
    status,
    service_mode,
    submitted_at,
    subtotal_snapshot,
    discount_snapshot,
    tax_snapshot,
    total_snapshot,
    idempotency_key,
    version
  ) VALUES (
    p_location_id,
    p_table_session_id,
    p_profile_id,
    v_order_no,
    'SUBMITTED',
    'DINE_IN',
    v_now,
    v_subtotal_paise,
    v_discount_paise,
    v_tax_paise,
    v_total_paise,
    p_idempotency_key,
    1
  ) RETURNING id INTO v_order_id;

  -- 8. Debit Points & Record Reward Redemption in the SAME Transaction
  IF p_reward_id IS NOT NULL AND v_discount_paise > 0 THEN
    -- Debit loyalty ledger
    PERFORM record_loyalty_movement(
      p_profile_id,
      'REDEEM',
      v_reward.points_cost,
      v_order_id,
      NULL,
      format('Redeemed reward: %s (Saved ₹%s)', v_reward.name, (v_discount_paise / 100))
    );

    -- Insert reward_redemptions
    INSERT INTO reward_redemptions (
      reward_id,
      profile_id,
      order_id,
      points_spent,
      redeemed_at
    ) VALUES (
      p_reward_id,
      p_profile_id,
      v_order_id,
      v_reward.points_cost,
      v_now
    );
  END IF;

  -- 9. Insert Order Items & Reserve Stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_menu_item_id := (v_item->>'menu_item_id')::UUID;
    v_qty := (v_item->>'qty')::INTEGER;

    SELECT mi.name, mv.id, mp.amount_paise 
    INTO v_item_name, v_version_id, v_current_price
    FROM menu_items mi
    LEFT JOIN menu_item_versions mv ON mv.menu_item_id = mi.id
    JOIN menu_prices mp ON mp.menu_item_id = mi.id
    WHERE mi.id = v_menu_item_id
      AND mp.effective_from <= v_now
      AND (mp.effective_to IS NULL OR mp.effective_to > v_now)
    ORDER BY mv.created_at DESC, mp.effective_from DESC
    LIMIT 1;

    v_line_subtotal := v_current_price * v_qty;

    INSERT INTO order_items (
      order_id,
      menu_item_id,
      menu_item_version_id,
      name_snapshot,
      unit_price_snapshot,
      qty,
      line_subtotal,
      item_status
    ) VALUES (
      v_order_id,
      v_menu_item_id,
      v_version_id,
      COALESCE(v_item_name, 'Unknown Item'),
      v_current_price,
      v_qty,
      v_line_subtotal,
      'PENDING'
    );

    -- Reserve Ingredients
    SELECT id INTO v_recipe_id FROM recipes WHERE menu_item_id = v_menu_item_id AND is_active = true LIMIT 1;
    IF v_recipe_id IS NOT NULL THEN
      FOR v_comp IN SELECT ingredient_id, qty_per_item FROM recipe_components WHERE recipe_id = v_recipe_id
      LOOP
        INSERT INTO inventory_movements (
          ingredient_id,
          movement_type,
          quantity,
          reference_type,
          reference_id,
          notes,
          created_at
        ) VALUES (
          v_comp.ingredient_id,
          'RESERVE',
          v_comp.qty_per_item * v_qty,
          'ORDER',
          v_order_id,
          'Reserved on order submission',
          v_now
        );
      END LOOP;
    END IF;
  END LOOP;

  -- 10. Audit History
  INSERT INTO order_status_history (
    order_id,
    from_status,
    to_status,
    actor_type,
    created_at
  ) VALUES (
    v_order_id,
    'DRAFT',
    'SUBMITTED',
    'CUSTOMER',
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_no', v_order_no,
    'subtotal_paise', v_subtotal_paise,
    'discount_paise', v_discount_paise,
    'tax_paise', v_tax_paise,
    'total_paise', v_total_paise
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- ==============================================================================
-- Smol Café — Admin Blackboard Daily Specials & Announcements
-- ==============================================================================

-- 1. Create blackboard_posts table
CREATE TABLE IF NOT EXISTS blackboard_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blackboard_active_schedule 
  ON blackboard_posts(active, starts_at, ends_at);

-- 2. Seed Initial Chalkboard Note
INSERT INTO blackboard_posts (title, body, active, starts_at, ends_at)
VALUES (
  'Today at Smol Café ☕',
  'Freshly baked batch of Warm Maska Buns straight from the oven at 3:30 PM. Pair with our signature Karak Chai for the ultimate afternoon treat!',
  true,
  now(),
  now() + INTERVAL '7 days'
) ON CONFLICT DO NOTHING;
-- ==============================================================================
-- Smol Café — Community Events ("What's On") & Lightweight RSVPs
-- ==============================================================================

-- 1. Create cafe_events table
CREATE TABLE IF NOT EXISTS cafe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  capacity INTEGER NOT NULL DEFAULT 20,
  join_url_or_note TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cafe_events_starts_at ON cafe_events(starts_at);

-- 2. Create event_rsvps table
CREATE TABLE IF NOT EXISTS event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES cafe_events(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  guest_name TEXT,
  guest_contact TEXT,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_id ON event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_profile_id ON event_rsvps(profile_id);

-- 3. Seed Initial Community Events
INSERT INTO cafe_events (title, description, starts_at, ends_at, capacity, join_url_or_note, active)
VALUES
  (
    'Weekend Coffee Brewing Workshop ☕',
    'Hands-on cupping session: Master AeroPress, V60, and Traditional South Indian Filter Coffee brewing with our head barista.',
    now() + INTERVAL '3 days',
    now() + INTERVAL '3 days 2 hours',
    15,
    'Free entry for members • Includes tasting flight & bun bite',
    true
  ),
  (
    'Acoustic Sunday & Chai Jam 🎸',
    'Unplugged indie acoustic evening featuring local artists. Enjoy freshly brewed ginger-cardamom chai and sweet treats.',
    now() + INTERVAL '5 days',
    now() + INTERVAL '5 days 3 hours',
    30,
    'Walk-in friendly • RSVP guarantees community table seating',
    true
  )
ON CONFLICT DO NOTHING;
-- ==============================================================================
-- Smol Café — Jukebox Music Request & Collaborative Voting Subsystem
-- ==============================================================================

-- 1. Music Sessions Table
CREATE TABLE IF NOT EXISTS music_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED')) DEFAULT 'OPEN',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_music_sessions_location_status ON music_sessions(location_id, status);

-- 2. Song Requests Table
CREATE TABLE IF NOT EXISTS song_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES music_sessions(id) ON DELETE CASCADE,
  table_session_id UUID NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
  track_name TEXT NOT NULL,
  artist TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'QUEUED', 'PLAYING', 'PLAYED', 'REJECTED', 'SKIPPED')) DEFAULT 'PENDING',
  vote_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_song_requests_session_status ON song_requests(session_id, status);
CREATE INDEX IF NOT EXISTS idx_song_requests_votes ON song_requests(vote_count DESC);

-- 3. Song Votes Table (1 vote per table per track)
CREATE TABLE IF NOT EXISTS song_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES song_requests(id) ON DELETE CASCADE,
  table_session_id UUID NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_song_votes_request_table UNIQUE (request_id, table_session_id)
);

CREATE INDEX IF NOT EXISTS idx_song_votes_table_session ON song_votes(table_session_id);

-- 4. Atomic Song Request Submission with 15-Minute Rate Limiting
CREATE OR REPLACE FUNCTION submit_song_request(
  p_location_id UUID,
  p_table_session_id UUID,
  p_track_name TEXT,
  p_artist TEXT
) RETURNS JSONB AS $$
DECLARE
  v_session_id UUID;
  v_recent_requests INTEGER;
  v_request_id UUID;
  v_clean_track TEXT;
  v_clean_artist TEXT;
BEGIN
  v_clean_track := TRIM(p_track_name);
  v_clean_artist := TRIM(p_artist);

  IF v_clean_track = '' OR v_clean_artist = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_INPUT', 'message', 'Track name and artist are required.');
  END IF;

  -- 1. Find Open Music Session for this location
  SELECT id INTO v_session_id
  FROM music_sessions
  WHERE location_id = p_location_id AND status = 'OPEN'
  ORDER BY opened_at DESC
  LIMIT 1;

  IF v_session_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SESSION_CLOSED', 'message', 'The café jukebox is currently closed.');
  END IF;

  -- 2. Check Rate Limit: Max 3 active/recent requests in rolling 15 minutes per table
  SELECT COUNT(*) INTO v_recent_requests
  FROM song_requests
  WHERE table_session_id = p_table_session_id
    AND created_at >= (now() - INTERVAL '15 minutes')
    AND status IN ('PENDING', 'APPROVED', 'QUEUED', 'PLAYING');

  IF v_recent_requests >= 3 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'RATE_LIMITED',
      'message', 'Your table has reached the limit of 3 song requests in 15 minutes. Please wait a bit!'
    );
  END IF;

  -- 3. Insert Song Request (Default PENDING for Staff DJ approval)
  INSERT INTO song_requests (
    session_id,
    table_session_id,
    track_name,
    artist,
    status,
    vote_count
  ) VALUES (
    v_session_id,
    p_table_session_id,
    v_clean_track,
    v_clean_artist,
    'PENDING',
    1
  ) RETURNING id INTO v_request_id;

  -- 4. Auto-cast submitter table's vote
  INSERT INTO song_votes (request_id, table_session_id)
  VALUES (v_request_id, p_table_session_id)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'message', 'Song requested! It will appear in the queue once approved by the café DJ.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Atomic Upvote Function
CREATE OR REPLACE FUNCTION cast_song_vote(
  p_request_id UUID,
  p_table_session_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_inserted BOOLEAN := false;
  v_new_votes INTEGER;
  v_status TEXT;
BEGIN
  -- Verify request is voteable
  SELECT status INTO v_status FROM song_requests WHERE id = p_request_id;
  IF v_status IS NULL OR v_status NOT IN ('PENDING', 'APPROVED', 'QUEUED') THEN
    RETURN jsonb_build_object('success', false, 'message', 'This track is no longer in the voting queue.');
  END IF;

  -- Insert Vote (Strictly 1 per table session)
  BEGIN
    INSERT INTO song_votes (request_id, table_session_id)
    VALUES (p_request_id, p_table_session_id);
    v_inserted := true;
  EXCEPTION WHEN unique_violation THEN
    v_inserted := false;
  END;

  IF NOT v_inserted THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_VOTED', 'message', 'Your table has already voted for this track!');
  END IF;

  -- Update vote count
  UPDATE song_requests
  SET vote_count = vote_count + 1, updated_at = now()
  WHERE id = p_request_id
  RETURNING vote_count INTO v_new_votes;

  RETURN jsonb_build_object(
    'success', true,
    'vote_count', v_new_votes,
    'message', 'Vote recorded!'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Seed Initial Open Session & Lo-Fi Lounge Track
DO $$
DECLARE
  v_loc_id UUID;
  v_sess_id UUID;
  v_tsess_id UUID;
  v_req_id UUID;
BEGIN
  SELECT id INTO v_loc_id FROM locations LIMIT 1;
  IF v_loc_id IS NOT NULL THEN
    INSERT INTO music_sessions (location_id, status)
    VALUES (v_loc_id, 'OPEN')
    RETURNING id INTO v_sess_id;

    SELECT id INTO v_tsess_id FROM table_sessions WHERE location_id = v_loc_id LIMIT 1;
    IF v_tsess_id IS NOT NULL AND v_sess_id IS NOT NULL THEN
      -- Playing track
      INSERT INTO song_requests (session_id, table_session_id, track_name, artist, status, vote_count)
      VALUES (v_sess_id, v_tsess_id, 'Chai & Rain Lo-fi Chill', 'Smol Beats', 'PLAYING', 8)
      RETURNING id INTO v_req_id;

      -- Queued track
      INSERT INTO song_requests (session_id, table_session_id, track_name, artist, status, vote_count)
      VALUES (v_sess_id, v_tsess_id, 'Coffee Shop Acoustic Dreams', 'Indie Barista Ensemble', 'QUEUED', 5);
    END IF;
  END IF;
END $$;
-- ==============================================================================
-- Smol Café — Basic Procurement & Goods Receipt Engine
-- ==============================================================================

-- 1. Vendors Table
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  tax_id TEXT, -- GSTIN
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Purchase Orders Table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL UNIQUE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED')) DEFAULT 'DRAFT',
  total_amount_paise INTEGER NOT NULL DEFAULT 0,
  expected_delivery_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor ON purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);

-- 3. Purchase Order Lines Table
CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  ordered_qty NUMERIC(12, 3) NOT NULL,
  received_qty NUMERIC(12, 3) NOT NULL DEFAULT 0,
  unit_cost_paise INTEGER NOT NULL,
  line_total_paise INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_lines_po_id ON purchase_order_lines(po_id);
CREATE INDEX IF NOT EXISTS idx_po_lines_ingredient ON purchase_order_lines(ingredient_id);

-- 4. Goods Receipts (GRN) Table
CREATE TABLE IF NOT EXISTS goods_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_number TEXT NOT NULL UNIQUE,
  po_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  invoice_no TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goods_receipts_po ON goods_receipts(po_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_vendor ON goods_receipts(vendor_id);

-- 5. Goods Receipt Lines Table
CREATE TABLE IF NOT EXISTS goods_receipt_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  po_line_id UUID REFERENCES purchase_order_lines(id) ON DELETE SET NULL,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  received_qty NUMERIC(12, 3) NOT NULL,
  unit_cost_paise INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grn_lines_grn ON goods_receipt_lines(grn_id);
CREATE INDEX IF NOT EXISTS idx_grn_lines_ingredient ON goods_receipt_lines(ingredient_id);

-- 6. Atomic Goods Receipt Stored Procedure
-- Ingests inventory into inventory_movements (RECEIVE) and updates PO fulfillment state
CREATE OR REPLACE FUNCTION record_goods_receipt(
  p_po_id UUID,
  p_vendor_id UUID,
  p_invoice_no TEXT,
  p_notes TEXT,
  p_lines JSONB -- Array of { po_line_id, ingredient_id, received_qty, unit_cost_paise }
) RETURNS JSONB AS $$
DECLARE
  v_grn_id UUID;
  v_grn_number TEXT;
  v_grn_seq INTEGER;
  v_line JSONB;
  v_po_line_id UUID;
  v_ingredient_id UUID;
  v_received_qty NUMERIC(12, 3);
  v_unit_cost INTEGER;
  v_now TIMESTAMPTZ := now();
  v_all_received BOOLEAN := true;
  v_any_received BOOLEAN := false;
  v_pol RECORD;
BEGIN
  -- 1. Generate Sequential GRN Number
  SELECT COALESCE(COUNT(*), 0) + 1 INTO v_grn_seq FROM goods_receipts;
  v_grn_number := 'GRN-' || TO_CHAR(v_now, 'YYYYMM') || '-' || LPAD(v_grn_seq::TEXT, 4, '0');

  -- 2. Insert Goods Receipt
  INSERT INTO goods_receipts (
    grn_number,
    po_id,
    vendor_id,
    invoice_no,
    received_at,
    notes
  ) VALUES (
    v_grn_number,
    p_po_id,
    p_vendor_id,
    p_invoice_no,
    v_now,
    p_notes
  ) RETURNING id INTO v_grn_id;

  -- 3. Process Each Line: Log GRN line, insert RECEIVE inventory movement, update PO line
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_po_line_id := (v_line->>'po_line_id')::UUID;
    v_ingredient_id := (v_line->>'ingredient_id')::UUID;
    v_received_qty := (v_line->>'received_qty')::NUMERIC;
    v_unit_cost := (v_line->>'unit_cost_paise')::INTEGER;

    IF v_received_qty > 0 THEN
      -- Insert GRN Line
      INSERT INTO goods_receipt_lines (
        grn_id,
        po_line_id,
        ingredient_id,
        received_qty,
        unit_cost_paise
      ) VALUES (
        v_grn_id,
        v_po_line_id,
        v_ingredient_id,
        v_received_qty,
        v_unit_cost
      );

      -- Ingest to inventory_movements ledger (Append-Only RECEIVE)
      INSERT INTO inventory_movements (
        ingredient_id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        notes,
        created_at
      ) VALUES (
        v_ingredient_id,
        'RECEIVE',
        v_received_qty,
        'PURCHASE_ORDER',
        v_grn_id,
        COALESCE(p_notes, 'Goods received via ' || v_grn_number),
        v_now
      );

      -- Update PO Line received quantity if linked to a PO
      IF v_po_line_id IS NOT NULL THEN
        UPDATE purchase_order_lines
        SET received_qty = received_qty + v_received_qty
        WHERE id = v_po_line_id;
      END IF;
    END IF;
  END LOOP;

  -- 4. If linked to PO, recalculate PO status
  IF p_po_id IS NOT NULL THEN
    FOR v_pol IN SELECT ordered_qty, received_qty FROM purchase_order_lines WHERE po_id = p_po_id
    LOOP
      IF v_pol.received_qty > 0 THEN
        v_any_received := true;
      END IF;
      IF v_pol.received_qty < v_pol.ordered_qty THEN
        v_all_received := false;
      END IF;
    END LOOP;

    IF v_all_received THEN
      UPDATE purchase_orders SET status = 'RECEIVED', updated_at = v_now WHERE id = p_po_id;
    ELSIF v_any_received THEN
      UPDATE purchase_orders SET status = 'PARTIALLY_RECEIVED', updated_at = v_now WHERE id = p_po_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'grn_id', v_grn_id,
    'grn_number', v_grn_number,
    'message', 'Goods Receipt ' || v_grn_number || ' recorded and inventory stock updated successfully.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Seed Initial Vendors
INSERT INTO vendors (name, contact_person, phone, email, address, tax_id, notes)
VALUES
  (
    'Blue Mountain Dairy Co.',
    'Rajesh Sharma',
    '+91 98201 11223',
    'orders@bluemountaindairy.in',
    'Unit 4B, MIDC Industrial Area, Mumbai',
    '27AAAAA0000A1Z5',
    'Supplies fresh full-cream milk, butter, and heavy cream daily before 6 AM.'
  ),
  (
    'Chikmagalur Coffee Estate Direct',
    'Venkatesh Rao',
    '+91 94481 99887',
    'supply@chikmagalurbeans.com',
    'Estate #12, Mallandur Road, Chikmagalur, Karnataka',
    '29BBBBB1111B2Z6',
    'Specialty shade-grown Arabica & Peaberry beans. Roasted in weekly small batches.'
  ),
  (
    'Bombay Bakery & Spice Traders',
    'Firoz Contractor',
    '+91 98210 55443',
    'firoz@bombaybakerysupplies.in',
    'Crawford Market, Fort, Mumbai',
    '27CCCCC2222C3Z7',
    'Flour, active dry yeast, Iranian saffron, and fresh green cardamom pods.'
  )
ON CONFLICT DO NOTHING;
-- ==============================================================================
-- Smol Café — Budgets, Spend Analytics & Vendor Spend Intelligence
-- ==============================================================================

-- 1. Ensure ingredients have a category column
ALTER TABLE ingredients
ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'MISC';

CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients(category);

-- Update categories for known ingredient types
UPDATE ingredients SET category = 'DAIRY' WHERE LOWER(name) LIKE '%milk%' OR LOWER(name) LIKE '%butter%' OR LOWER(name) LIKE '%cream%' OR LOWER(name) LIKE '%paneer%';
UPDATE ingredients SET category = 'COFFEE_BEANS' WHERE LOWER(name) LIKE '%coffee%' OR LOWER(name) LIKE '%espresso%' OR LOWER(name) LIKE '%bean%';
UPDATE ingredients SET category = 'BAKERY_RAW' WHERE LOWER(name) LIKE '%flour%' OR LOWER(name) LIKE '%yeast%' OR LOWER(name) LIKE '%sugar%' OR LOWER(name) LIKE '%bun%' OR LOWER(name) LIKE '%chocolate%';
UPDATE ingredients SET category = 'SPICES_TEA' WHERE LOWER(name) LIKE '%tea%' OR LOWER(name) LIKE '%chai%' OR LOWER(name) LIKE '%cardamom%' OR LOWER(name) LIKE '%saffron%' OR LOWER(name) LIKE '%cinnamon%' OR LOWER(name) LIKE '%clove%';

-- 2. Budgets Table
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  month TEXT NOT NULL, -- Format: YYYY-MM e.g. '2026-08'
  budgeted_amount_paise INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_budget_category_month UNIQUE (category, month)
);

CREATE INDEX IF NOT EXISTS idx_budgets_month ON budgets(month);

-- 3. Seed Default Monthly Budgets for August 2026
INSERT INTO budgets (category, month, budgeted_amount_paise, notes)
VALUES
  ('DAIRY', '2026-08', 4500000, 'Monthly budget for whole milk, butter, and heavy cream (₹45,000)'),
  ('COFFEE_BEANS', '2026-08', 3500000, 'Specialty Arabica roasts & Peaberry (₹35,000)'),
  ('BAKERY_RAW', '2026-08', 2500000, 'Organic flour, butter blocks, Belgian cocoa (₹25,000)'),
  ('SPICES_TEA', '2026-08', 1500000, 'Assam CTC, green cardamom pods, saffron (₹15,000)'),
  ('PACKAGING', '2026-08', 1000000, 'Takeaway cups, compostable straws, pastry bags (₹10,000)'),
  ('MISC', '2026-08', 800000, 'Cleaning supplies and filter papers (₹8,000)')
ON CONFLICT (category, month) DO UPDATE
SET budgeted_amount_paise = EXCLUDED.budgeted_amount_paise,
    notes = EXCLUDED.notes;
-- ==============================================================================
-- Smol Café — Explainable Kitchen Station ETA Engine & Accuracy Logging
-- ==============================================================================

-- 1. Kitchen Stations Table
CREATE TABLE IF NOT EXISTS kitchen_stations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parallel_capacity INTEGER NOT NULL DEFAULT 2,
  expo_buffer_seconds INTEGER NOT NULL DEFAULT 120,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Default Kitchen Stations
INSERT INTO kitchen_stations (id, name, parallel_capacity, expo_buffer_seconds)
VALUES
  ('ESPRESSO_BAR', 'Espresso Bar', 2, 120),
  ('CHAI_BAR', 'Chai & Traditional Brews', 2, 120),
  ('BAKERY_OVEN', 'Bakery & Warming Oven', 2, 120),
  ('HOT_KITCHEN', 'Hot Food & Grills', 1, 120),
  ('COLD_BAR', 'Cold Drinks & Desserts', 2, 120)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    parallel_capacity = EXCLUDED.parallel_capacity,
    expo_buffer_seconds = EXCLUDED.expo_buffer_seconds;

-- 2. Add Base Prep Time and Station Assignment to Menu Items
ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS base_prep_seconds INTEGER NOT NULL DEFAULT 300,
ADD COLUMN IF NOT EXISTS station_id TEXT REFERENCES kitchen_stations(id) DEFAULT 'HOT_KITCHEN';

CREATE INDEX IF NOT EXISTS idx_menu_items_station ON menu_items(station_id);

-- Update stations and prep times based on item names
UPDATE menu_items SET station_id = 'CHAI_BAR', base_prep_seconds = 240 WHERE LOWER(name) LIKE '%chai%' OR LOWER(name) LIKE '%tea%';
UPDATE menu_items SET station_id = 'ESPRESSO_BAR', base_prep_seconds = 300 WHERE LOWER(name) LIKE '%coffee%' OR LOWER(name) LIKE '%espresso%' OR LOWER(name) LIKE '%cappuccino%' OR LOWER(name) LIKE '%latte%' OR LOWER(name) LIKE '%americano%';
UPDATE menu_items SET station_id = 'BAKERY_OVEN', base_prep_seconds = 360 WHERE LOWER(name) LIKE '%maska%' OR LOWER(name) LIKE '%croissant%' OR LOWER(name) LIKE '%toast%' OR LOWER(name) LIKE '%cake%' OR LOWER(name) LIKE '%cookie%';
UPDATE menu_items SET station_id = 'COLD_BAR', base_prep_seconds = 240 WHERE LOWER(name) LIKE '%cold%' OR LOWER(name) LIKE '%iced%' OR LOWER(name) LIKE '%shake%' OR LOWER(name) LIKE '%lemonade%' OR LOWER(name) LIKE '%soda%';
UPDATE menu_items SET station_id = 'HOT_KITCHEN', base_prep_seconds = 480 WHERE station_id = 'HOT_KITCHEN' OR LOWER(name) LIKE '%maggi%' OR LOWER(name) LIKE '%sandwich%' OR LOWER(name) LIKE '%platter%' OR LOWER(name) LIKE '%pasta%' OR LOWER(name) LIKE '%roll%';

-- 3. Add Prediction and Error Logging Columns to Orders Table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS predicted_prep_seconds INTEGER DEFAULT 600,
ADD COLUMN IF NOT EXISTS predicted_ready_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS eta_min_minutes INTEGER DEFAULT 8,
ADD COLUMN IF NOT EXISTS eta_max_minutes INTEGER DEFAULT 12,
ADD COLUMN IF NOT EXISTS served_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS actual_prep_seconds INTEGER,
ADD COLUMN IF NOT EXISTS prediction_error_seconds INTEGER;

-- 4. Stored Procedure: compute_order_eta
-- Evaluates station backlog and returns deterministic ETA range
CREATE OR REPLACE FUNCTION compute_order_eta(
  p_items JSONB, -- Array of { menu_item_id, qty }
  p_location_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_station RECORD;
  v_item JSONB;
  v_menu_item_id UUID;
  v_item_qty INTEGER;
  v_item_prep INTEGER;
  v_item_station TEXT;
  v_max_station_seconds INTEGER := 0;
  v_bottleneck_station TEXT := 'HOT_KITCHEN';
  v_station_backlog INTEGER;
  v_station_new_work INTEGER;
  v_station_total_time INTEGER;
  v_expo_buffer INTEGER := 120;
  v_total_predicted_seconds INTEGER;
  v_eta_min INTEGER;
  v_eta_max INTEGER;
BEGIN
  -- Iterate through each defined station
  FOR v_station IN SELECT id, parallel_capacity, expo_buffer_seconds FROM kitchen_stations
  LOOP
    v_expo_buffer := v_station.expo_buffer_seconds;
    v_station_backlog := 0;
    v_station_new_work := 0;

    -- 1. Calculate active backlog for this station across active orders (SUBMITTED, ACCEPTED, PREPARING)
    SELECT COALESCE(SUM(mi.base_prep_seconds * oi.quantity), 0)
    INTO v_station_backlog
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN menu_items mi ON mi.id = oi.menu_item_id
    WHERE o.location_id = p_location_id
      AND o.status IN ('SUBMITTED', 'ACCEPTED', 'PREPARING')
      AND mi.station_id = v_station.id;

    -- 2. Calculate work for this station in the new order
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_menu_item_id := (v_item->>'menu_item_id')::UUID;
      v_item_qty := (v_item->>'qty')::INTEGER;

      SELECT base_prep_seconds, station_id
      INTO v_item_prep, v_item_station
      FROM menu_items
      WHERE id = v_menu_item_id;

      IF v_item_station = v_station.id THEN
        v_station_new_work := v_station_new_work + (COALESCE(v_item_prep, 300) * v_item_qty);
      END IF;
    END LOOP;

    -- 3. Station wait time considering parallel capacity
    v_station_total_time := CEIL((v_station_backlog + v_station_new_work)::NUMERIC / GREATEST(v_station.parallel_capacity, 1)::NUMERIC);

    IF v_station_total_time > v_max_station_seconds THEN
      v_max_station_seconds := v_station_total_time;
      v_bottleneck_station := v_station.id;
    END IF;
  END LOOP;

  -- Add fixed expo buffer (e.g. 120s for plating & delivery)
  v_total_predicted_seconds := GREATEST(300, v_max_station_seconds + v_expo_buffer);

  -- Convert to honest range
  v_eta_min := GREATEST(3, FLOOR((v_total_predicted_seconds - 60)::NUMERIC / 60)::INTEGER);
  v_eta_max := GREATEST(v_eta_min + 3, CEIL((v_total_predicted_seconds + 120)::NUMERIC / 60)::INTEGER);

  RETURN jsonb_build_object(
    'predicted_prep_seconds', v_total_predicted_seconds,
    'eta_min_minutes', v_eta_min,
    'eta_max_minutes', v_eta_max,
    'bottleneck_station', v_bottleneck_station
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger Function: Log actual served time and prediction error on status = SERVED or COMPLETED
CREATE OR REPLACE FUNCTION log_order_served_accuracy()
RETURNS TRIGGER AS $$
DECLARE
  v_actual_prep INTEGER;
BEGIN
  IF NEW.status = 'SERVED' AND (OLD.status IS NULL OR OLD.status != 'SERVED') THEN
    NEW.served_at := COALESCE(NEW.served_at, now());
    v_actual_prep := EXTRACT(EPOCH FROM (NEW.served_at - NEW.created_at))::INTEGER;
    NEW.actual_prep_seconds := v_actual_prep;
    NEW.prediction_error_seconds := v_actual_prep - COALESCE(NEW.predicted_prep_seconds, 600);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_served_accuracy ON orders;
CREATE TRIGGER trg_order_served_accuracy
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION log_order_served_accuracy();
-- ==============================================================================
-- Smol Café — Owner MFA & Row Level Security (RLS) Hardening (Migration 000017)
-- ==============================================================================

-- 1. Helper function to check Supabase MFA Assurance Level (AAL2)
CREATE OR REPLACE FUNCTION is_admin_mfa_verified() RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    auth.role() = 'authenticated' AND
    (
      auth.jwt()->>'role' IN ('super_admin', 'admin') OR
      auth.jwt()->'app_metadata'->>'role' IN ('super_admin', 'admin')
    ) AND
    (
      auth.jwt()->>'aal' = 'aal2' OR
      current_setting('app.settings.mfa_bypass', true) = 'true'
    )
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Enable RLS on all 22 newer tables (Deny by default)
ALTER TABLE IF EXISTS units ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS recipe_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS loyalty_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reward_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS blackboard_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cafe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS music_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS song_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS song_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS goods_receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS kitchen_stations ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 3. Public Read & Customer Interaction Policies
-- ------------------------------------------------------------------------------

-- Blackboard Posts: Public read active, admin write
CREATE POLICY "blackboard_public_read" ON blackboard_posts
  FOR SELECT USING (active = true OR is_staff());

CREATE POLICY "blackboard_admin_write" ON blackboard_posts
  FOR ALL USING (is_admin_or_super());

-- Cafe Events: Public read, admin write
CREATE POLICY "events_public_read" ON cafe_events
  FOR SELECT USING (true);

CREATE POLICY "events_admin_write" ON cafe_events
  FOR ALL USING (is_admin_or_super());

-- Event RSVPs: Insert allowed, read own profile or staff
CREATE POLICY "rsvps_insert" ON event_rsvps
  FOR INSERT WITH CHECK (true);

CREATE POLICY "rsvps_select" ON event_rsvps
  FOR SELECT USING (auth.uid() = profile_id OR is_staff());

-- Rewards: Public read active, admin write
CREATE POLICY "rewards_public_read" ON rewards
  FOR SELECT USING (active = true OR is_staff());

CREATE POLICY "rewards_admin_write" ON rewards
  FOR ALL USING (is_admin_or_super());

-- Reward Redemptions: Read own profile or staff
CREATE POLICY "reward_redemptions_read" ON reward_redemptions
  FOR SELECT USING (auth.uid() = profile_id OR is_staff());

-- Music Sessions & Songs: Public read active queue, insert requests
CREATE POLICY "music_sessions_read" ON music_sessions
  FOR SELECT USING (true);

CREATE POLICY "song_requests_read" ON song_requests
  FOR SELECT USING (status NOT IN ('REJECTED', 'SKIPPED') OR is_staff());

CREATE POLICY "song_requests_insert" ON song_requests
  FOR INSERT WITH CHECK (true);

CREATE POLICY "song_votes_read" ON song_votes
  FOR SELECT USING (true);

CREATE POLICY "song_votes_insert" ON song_votes
  FOR INSERT WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 4. Staff-Only Inventory & Procurement Policies
-- ------------------------------------------------------------------------------

CREATE POLICY "units_staff_all" ON units
  FOR ALL USING (is_staff());

CREATE POLICY "ingredients_staff_all" ON ingredients
  FOR ALL USING (is_staff());

CREATE POLICY "recipes_staff_all" ON recipes
  FOR ALL USING (is_staff());

CREATE POLICY "inventory_movements_staff_all" ON inventory_movements
  FOR ALL USING (is_staff());

CREATE POLICY "vendors_staff_all" ON vendors
  FOR ALL USING (is_staff());

CREATE POLICY "purchase_orders_staff_all" ON purchase_orders
  FOR ALL USING (is_staff());

CREATE POLICY "goods_receipts_staff_all" ON goods_receipts
  FOR ALL USING (is_staff());

CREATE POLICY "budgets_admin_all" ON budgets
  FOR ALL USING (is_admin_or_super());

CREATE POLICY "kitchen_stations_staff_all" ON kitchen_stations
  FOR ALL USING (is_staff());
-- ========================================================
-- Migration: 20260823000018_performance_indexes.sql
-- High-Frequency Performance Indexes for 10,000+ User Scale
-- ========================================================

-- Table Sessions Indexes
CREATE INDEX IF NOT EXISTS idx_table_sessions_status ON table_sessions(status);
CREATE INDEX IF NOT EXISTS idx_table_sessions_table_id ON table_sessions(table_id);

-- Orders Indexes
CREATE INDEX IF NOT EXISTS idx_orders_table_session_id ON orders(table_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_idempotency_key ON orders(idempotency_key);

-- Order Items Indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_order_items_item_status ON order_items(item_status);

-- Payment Attempts Indexes
CREATE INDEX IF NOT EXISTS idx_payment_attempts_bill_id ON payment_attempts(bill_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_status ON payment_attempts(status);

-- Menu Items & Categories Indexes
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_status ON menu_items(status);

-- Inventory & Movements Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_movements_ingredient_id ON inventory_movements(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON inventory_movements(created_at DESC);

-- Loyalty Accounts & Ledger Indexes
CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_account_id ON loyalty_ledger(loyalty_account_id);

-- Music & Jukebox Indexes
CREATE INDEX IF NOT EXISTS idx_song_requests_session_id ON song_requests(session_id);
CREATE INDEX IF NOT EXISTS idx_song_requests_status ON song_requests(status);

-- ==============================================================================
-- Migration: 20260823000019_realtime_and_order_sync.sql
-- Realtime CDC Subscriptions and Customer Order Synchronization
-- ==============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE orders;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE table_sessions;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE bills;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;

DROP POLICY IF EXISTS "orders_customer_select" ON orders;
CREATE POLICY "orders_customer_select" ON orders
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "order_items_customer_select" ON order_items;
CREATE POLICY "order_items_customer_select" ON order_items
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "table_sessions_customer_select" ON table_sessions;
CREATE POLICY "table_sessions_customer_select" ON table_sessions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "bills_select_claimed" ON bills;
CREATE POLICY "bills_select_claimed" ON bills
  FOR SELECT USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_profiles_phone_e164'
  ) THEN
    ALTER TABLE profiles 
      ADD CONSTRAINT chk_profiles_phone_e164 
      CHECK (phone IS NULL OR phone ~ '^\+[1-9]\d{6,14}$');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_phone_e164 ON profiles(phone);

-- ==============================================================================
-- Migration: 20260823000020_fix_guest_profiles_and_order_sync.sql
-- Fix Guest Mobile Profiles, Foreign Keys & Realtime Full Row CDC Sync
-- ==============================================================================

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;
ALTER TABLE orders 
  ADD CONSTRAINT orders_customer_id_fkey 
  FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER TABLE order_items REPLICA IDENTITY FULL;
ALTER TABLE table_sessions REPLICA IDENTITY FULL;
ALTER TABLE bills REPLICA IDENTITY FULL;
ALTER TABLE profiles REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE orders;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE table_sessions;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE bills;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;

-- ==============================================================================
-- Migration: 20260823000021_performance_indexes_v2.sql
-- High-Performance Composite Indexes for Sub-Millisecond Realtime Query Speed
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_orders_customer_id_created ON orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_orders_table_session_created ON orders(table_session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
CREATE INDEX IF NOT EXISTS idx_bills_table_session_id ON bills(table_session_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_status_open ON table_sessions(status) WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS idx_order_items_order_id_created ON order_items(order_id, created_at ASC);

-- ==============================================================================
-- Migration: 20260823000022_realtime_menu_and_speed_indexes.sql
-- High-Performance Supabase Realtime CDC & Composite Indexes for Instant Sync
-- ==============================================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'PENDING';

ALTER TABLE menu_items REPLICA IDENTITY FULL;
ALTER TABLE menu_categories REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ingredients') THEN
    ALTER TABLE ingredients REPLICA IDENTITY FULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE menu_items;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE menu_categories;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ingredients') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE ingredients;
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;

DROP POLICY IF EXISTS "menu_items_realtime_select" ON menu_items;
CREATE POLICY "menu_items_realtime_select" ON menu_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "menu_categories_realtime_select" ON menu_categories;
CREATE POLICY "menu_categories_realtime_select" ON menu_categories FOR SELECT USING (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ingredients') THEN
    EXECUTE 'DROP POLICY IF EXISTS "ingredients_realtime_select" ON ingredients';
    EXECUTE 'CREATE POLICY "ingredients_realtime_select" ON ingredients FOR SELECT USING (true)';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_realtime_lookup ON orders(id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_orders_pending_queue ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_realtime_lookup ON order_items(order_id, item_status);
CREATE INDEX IF NOT EXISTS idx_menu_items_realtime_lookup ON menu_items(id, status);
CREATE INDEX IF NOT EXISTS idx_table_sessions_active_lookup ON table_sessions(id, status, table_id);

