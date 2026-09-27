-- ==============================================================================
-- Migration: 20260823000022_realtime_menu_and_speed_indexes.sql
-- High-Performance Supabase Realtime CDC & Composite Indexes for Instant Sync
-- ==============================================================================

-- 1. Ensure payment_status column exists on orders table safely
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'PENDING';

-- 2. Set REPLICA IDENTITY FULL on menu_items, ingredients, menu_categories
ALTER TABLE menu_items REPLICA IDENTITY FULL;
ALTER TABLE menu_categories REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ingredients') THEN
    ALTER TABLE ingredients REPLICA IDENTITY FULL;
  END IF;
END $$;

-- 3. Add menu_items, ingredients, menu_categories to Supabase Realtime CDC publication
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

-- 4. Public Read RLS Policies for Realtime streaming
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

-- 5. Speed Indexes for Near-Instant Filtering & Hydration
CREATE INDEX IF NOT EXISTS idx_orders_realtime_lookup ON orders(id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_orders_pending_queue ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_realtime_lookup ON order_items(order_id, item_status);
CREATE INDEX IF NOT EXISTS idx_menu_items_realtime_lookup ON menu_items(id, status);
CREATE INDEX IF NOT EXISTS idx_table_sessions_active_lookup ON table_sessions(id, status, table_id);
