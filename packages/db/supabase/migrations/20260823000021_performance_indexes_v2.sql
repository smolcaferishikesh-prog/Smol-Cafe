-- ==============================================================================
-- Migration: 20260823000021_performance_indexes_v2.sql
-- High-Performance Composite Indexes for Sub-Millisecond Realtime Query Speed
-- ==============================================================================

-- 1. Orders Table Composite Indexes (Customer History & Staff Board Queries)
CREATE INDEX IF NOT EXISTS idx_orders_customer_id_created ON orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_orders_table_session_created ON orders(table_session_id, created_at DESC);

-- 2. Profiles Table Index for Phone Lookups
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);

-- 3. Bills & Table Sessions Composite Indexes
CREATE INDEX IF NOT EXISTS idx_bills_table_session_id ON bills(table_session_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_status_open ON table_sessions(status) WHERE status = 'OPEN';

-- 4. Order Items Composite Index for Batch Item Hydration
CREATE INDEX IF NOT EXISTS idx_order_items_order_id_created ON order_items(order_id, created_at ASC);
