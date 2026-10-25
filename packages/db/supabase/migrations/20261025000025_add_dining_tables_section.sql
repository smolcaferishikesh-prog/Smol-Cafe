-- Migration: Add section column to dining_tables table and backfill current values
-- Smol Café Tapovan Rishikesh

ALTER TABLE dining_tables ADD COLUMN IF NOT EXISTS section TEXT DEFAULT 'smol-cafe';

-- Create index on section for quick zone filtering
CREATE INDEX IF NOT EXISTS idx_dining_tables_section ON dining_tables(section);

-- Backfill initial floor zones for existing tables
UPDATE dining_tables SET section = 'Rooms' WHERE label IN ('3.2', '3.3', '4.1');
UPDATE dining_tables SET section = 'smol-cafe' WHERE label IN ('2.1', '2.2', '2.3', '3.1', 'Smol Cafe');
UPDATE dining_tables SET section = 'smol-lounge' WHERE label IN ('Smol Lounge');
UPDATE dining_tables SET section = 'smol-terrace' WHERE label IN ('Smol Terrace', '11');
