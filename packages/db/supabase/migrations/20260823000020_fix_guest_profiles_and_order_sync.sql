-- ==============================================================================
-- Migration: 20260823000020_fix_guest_profiles_and_order_sync.sql
-- Fix Guest Mobile Profiles, Foreign Keys & Realtime Full Row CDC Sync
-- ==============================================================================

-- 1. Unlink profiles.id from mandatory auth.users foreign key to allow guest phone profiles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 2. Ensure customer_id on orders references profiles(id) ON DELETE SET NULL
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;
ALTER TABLE orders 
  ADD CONSTRAINT orders_customer_id_fkey 
  FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- 3. Set REPLICA IDENTITY FULL on all core tables to stream complete row payloads via Supabase Realtime CDC
ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER TABLE order_items REPLICA IDENTITY FULL;
ALTER TABLE table_sessions REPLICA IDENTITY FULL;
ALTER TABLE bills REPLICA IDENTITY FULL;
ALTER TABLE profiles REPLICA IDENTITY FULL;

-- 4. Enable Supabase Realtime Publication for orders, order_items, table_sessions, bills, profiles
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
