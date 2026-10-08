-- ==============================================================================
-- Smol Café — Migration 20260823000023: Add Order Instructions
-- Adds instructions column to orders table for customer & cashier prep notes
-- ==============================================================================

-- 1. Add instructions column to orders table if not exists
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS instructions TEXT;

-- 2. Performance index for text search on instructions
CREATE INDEX IF NOT EXISTS idx_orders_instructions 
  ON orders USING gin (to_tsvector('english', instructions)) 
  WHERE instructions IS NOT NULL;
