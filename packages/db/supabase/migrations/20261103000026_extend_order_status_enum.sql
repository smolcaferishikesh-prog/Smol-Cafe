-- ==============================================================================
-- Smol Café — Migration 20261103000026: Extend order_status Enum
-- Adds PENDING_CONFIRMATION, CONFIRMED, and COMPLETED to order_status enum
-- ==============================================================================

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'PENDING_CONFIRMATION';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'CONFIRMED';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'COMPLETED';

