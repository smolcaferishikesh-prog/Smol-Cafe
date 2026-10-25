import type {
  OrderStatus,
  PaymentStatus,
  TableSessionStatus,
  Location,
  DiningTable,
  TableQrToken,
  TableSession,
  MenuCategory,
  MenuItem,
  MenuItemVersion,
  MenuPrice,
  Order,
  OrderItem,
  OrderStatusHistory,
  Bill,
  PaymentAttempt,
} from "./schema";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      locations: {
        Row: Location;
        Insert: {
          id?: string;
          name: string;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      dining_tables: {
        Row: DiningTable;
        Insert: {
          id?: string;
          location_id: string;
          label: string;
          seats?: number;
          active?: boolean;
          section?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          location_id?: string;
          label?: string;
          seats?: number;
          active?: boolean;
          section?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      table_qr_tokens: {
        Row: TableQrToken;
        Insert: {
          id?: string;
          table_id: string;
          token_hash: string;
          version?: number;
          revoked_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          table_id?: string;
          token_hash?: string;
          version?: number;
          revoked_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      table_sessions: {
        Row: TableSession;
        Insert: {
          id?: string;
          location_id: string;
          table_id: string;
          status?: TableSessionStatus | string;
          opened_at?: string;
          closed_at?: string | null;
          guest_count?: number;
          bill_id?: string | null;
          session_token_version?: number;
          last_activity_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          location_id?: string;
          table_id?: string;
          status?: TableSessionStatus | string;
          opened_at?: string;
          closed_at?: string | null;
          guest_count?: number;
          bill_id?: string | null;
          session_token_version?: number;
          last_activity_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      menu_categories: {
        Row: MenuCategory;
        Insert: {
          id?: string;
          location_id: string;
          name: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          location_id?: string;
          name?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      menu_items: {
        Row: MenuItem;
        Insert: {
          id?: string;
          category_id: string;
          name: string;
          status?: string;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          name?: string;
          status?: string;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      menu_item_versions: {
        Row: MenuItemVersion;
        Insert: {
          id?: string;
          menu_item_id: string;
          description?: string | null;
          image_url?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          menu_item_id?: string;
          description?: string | null;
          image_url?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Relationships: [];
      };
      menu_prices: {
        Row: MenuPrice;
        Insert: {
          id?: string;
          menu_item_id: string;
          amount_paise: number;
          currency?: string;
          effective_from?: string;
          effective_to?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          menu_item_id?: string;
          amount_paise?: number;
          currency?: string;
          effective_from?: string;
          effective_to?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: Order;
        Insert: {
          id?: string;
          location_id: string;
          table_session_id?: string | null;
          order_no: number;
          status?: OrderStatus | string;
          service_mode?: string;
          submitted_at?: string | null;
          accepted_at?: string | null;
          ready_at?: string | null;
          served_at?: string | null;
          subtotal_snapshot?: number;
          tax_snapshot?: number;
          total_snapshot?: number;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          location_id?: string;
          table_session_id?: string | null;
          order_no?: number;
          status?: OrderStatus | string;
          service_mode?: string;
          submitted_at?: string | null;
          accepted_at?: string | null;
          ready_at?: string | null;
          served_at?: string | null;
          subtotal_snapshot?: number;
          tax_snapshot?: number;
          total_snapshot?: number;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: OrderItem;
        Insert: {
          id?: string;
          order_id: string;
          menu_item_id?: string | null;
          menu_item_version_id?: string | null;
          name_snapshot: string;
          unit_price_snapshot: number;
          qty?: number;
          line_subtotal: number;
          item_status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          menu_item_id?: string | null;
          menu_item_version_id?: string | null;
          name_snapshot?: string;
          unit_price_snapshot?: number;
          qty?: number;
          line_subtotal?: number;
          item_status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      order_status_history: {
        Row: OrderStatusHistory;
        Insert: {
          id?: string;
          order_id: string;
          from_status?: OrderStatus | string | null;
          to_status: OrderStatus | string;
          actor_type: string;
          actor_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          from_status?: OrderStatus | string | null;
          to_status?: OrderStatus | string;
          actor_type?: string;
          actor_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      bills: {
        Row: Bill;
        Insert: {
          id?: string;
          table_session_id: string;
          status?: string;
          subtotal?: number;
          tax?: number;
          total?: number;
          paid_amount?: number;
          created_at?: string;
          closed_at?: string | null;
        };
        Update: {
          id?: string;
          table_session_id?: string;
          status?: string;
          subtotal?: number;
          tax?: number;
          total?: number;
          paid_amount?: number;
          created_at?: string;
          closed_at?: string | null;
        };
        Relationships: [];
      };
      payment_attempts: {
        Row: PaymentAttempt;
        Insert: {
          id?: string;
          bill_id: string;
          provider: string;
          amount: number;
          currency?: string;
          status?: PaymentStatus | string;
          idempotency_key: string;
          created_at?: string;
          captured_at?: string | null;
        };
        Update: {
          id?: string;
          bill_id?: string;
          provider?: string;
          amount?: number;
          currency?: string;
          status?: PaymentStatus | string;
          idempotency_key?: string;
          created_at?: string;
          captured_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      order_status: OrderStatus;
      payment_status: PaymentStatus;
      table_session_status: TableSessionStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
