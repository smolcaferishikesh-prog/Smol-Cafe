/**
 * Core schema types and enums for Smol Café.
 */

export type OrderStatus =
  | "DRAFT"
  | "PENDING_CONFIRMATION"
  | "SUBMITTED"
  | "CONFIRMED"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "SERVED"
  | "CLOSED"
  | "CANCELLED"
  | "REJECTED";

export type PaymentStatus =
  | "CREATED"
  | "PENDING"
  | "AUTHORIZED"
  | "CAPTURED"
  | "FAILED"
  | "CANCELLED"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED";

export type TableSessionStatus = "OPEN" | "PAYMENT_PENDING" | "CLOSED" | "EXPIRED";

export interface Location {
  id: string;
  name: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface DiningTable {
  id: string;
  location_id: string;
  label: string;
  seats: number;
  active: boolean;
  section?: string;
  created_at: string;
  updated_at: string;
}

export interface TableQrToken {
  id: string;
  table_id: string;
  token_hash: string;
  version: number;
  revoked_at: string | null;
  created_at: string;
}

export interface TableSession {
  id: string;
  location_id: string;
  table_id: string;
  status: TableSessionStatus;
  opened_at: string;
  closed_at: string | null;
  guest_count: number;
  bill_id: string | null;
  session_token_version: number;
  last_activity_at: string;
  created_at: string;
}

export interface MenuCategory {
  id: string;
  location_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  status: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MenuItemVersion {
  id: string;
  menu_item_id: string;
  description: string | null;
  image_url: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface MenuPrice {
  id: string;
  menu_item_id: string;
  amount_paise: number;
  currency: string;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  location_id: string;
  table_session_id: string;
  customer_id: string | null;
  customer_session_id?: string | null;
  verification_code?: string | null;
  order_no: number;
  status: OrderStatus;
  service_mode: string;
  instructions?: string | null;
  submitted_at: string | null;
  confirmed_at?: string | null;
  confirmed_by?: string | null;
  accepted_at: string | null;
  ready_at: string | null;
  served_at: string | null;
  subtotal_snapshot: number;
  tax_snapshot: number;
  total_snapshot: number;
  idempotency_key?: string | null;
  version: number;
  predicted_prep_seconds?: number | null;
  predicted_ready_at?: string | null;
  eta_min_minutes?: number | null;
  eta_max_minutes?: number | null;
  actual_prep_seconds?: number | null;
  prediction_error_seconds?: number | null;
  created_at: string;
  updated_at: string;
}

export interface KitchenStation {
  id: string;
  name: string;
  parallel_capacity: number;
  expo_buffer_seconds: number;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  menu_item_version_id: string | null;
  name_snapshot: string;
  unit_price_snapshot: number;
  qty: number;
  line_subtotal: number;
  item_status: string;
  created_at: string;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  actor_type: string;
  actor_id: string | null;
  created_at: string;
}

export interface Bill {
  id: string;
  table_session_id: string;
  customer_id: string | null;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  paid_amount: number;
  created_at: string;
  closed_at: string | null;
}

export interface Profile {
  id: string;
  display_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentAttempt {
  id: string;
  bill_id: string;
  provider: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  idempotency_key: string;
  created_at: string;
  captured_at: string | null;
}

export interface WebhookEvent {
  id: string;
  provider: string;
  provider_event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: string;
  processed_at: string;
  created_at: string;
}

export type InventoryMovementType =
  "RECEIVE" | "RESERVE" | "RELEASE" | "CONSUME" | "WASTE" | "ADJUST";

export interface Unit {
  id: string;
  name: string;
  symbol: string;
  category: string;
  created_at: string;
}

export interface Ingredient {
  id: string;
  location_id: string;
  name: string;
  unit_id: string | null;
  cost_per_unit_paise: number;
  min_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Recipe {
  id: string;
  menu_item_id: string;
  version: number;
  is_active: boolean;
  created_at: string;
}

export interface RecipeComponent {
  id: string;
  recipe_id: string;
  ingredient_id: string;
  qty_per_item: number;
  unit_id: string | null;
  is_optional: boolean;
  created_at: string;
}

export interface InventoryMovement {
  id: string;
  ingredient_id: string;
  movement_type: InventoryMovementType;
  quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  actor_type: string;
  actor_id: string | null;
  notes: string | null;
  created_at: string;
}

export type LoyaltyMovementType = "EARN" | "REDEEM" | "EXPIRE" | "ADJUST" | "REVERSAL";

export interface LoyaltyAccount {
  id: string;
  profile_id: string;
  current_balance_cached: number;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyLedgerEntry {
  id: string;
  loyalty_account_id: string;
  type: LoyaltyMovementType;
  points: number;
  related_order_id: string | null;
  related_bill_id: string | null;
  notes: string | null;
  created_at: string;
}

export type RewardType = "FIXED_ITEM" | "FIXED_VALUE" | "PERCENTAGE";

export interface Reward {
  id: string;
  name: string;
  description: string | null;
  type: RewardType;
  discount_value: number;
  menu_item_id: string | null;
  points_cost: number;
  expiry_days: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RewardRedemption {
  id: string;
  reward_id: string;
  profile_id: string;
  order_id: string | null;
  points_spent: number;
  redeemed_at: string;
}

export interface BlackboardPost {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  active: boolean;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CafeEvent {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
  capacity: number;
  join_url_or_note: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventRsvp {
  id: string;
  event_id: string;
  profile_id: string | null;
  guest_name: string | null;
  guest_contact: string | null;
  registered_at: string;
}

export type SongRequestStatus =
  "PENDING" | "APPROVED" | "QUEUED" | "PLAYING" | "PLAYED" | "REJECTED" | "SKIPPED";

export interface MusicSession {
  id: string;
  location_id: string;
  status: "OPEN" | "CLOSED";
  opened_at: string;
  closed_at: string | null;
  created_at: string;
}

export interface SongRequest {
  id: string;
  session_id: string;
  table_session_id: string;
  track_name: string;
  artist: string;
  status: SongRequestStatus;
  vote_count: number;
  created_at: string;
  updated_at: string;
}

export interface SongVote {
  id: string;
  request_id: string;
  table_session_id: string;
  created_at: string;
}

export interface Vendor {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type PurchaseOrderStatus =
  "DRAFT" | "APPROVED" | "SENT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CLOSED" | "CANCELLED";

export interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_id: string;
  status: PurchaseOrderStatus;
  total_amount_paise: number;
  expected_delivery_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderLine {
  id: string;
  po_id: string;
  ingredient_id: string;
  ordered_qty: number;
  received_qty: number;
  unit_cost_paise: number;
  line_total_paise: number;
  created_at: string;
}

export interface GoodsReceipt {
  id: string;
  grn_number: string;
  po_id: string | null;
  vendor_id: string;
  invoice_no: string | null;
  received_at: string;
  notes: string | null;
  created_at: string;
}

export interface GoodsReceiptLine {
  id: string;
  grn_id: string;
  po_line_id: string | null;
  ingredient_id: string;
  received_qty: number;
  unit_cost_paise: number;
  created_at: string;
}

export type ProcurementCategory =
  "DAIRY" | "COFFEE_BEANS" | "BAKERY_RAW" | "SPICES_TEA" | "PACKAGING" | "MISC";

export interface ProcurementBudget {
  id: string;
  category: ProcurementCategory | string;
  month: string; // YYYY-MM
  budgeted_amount_paise: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
