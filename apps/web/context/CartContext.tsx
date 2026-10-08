"use client";

import React, { createContext, useContext, useState, useMemo } from "react";
import type { MenuItemWithDetails } from "@/lib/queries/menu";

export interface CartItem {
  item: MenuItemWithDetails;
  qty: number;
}

export interface EditingOrderState {
  orderId: string;
  orderNo: number;
  status: string;
  instructions: string;
  tableLabel?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: MenuItemWithDetails, qty?: number) => void;
  updateQty: (itemId: string, delta: number) => void;
  setQty: (itemId: string, qty: number) => void;
  removeItem: (itemId: string) => void;
  clearCart: () => void;
  totalCount: number;
  subtotalPaise: number;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  editingOrder: EditingOrderState | null;
  setEditingOrder: (order: EditingOrderState | null) => void;
  loadOrderForEditing: (
    order: EditingOrderState,
    loadedItems: Array<{ item: MenuItemWithDetails; qty: number }>
  ) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<EditingOrderState | null>(null);

  const addItem = (item: MenuItemWithDetails, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.item.id === item.id);
      if (existing) {
        return prev.map((i) => (i.item.id === item.id ? { ...i, qty: i.qty + qty } : i));
      }
      return [...prev, { item, qty }];
    });
  };

  const updateQty = (itemId: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.item.id === itemId ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const setQty = (itemId: string, qty: number) => {
    if (qty <= 0) {
      removeItem(itemId);
      return;
    }
    setItems((prev) => prev.map((i) => (i.item.id === itemId ? { ...i, qty } : i)));
  };

  const removeItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.item.id !== itemId));
  };

  const clearCart = () => {
    setItems([]);
    setEditingOrder(null);
  };

  const loadOrderForEditing = (
    order: EditingOrderState,
    loadedItems: Array<{ item: MenuItemWithDetails; qty: number }>
  ) => {
    setEditingOrder(order);
    setItems(loadedItems);
    setIsCartOpen(true);
  };

  const totalCount = useMemo(() => items.reduce((sum, item) => sum + item.qty, 0), [items]);

  const subtotalPaise = useMemo(
    () => items.reduce((sum, item) => sum + item.item.pricePaise * item.qty, 0),
    [items]
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        updateQty,
        setQty,
        removeItem,
        clearCart,
        totalCount,
        subtotalPaise,
        isCartOpen,
        openCart: () => setIsCartOpen(true),
        closeCart: () => setIsCartOpen(false),
        editingOrder,
        setEditingOrder,
        loadOrderForEditing,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
