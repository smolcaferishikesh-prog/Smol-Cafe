"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Edit2,
  Trash2,
  Plus,
  Minus,
  Check,
  AlertTriangle,
  Receipt,
  UtensilsCrossed,
  Armchair,
  CreditCard,
  ChefHat,
  Search,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import type { OrderStatus } from "@smol-cafe/db";
import type {
  AdminOrderRecord,
  AdminOrderItem,
  AdminMenuItemRecord,
  EditAdminOrderItemInput,
} from "@/app/admin/actions";
import { editAdminOrderAction, deleteAdminOrderAction } from "@/app/admin/actions";

interface EditOrderModalProps {
  order: AdminOrderRecord;
  availableMenuItems?: AdminMenuItemRecord[];
  allTables?: Array<{ id: string; label: string }>;
  onClose: () => void;
  onOrderUpdated: (updatedRecord?: AdminOrderRecord) => void;
  onOrderDeleted: (orderId: string) => void;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  order,
  availableMenuItems = [],
  allTables = [],
  onClose,
  onOrderUpdated,
  onOrderDeleted,
}) => {
  const [mounted, setMounted] = useState(false);
  const [tableLabel, setTableLabel] = useState(order.tableLabel || "01");
  const [status, setStatus] = useState<OrderStatus>(order.status || "SUBMITTED");
  const [paymentMethod, setPaymentMethod] = useState<string>(
    order.paymentMethod === "CARD" || order.paymentStatus.includes("CARD")
      ? "CARD"
      : order.paymentMethod === "CASH" || order.paymentStatus.includes("CASH")
      ? "CASH"
      : order.paymentMethod === "COMPLIMENTARY" || order.paymentStatus.includes("COMPLIMENTARY")
      ? "COMPLIMENTARY"
      : "UPI"
  );
  const [paymentStatus, setPaymentStatus] = useState<string>(
    order.paymentStatus.includes("UNPAID") || order.paymentStatus.includes("PENDING")
      ? "PENDING"
      : "PAID"
  );
  const [instructions, setInstructions] = useState(order.instructions || "");

  // Initial items transformation
  const initialItems: EditAdminOrderItemInput[] = useMemo(() => {
    if (order.itemsDetail && order.itemsDetail.length > 0) {
      return order.itemsDetail.map((it) => ({
        id: it.id || crypto.randomUUID(),
        menuItemId: it.menuItemId,
        name: it.name,
        qty: it.qty || 1,
        priceRupees: it.priceRupees || 0,
      }));
    }
    // Fallback parsing from string summaries
    return (order.items || ["Artisanal Flat White (x1)"]).map((itStr) => {
      const match = itStr.match(/(.+)\s*\(x(\d+)\)/);
      const name = match ? match[1].trim() : itStr;
      const qty = match ? parseInt(match[2], 10) : 1;
      return {
        id: crypto.randomUUID(),
        name,
        qty: Math.max(1, qty),
        priceRupees: Math.max(50, Math.round(order.totalRupees / Math.max(1, qty))),
      };
    });
  }, [order]);

  const [items, setItems] = useState<EditAdminOrderItemInput[]>(initialItems);

  // Dish Picker State for adding new items
  const [showAddItem, setShowAddItem] = useState(false);
  const [dishSearch, setDishSearch] = useState("");
  const [customDishName, setCustomDishName] = useState("");
  const [customDishPrice, setCustomDishPrice] = useState<number | "">(180);

  // Submission & Deletion State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Recalculate bill figures dynamically
  const subtotalRupees = useMemo(() => {
    return items.reduce((acc, it) => acc + Math.max(0, it.priceRupees) * Math.max(1, it.qty), 0);
  }, [items]);

  const taxRupees = useMemo(() => {
    return Math.round(subtotalRupees * 0.05); // 5% GST
  }, [subtotalRupees]);

  const grandTotalRupees = useMemo(() => {
    return subtotalRupees + taxRupees;
  }, [subtotalRupees, taxRupees]);

  // Quantity handlers
  const handleUpdateQty = (index: number, delta: number) => {
    setItems((prev) => {
      const next = [...prev];
      const cur = next[index];
      const newQty = cur.qty + delta;
      if (newQty <= 0) {
        // Remove if goes below 1
        return next.filter((_, i) => i !== index);
      }
      next[index] = { ...cur, qty: newQty };
      return next;
    });
  };

  const handleUpdatePrice = (index: number, price: number) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], priceRupees: Math.max(0, price) };
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddCatalogItem = (menuItem: AdminMenuItemRecord) => {
    const parsedPrice = parseInt(menuItem.price.replace(/\D/g, ""), 10) || 150;
    // Check if already in order
    const existingIndex = items.findIndex(
      (it) => it.menuItemId === menuItem.id || it.name.toLowerCase() === menuItem.name.toLowerCase()
    );

    if (existingIndex >= 0) {
      handleUpdateQty(existingIndex, 1);
    } else {
      setItems((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          menuItemId: menuItem.id,
          name: menuItem.name,
          qty: 1,
          priceRupees: parsedPrice,
        },
      ]);
    }
    setShowAddItem(false);
    setDishSearch("");
  };

  const handleAddCustomItem = () => {
    if (!customDishName.trim()) return;
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: customDishName.trim(),
        qty: 1,
        priceRupees: typeof customDishPrice === "number" ? customDishPrice : 150,
      },
    ]);
    setCustomDishName("");
    setCustomDishPrice(180);
    setShowAddItem(false);
  };

  // Submit edits (0ms instant optimistic update)
  const handleSaveOrder = async () => {
    if (items.length === 0) {
      setFeedback({ type: "error", text: "Order must contain at least one item." });
      return;
    }

    const previousRecord = { ...order };
    const updatedRecord: AdminOrderRecord = {
      ...order,
      tableLabel,
      status,
      paymentMethod,
      paymentStatus:
        paymentStatus === "PAID"
          ? `PAID (${paymentMethod})`
          : paymentMethod === "COMPLIMENTARY"
          ? "COMPLIMENTARY"
          : "UNPAID (PENDING)",
      instructions,
      items: items.map((it) => `${it.name} (x${it.qty})`),
      itemsDetail: items.map((it) => ({
        id: it.id,
        menuItemId: it.menuItemId,
        name: it.name,
        qty: it.qty,
        priceRupees: it.priceRupees,
        subtotalRupees: it.priceRupees * it.qty,
      })),
      totalRupees: grandTotalRupees,
    };

    // 1. Instant 0ms Optimistic UI update & immediate modal close
    onOrderUpdated(updatedRecord);
    onClose();

    // 2. Background database persistence
    try {
      const res = await editAdminOrderAction({
        orderId: order.id,
        tableLabel,
        status,
        paymentMethod,
        paymentStatus,
        instructions,
        items,
      });

      if (!res.success) {
        // Rollback on failure
        onOrderUpdated(previousRecord);
        console.error("Failed to save order changes:", res.message);
      }
    } catch (err: any) {
      // Rollback on network error
      onOrderUpdated(previousRecord);
      console.error("Unexpected error saving order:", err);
    }
  };

  // Delete Order (0ms instant optimistic update)
  const handleDeleteOrder = async () => {
    const previousRecord = { ...order };

    // 1. Instant 0ms Optimistic removal & modal close
    onOrderDeleted(order.id);
    setShowDeleteConfirm(false);
    onClose();

    // 2. Background database deletion
    try {
      const res = await deleteAdminOrderAction(order.id);
      if (!res.success) {
        // Rollback on failure
        onOrderUpdated(previousRecord);
        console.error("Failed to delete order:", res.message);
      }
    } catch (err: any) {
      onOrderUpdated(previousRecord);
      console.error("Unexpected error deleting order:", err);
    }
  };

  // Filter catalog items
  const filteredCatalog = useMemo(() => {
    if (!dishSearch.trim()) return availableMenuItems.slice(0, 15);
    const q = dishSearch.toLowerCase();
    return availableMenuItems
      .filter((m) => m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q))
      .slice(0, 20);
  }, [availableMenuItems, dishSearch]);

  const defaultTables = [
    "01",
    "02",
    "03",
    "04",
    "05",
    "06",
    "07",
    "08",
    "09",
    "10",
    "11",
    "12",
    "Terrace-01",
    "Terrace-02",
    "Riverside",
  ];

  const resolvedTableOptions = useMemo(() => {
    const set = new Set(defaultTables);
    allTables.forEach((t) => set.add(t.label));
    if (order.tableLabel) set.add(order.tableLabel);
    return Array.from(set);
  }, [allTables, order.tableLabel]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 dark:bg-black/85 p-3 sm:p-4 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-3xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] p-5 sm:p-7 shadow-2xl text-[#241F1C] dark:text-[#FDFBF7] transition-all animate-scale-in max-h-[92vh] overflow-y-auto flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#C9AE8B]/30 dark:border-stone-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#B72E35] to-[#8C1D23] text-white shadow-md">
              <Edit2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg sm:text-xl font-bold text-[#241F1C] dark:text-white">
                  Edit Order #{order.orderNo}
                </h3>
                <span className="rounded-full bg-[#B72E35]/15 dark:bg-[#F2C84B]/20 text-[#B72E35] dark:text-[#F2C84B] px-2.5 py-0.5 text-[10px] font-mono font-bold">
                  Admin Master Edit
                </span>
              </div>
              <p className="font-serif italic text-xs text-[#725039] dark:text-[#C9AE8B]">
                Placed: {order.createdAt || "Recent"} • ID: {order.id.slice(0, 8)}...
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#C9AE8B]/30 dark:border-stone-700 bg-[#F3E7D3] dark:bg-stone-800 text-[#725039] dark:text-stone-400 hover:text-[#241F1C] dark:hover:text-white transition cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Feedback message */}
        {feedback && (
          <div
            className={`mt-4 rounded-xl p-3 text-xs font-mono font-bold flex items-center gap-2 ${
              feedback.type === "success"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300"
                : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300"
            }`}
          >
            {feedback.type === "success" ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        <div className="space-y-5 my-4">
          {/* Section 1: Table & Status & Payment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Table Assignment */}
            <div className="rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#201C19] p-3.5 space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#725039] dark:text-stone-300">
                <Armchair className="h-3.5 w-3.5 text-[#B72E35]" />
                <span>Assigned Table</span>
              </label>
              <select
                value={tableLabel}
                onChange={(e) => setTableLabel(e.target.value)}
                className="w-full rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-xs font-serif font-bold text-[#241F1C] dark:text-white focus:border-[#B72E35] focus:outline-none"
              >
                {resolvedTableOptions.map((lbl) => (
                  <option key={lbl} value={lbl}>
                    Table {lbl}
                  </option>
                ))}
              </select>
            </div>

            {/* Order Status */}
            <div className="rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#201C19] p-3.5 space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#725039] dark:text-stone-300">
                <ChefHat className="h-3.5 w-3.5 text-[#B72E35]" />
                <span>Pipeline Status</span>
              </label>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    "SUBMITTED",
                    "ACCEPTED",
                    "PREPARING",
                    "READY",
                    "SERVED",
                    "CANCELLED",
                  ] as OrderStatus[]
                ).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatus(st)}
                    className={`rounded-lg py-1 px-1.5 text-[10px] font-mono font-bold transition cursor-pointer text-center ${
                      status === st
                        ? st === "CANCELLED"
                          ? "bg-rose-600 text-white shadow-xs"
                          : st === "READY"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-[#B72E35] text-white shadow-xs"
                        : "border border-[#C9AE8B]/30 dark:border-stone-700 bg-white dark:bg-stone-900 text-[#725039] dark:text-stone-400 hover:bg-[#F3E7D3] dark:hover:bg-stone-800"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Method */}
            <div className="rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#201C19] p-3.5 space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#725039] dark:text-stone-300">
                <CreditCard className="h-3.5 w-3.5 text-[#B72E35]" />
                <span>Payment Method</span>
              </label>
              <div className="grid grid-cols-4 gap-1">
                {["UPI", "CASH", "CARD", "COMPLIMENTARY"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPaymentMethod(mode)}
                    className={`rounded-lg py-1 px-1 text-[10px] font-mono font-bold transition cursor-pointer text-center truncate ${
                      paymentMethod === mode
                        ? "bg-[#241F1C] text-[#F3E7D3] dark:bg-white dark:text-[#241F1C] shadow-xs"
                        : "border border-[#C9AE8B]/30 dark:border-stone-700 bg-white dark:bg-stone-900 text-[#725039] dark:text-stone-400 hover:bg-[#F3E7D3] dark:hover:bg-stone-800"
                    }`}
                  >
                    {mode === "COMPLIMENTARY" ? "COMP" : mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Status */}
            <div className="rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#201C19] p-3.5 space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#725039] dark:text-stone-300">
                <Receipt className="h-3.5 w-3.5 text-[#B72E35]" />
                <span>Settlement Status</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {["PAID", "PENDING"].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setPaymentStatus(st)}
                    className={`rounded-lg py-1.5 px-2 text-xs font-mono font-bold transition cursor-pointer text-center ${
                      paymentStatus === st
                        ? st === "PAID"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-amber-600 text-white shadow-xs"
                        : "border border-[#C9AE8B]/30 dark:border-stone-700 bg-white dark:bg-stone-900 text-[#725039] dark:text-stone-400 hover:bg-[#F3E7D3] dark:hover:bg-stone-800"
                    }`}
                  >
                    {st === "PAID" ? "PAID (Collected)" : "PENDING (Unpaid)"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: Items in Order */}
          <div className="rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#201C19] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-serif text-sm font-bold text-[#241F1C] dark:text-white">
                  Order Line Items ({items.length})
                </h4>
                <p className="font-serif italic text-[11px] text-[#725039] dark:text-stone-400">
                  Add, adjust quantity, modify price, or remove items
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddItem(!showAddItem)}
                className="inline-flex items-center gap-1 rounded-xl bg-[#B72E35] text-white hover:bg-[#8C1D23] px-3 py-1.5 text-xs font-mono font-bold shadow-xs transition cursor-pointer active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{showAddItem ? "Close Picker" : "Add Dish"}</span>
              </button>
            </div>

            {/* Dish Picker Accordion */}
            {showAddItem && (
              <div className="rounded-2xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-white dark:bg-stone-900 p-3.5 space-y-3 animate-fade-in shadow-md">
                <div className="flex items-center justify-between">
                  <span className="font-serif text-xs font-bold text-[#241F1C] dark:text-white">
                    Select dish to add:
                  </span>
                  <div className="relative w-48">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[#8C6D53] dark:text-stone-500" />
                    <input
                      type="text"
                      placeholder="Search menu..."
                      value={dishSearch}
                      onChange={(e) => setDishSearch(e.target.value)}
                      className="w-full rounded-lg border border-[#C9AE8B]/40 dark:border-stone-700 bg-[#FAF4EB] dark:bg-stone-800 pl-8 pr-2 py-1 text-xs text-[#241F1C] dark:text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Grid of Dishes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 max-h-44 overflow-y-auto gap-1.5 p-1 border border-[#C9AE8B]/20 dark:border-stone-800 rounded-xl">
                  {filteredCatalog.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleAddCatalogItem(m)}
                      className="flex items-center justify-between p-2 rounded-lg border border-[#C9AE8B]/30 dark:border-stone-800 bg-[#FAF4EB] dark:bg-stone-800/80 hover:bg-[#F3E7D3] dark:hover:bg-stone-700 text-left transition cursor-pointer"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-serif text-xs font-bold text-[#241F1C] dark:text-white truncate">
                          {m.name}
                        </p>
                        <span className="text-[10px] text-[#725039] dark:text-stone-400">
                          {m.category}
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-[#B72E35] dark:text-[#F2C84B] shrink-0">
                        {m.price}
                      </span>
                    </button>
                  ))}
                  {filteredCatalog.length === 0 && (
                    <div className="col-span-2 py-4 text-center text-xs text-[#725039] dark:text-stone-400 italic">
                      No matching dishes found in menu catalog.
                    </div>
                  )}
                </div>

                {/* Add Custom / Off-Menu Item */}
                <div className="pt-2 border-t border-[#C9AE8B]/20 dark:border-stone-800 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-mono text-[#725039] dark:text-stone-400">
                    Or custom item:
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. Extra Oat Milk / Custom Dish"
                    value={customDishName}
                    onChange={(e) => setCustomDishName(e.target.value)}
                    className="flex-1 min-w-[140px] rounded-lg border border-[#C9AE8B]/40 dark:border-stone-700 bg-[#FAF4EB] dark:bg-stone-800 px-2.5 py-1 text-xs text-[#241F1C] dark:text-white focus:outline-none"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-mono">₹</span>
                    <input
                      type="number"
                      placeholder="180"
                      value={customDishPrice}
                      onChange={(e) =>
                        setCustomDishPrice(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      className="w-16 rounded-lg border border-[#C9AE8B]/40 dark:border-stone-700 bg-[#FAF4EB] dark:bg-stone-800 px-2 py-1 text-xs font-mono text-[#241F1C] dark:text-white focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCustomItem}
                    disabled={!customDishName.trim()}
                    className="rounded-lg bg-[#241F1C] text-[#FAF4EB] dark:bg-stone-700 dark:text-white px-3 py-1 text-xs font-mono font-bold hover:bg-[#3D3530] transition disabled:opacity-40 cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            {/* List of Current Items */}
            <div className="divide-y divide-[#C9AE8B]/20 dark:divide-stone-800/80">
              {items.map((it, idx) => (
                <div
                  key={it.id || idx}
                  className="py-2.5 flex items-center justify-between gap-2.5 hover:bg-[#F3E7D3]/30 dark:hover:bg-stone-800/30 px-2 rounded-xl transition"
                >
                  {/* Left: Name and Unit Price */}
                  <div className="flex-1 min-w-0">
                    <p className="font-serif text-sm font-bold text-[#241F1C] dark:text-white truncate">
                      {it.name}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#725039] dark:text-stone-400">
                      <span>₹</span>
                      <input
                        type="number"
                        min="0"
                        value={it.priceRupees}
                        onChange={(e) => handleUpdatePrice(idx, Number(e.target.value) || 0)}
                        className="w-14 rounded border border-[#C9AE8B]/30 dark:border-stone-700 bg-white dark:bg-stone-900 px-1 py-0.5 text-xs text-[#241F1C] dark:text-white focus:outline-none font-mono"
                      />
                      <span>each</span>
                    </div>
                  </div>

                  {/* Right: Quantity Stepper, Line Total, and Delete Button */}
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Stepper */}
                    <div className="flex items-center rounded-lg border border-[#C9AE8B]/40 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden shadow-2xs">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(idx, -1)}
                        className="p-1 hover:bg-[#F3E7D3] dark:hover:bg-stone-800 text-[#725039] dark:text-stone-300 transition cursor-pointer"
                        title="Decrease quantity"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-7 text-center font-mono text-xs font-bold text-[#241F1C] dark:text-white">
                        {it.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(idx, 1)}
                        className="p-1 hover:bg-[#F3E7D3] dark:hover:bg-stone-800 text-[#725039] dark:text-stone-300 transition cursor-pointer"
                        title="Increase quantity"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Line Subtotal */}
                    <span className="font-serif font-bold text-sm text-[#241F1C] dark:text-white w-14 text-right">
                      ₹{it.qty * it.priceRupees}
                    </span>

                    {/* Delete Item Button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1.5 rounded-lg text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 dark:border-rose-900/60 dark:hover:bg-rose-700 transition cursor-pointer shadow-2xs"
                      title="Remove item from order"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {items.length === 0 && (
                <div className="py-6 text-center text-xs font-mono text-rose-600 dark:text-rose-400">
                  No items left in order. Please add at least 1 item or delete the entire order.
                </div>
              )}
            </div>

            {/* Bill Summary Strip */}
            <div className="rounded-xl bg-[#F3E7D3]/60 dark:bg-[#161311] p-3 border border-[#C9AE8B]/30 dark:border-stone-800 font-mono text-xs space-y-1">
              <div className="flex justify-between text-[#725039] dark:text-stone-400">
                <span>Items Subtotal</span>
                <span>₹{subtotalRupees}</span>
              </div>
              <div className="flex justify-between text-[#725039] dark:text-stone-400">
                <span>GST (5% Cafe Tax)</span>
                <span>₹{taxRupees}</span>
              </div>
              <div className="flex justify-between font-serif text-base font-bold text-[#241F1C] dark:text-white pt-1 border-t border-[#C9AE8B]/30 dark:border-stone-800">
                <span>Grand Total</span>
                <span className="text-[#B72E35] dark:text-[#F2C84B]">₹{grandTotalRupees}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Special Notes & Instructions */}
          <div className="rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#201C19] p-3.5 space-y-1.5">
            <label className="text-xs font-mono font-bold text-[#725039] dark:text-stone-300">
              Kitchen Notes &amp; Special Instructions
            </label>
            <textarea
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Less sugar, extra warm milk, allergy notes..."
              className="w-full rounded-xl border border-[#C9AE8B]/40 dark:border-stone-700 bg-white dark:bg-stone-900 p-2.5 text-xs text-[#241F1C] dark:text-white placeholder:text-[#8C6D53] dark:placeholder:text-stone-500 focus:border-[#B72E35] focus:outline-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-2 pt-4 border-t border-[#C9AE8B]/30 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3">
          {/* Danger Delete Order Button */}
          <div>
            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSubmitting || isDeleting}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-600 hover:text-white dark:hover:bg-rose-700 dark:hover:text-white px-3 py-2 text-xs font-mono font-bold transition shadow-xs cursor-pointer active:scale-95"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Order</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-rose-600 font-bold">Confirm delete?</span>
                <button
                  type="button"
                  onClick={handleDeleteOrder}
                  disabled={isDeleting}
                  className="rounded-xl bg-rose-600 text-white hover:bg-rose-700 px-3 py-1.5 text-xs font-mono font-bold transition cursor-pointer shadow-xs active:scale-95"
                >
                  {isDeleting ? "Deleting..." : "Yes, Delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-2.5 py-1.5 text-xs font-mono text-stone-700 dark:text-stone-300 hover:bg-stone-100 transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Right Side: Cancel and Save Changes */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isDeleting}
              className="rounded-xl border border-[#C9AE8B]/40 dark:border-stone-700 bg-white dark:bg-stone-800 px-4 py-2 text-xs font-mono font-bold text-[#725039] dark:text-stone-300 hover:bg-[#F3E7D3] dark:hover:bg-stone-700 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSaveOrder}
              disabled={isSubmitting || isDeleting || items.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#B72E35] to-[#8C1D23] text-white hover:brightness-110 px-5 py-2 text-xs font-mono font-bold shadow-md transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              <span>{isSubmitting ? "Saving Changes..." : "Save Changes"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
