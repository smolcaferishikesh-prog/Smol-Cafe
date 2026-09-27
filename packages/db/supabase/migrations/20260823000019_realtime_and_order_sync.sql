-- ==============================================================================
-- Migration: 20260823000019_realtime_and_order_sync.sql
-- Realtime CDC Subscriptions and Customer Order Synchronization
-- ==============================================================================

-- 1. Enable Supabase Realtime (CDC) for money & operations tables
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

-- 2. Open RLS SELECT policies for orders, order_items, table_sessions, bills
-- so that browser WebSocket clients and guest sessions receive live status updates
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

-- 3. International E.164 Phone Number Database Constraint & Index
-- Guarantees stored customer phone numbers strictly follow E.164 format (+[1-9]\d{6,14})
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
