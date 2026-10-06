"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  UtensilsCrossed,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Tag,
  DollarSign,
  Layers,
  X,
  Check,
  Ban,
  Eye,
  Image as ImageIcon,
} from "lucide-react";
import {
  fetchAdminMenuCatalogAction,
  saveMenuItemAction,
  deleteMenuItemAction,
  type AdminMenuItem,
  type AdminCategoryOption,
} from "@/app/admin/menu-actions";
import { updateMenuItemStockAction } from "@/app/kitchen/menu-actions";
import { broadcastSyncEvent, subscribeToSyncEvents } from "@/lib/sync-events";
import { getFoodImage } from "@/lib/food-images";
import { DishImagePicker } from "@/components/common/DishImagePicker";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";

interface AdminMenuManagerProps {
  onItemChange?: () => void;
}

export const AdminMenuManager: React.FC<AdminMenuManagerProps> = ({ onItemChange }) => {
  const [categories, setCategories] = useState<AdminCategoryOption[]>([]);
  const [items, setItems] = useState<AdminMenuItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "AVAILABLE" | "SOLD_OUT">("ALL");

  // Modal State for Add / Edit Item
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<AdminMenuItem | null>(null);
  const [formName, setFormName] = useState<string>("");
  const [formCategoryId, setFormCategoryId] = useState<string>("");
  const [formPriceRupees, setFormPriceRupees] = useState<number | "">("");
  const [formDescription, setFormDescription] = useState<string>("");
  const [formDietary, setFormDietary] = useState<"veg" | "non-veg" | "vegan" | "egg" | "beverage">("veg");
  const [formStatus, setFormStatus] = useState<"AVAILABLE" | "SOLD_OUT">("AVAILABLE");
  const [formImageUrl, setFormImageUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Delete confirmation
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadMenu = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchAdminMenuCatalogAction();
      if (res.success) {
        setCategories(res.categories);
        setItems(res.items);
      }
    } catch {
      setFeedback({ type: "error", text: "Failed to load menu catalog." });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  // Realtime Supabase CDC WebSocket subscription for Postgres menu_items changes
  useSupabaseRealtime<{ id?: string; name?: string; status?: string; price_snapshot?: number }>({
    table: "menu_items",
    onData: (payload) => {
      const item = payload?.new as { id?: string; name?: string; status?: string; price_snapshot?: number } | undefined;
      if (item && item.id) {
        if (item.status === "ARCHIVED") {
          setItems((prev) => prev.filter((i) => i.id !== item.id));
          return;
        }
        setItems((prev) => {
          const exists = prev.some((i) => i.id === item.id);
          if (exists) {
            return prev.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    name: item.name || i.name,
                    status: item.status === "SOLD_OUT" ? "SOLD_OUT" : "AVAILABLE",
                    priceRupees: item.price_snapshot ? Math.round(item.price_snapshot / 100) : i.priceRupees,
                  }
                : i
            );
          }
          return prev;
        });
      }
    },
  });

  // Subscribe to real-time sync broadcast events across all stations & tabs (KDS <-> Admin <-> Customer)
  useEffect(() => {
    const unsub = subscribeToSyncEvents((event) => {
      if (event.type === "ITEM_AVAILABILITY_CHANGED" || event.type === "INVENTORY_UPDATED") {
        if (event.itemId) {
          const meta = (event.metadata as Record<string, unknown>) || {};
          const isDeleted =
            event.stockStatus === "ARCHIVED" ||
            event.availability === "ARCHIVED" ||
            meta.status === "ARCHIVED" ||
            meta.deleted;

          if (isDeleted) {
            setItems((prev) => prev.filter((i) => i.id !== event.itemId));
            return;
          }

          setItems((prev) => {
            const exists = prev.some((i) => i.id === event.itemId);
            const isSoldOut =
              event.stockStatus === "SOLD_OUT" ||
              event.availability === "SOLD_OUT" ||
              meta.status === "SOLD_OUT" ||
              meta.stockStatus === "SOLD_OUT";
            const newStatus = isSoldOut ? "SOLD_OUT" : "AVAILABLE";

            if (exists) {
              return prev.map((i) =>
                i.id === event.itemId
                  ? {
                      ...i,
                      status: newStatus,
                      priceRupees:
                        event.priceRupees !== undefined
                          ? event.priceRupees
                          : meta.priceRupees !== undefined
                          ? Number(meta.priceRupees)
                          : i.priceRupees,
                      name: typeof meta.name === "string" ? meta.name : i.name,
                      description: typeof meta.description === "string" ? meta.description : i.description,
                      imageUrl: meta.imageUrl !== undefined ? (meta.imageUrl as string | null) : i.imageUrl,
                      dietary: typeof meta.dietary === "string" ? meta.dietary : i.dietary,
                      categoryId: typeof meta.categoryId === "string" ? meta.categoryId : i.categoryId,
                    }
                  : i
              );
            }

            // Newly added dish by KDS/Admin — append to list in 0ms!
            if (meta.name) {
              const category = categories.find((c) => c.id === meta.categoryId);
              const newItemPrice =
                event.priceRupees !== undefined
                  ? event.priceRupees
                  : meta.priceRupees !== undefined
                  ? Number(meta.priceRupees)
                  : 120;
              const newItem: AdminMenuItem = {
                id: event.itemId!,
                name: String(meta.name),
                categoryId: (meta.categoryId as string) || categories[0]?.id || "cat-1",
                categoryName: category?.name || "Menu Specials",
                priceRupees: newItemPrice,
                description: (meta.description as string) || "",
                imageUrl: (meta.imageUrl as string | null) || null,
                dietary: (meta.dietary as string) || "veg",
                status: newStatus,
              };
              return [newItem, ...prev];
            }
            return prev;
          });
        }
      }
    });
    return () => unsub();
  }, [categories]);

  // Fast fallback refresh when tab or network resumes
  useEffect(() => {
    const handleFocus = () => {
      loadMenu();
    };
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleFocus);
    };
  }, [loadMenu]);

  // Open modal for New Item
  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormName("");
    setFormCategoryId(categories[0]?.id || "");
    setFormPriceRupees("");
    setFormDescription("");
    setFormDietary("veg");
    setFormStatus("AVAILABLE");
    setFormImageUrl("");
    setIsModalOpen(true);
  };

  // Open modal to Edit existing Dish
  const handleOpenEdit = (item: AdminMenuItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCategoryId(item.categoryId);
    setFormPriceRupees(item.priceRupees);
    setFormDescription(item.description);
    setFormDietary((item.dietary as "veg" | "non-veg" | "vegan" | "egg" | "beverage") || "veg");
    setFormStatus(item.status === "SOLD_OUT" ? "SOLD_OUT" : "AVAILABLE");
    setFormImageUrl(item.imageUrl || "");
    setIsModalOpen(true);
  };

  // Add or Edit Dish
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFeedback({ type: "error", text: "Dish name is required." });
      return;
    }
    if (formPriceRupees === "" || Number(formPriceRupees) < 0) {
      setFeedback({ type: "error", text: "Valid price is required." });
      return;
    }

    const dishPrice = Number(formPriceRupees);
    const category = categories.find((c) => c.id === formCategoryId);

    if (editingItem) {
      // 1. Optimistic Edit Update (0ms)
      const updatedItem: AdminMenuItem = {
        ...editingItem,
        name: formName.trim(),
        categoryId: formCategoryId || editingItem.categoryId,
        categoryName: category?.name || editingItem.categoryName,
        priceRupees: dishPrice,
        description: formDescription.trim(),
        imageUrl: formImageUrl.trim() || null,
        dietary: formDietary,
        status: formStatus,
      };

      setItems((prev) => prev.map((i) => (i.id === editingItem.id ? updatedItem : i)));
      setIsModalOpen(false);
      setIsSubmitting(true);
      setFeedback({ type: "success", text: `Updating "${formName.trim()}"...` });

      try {
        const res = await saveMenuItemAction({
          id: editingItem.id,
          name: formName.trim(),
          categoryId: formCategoryId,
          priceRupees: dishPrice,
          description: formDescription.trim(),
          dietary: formDietary,
          status: formStatus,
          imageUrl: formImageUrl.trim() || null,
        });

        if (res.success) {
          broadcastSyncEvent({
            type: "ITEM_AVAILABILITY_CHANGED",
            itemId: editingItem.id,
            priceRupees: dishPrice,
            stockStatus: formStatus === "SOLD_OUT" ? "SOLD_OUT" : "IN_STOCK",
            availability: formStatus === "SOLD_OUT" ? "SOLD_OUT" : "IN_STOCK",
            timestamp: Date.now(),
            metadata: {
              id: editingItem.id,
              name: formName.trim(),
              categoryId: formCategoryId,
              priceRupees: dishPrice,
              description: formDescription.trim(),
              dietary: formDietary,
              status: formStatus,
              imageUrl: formImageUrl.trim() || null,
            },
          });
          setFeedback({ type: "success", text: `Dish "${formName.trim()}" updated successfully!` });
          if (onItemChange) onItemChange();
        } else {
          setFeedback({ type: "error", text: res.message });
        }
      } catch {
        setFeedback({ type: "error", text: "Failed to update dish." });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const newDishId = `item_custom_${Date.now()}`;
    const optimisticItem: AdminMenuItem = {
      id: newDishId,
      name: formName.trim(),
      categoryId: formCategoryId || categories[0]?.id || "cat-1",
      categoryName: category?.name || "Menu Specials",
      priceRupees: dishPrice,
      description: formDescription.trim(),
      imageUrl: formImageUrl.trim() || null,
      dietary: formDietary,
      status: formStatus,
    };

    // 1. Instant 0ms Optimistic UI Update
    setItems((prev) => [optimisticItem, ...prev]);
    setIsModalOpen(false);
    setIsSubmitting(true);
    setFeedback({ type: "success", text: `Adding "${formName.trim()}" to menu...` });

    try {
      const res = await saveMenuItemAction({
        name: formName.trim(),
        categoryId: formCategoryId,
        priceRupees: dishPrice,
        description: formDescription.trim(),
        dietary: formDietary,
        status: formStatus,
        imageUrl: formImageUrl.trim() || null,
      });

      if (res.success) {
        broadcastSyncEvent({
          type: "ITEM_AVAILABILITY_CHANGED",
          itemId: res.itemId || newDishId,
          priceRupees: dishPrice,
          stockStatus: formStatus === "SOLD_OUT" ? "SOLD_OUT" : "IN_STOCK",
          availability: formStatus === "SOLD_OUT" ? "SOLD_OUT" : "IN_STOCK",
          timestamp: Date.now(),
          metadata: {
            id: res.itemId || newDishId,
            name: formName.trim(),
            categoryId: formCategoryId,
            priceRupees: dishPrice,
            description: formDescription.trim(),
            dietary: formDietary,
            status: formStatus,
            imageUrl: formImageUrl.trim() || null,
          },
        });
        setFeedback({ type: "success", text: `Dish "${formName.trim()}" added to menu successfully!` });
        if (onItemChange) onItemChange();
      } else {
        setFeedback({ type: "error", text: res.message });
      }
    } catch {
      setFeedback({ type: "error", text: "Failed to save new dish." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglingItemIdsRef = React.useRef<Set<string>>(new Set());

  // Explicit status control (In Stock / Out Of Stock) with instant 0ms optimistic UI update & cross-station sync
  const handleSetStockStatus = async (item: AdminMenuItem, targetStatus: "AVAILABLE" | "SOLD_OUT") => {
    if (togglingItemIdsRef.current.has(item.id)) return;
    togglingItemIdsRef.current.add(item.id);

    const prevItems = items;
    // 1. Instant 0ms Optimistic UI update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: targetStatus } : i))
    );
    setFeedback({
      type: "success",
      text: targetStatus === "AVAILABLE" ? `"${item.name}" marked as In Stock` : `"${item.name}" marked as Out Of Stock`,
    });

    try {
      const stockStatusStr = targetStatus === "SOLD_OUT" ? "SOLD_OUT" : "IN_STOCK";

      // 2. Persist in Admin actions
      const res = await saveMenuItemAction({
        id: item.id,
        name: item.name,
        categoryId: item.categoryId,
        priceRupees: item.priceRupees,
        description: item.description,
        dietary: item.dietary as "veg" | "non-veg" | "vegan" | "egg" | "beverage",
        status: targetStatus,
        imageUrl: item.imageUrl,
      });

      // 3. Persist in Kitchen actions
      await updateMenuItemStockAction(item.id, stockStatusStr);

      if (res.success) {
        broadcastSyncEvent({
          type: "ITEM_AVAILABILITY_CHANGED",
          itemId: item.id,
          availability: stockStatusStr,
          stockStatus: stockStatusStr,
          priceRupees: item.priceRupees,
          timestamp: Date.now(),
          metadata: {
            id: item.id,
            status: targetStatus,
            stockStatus: stockStatusStr,
            priceRupees: item.priceRupees,
          },
        });
        if (onItemChange) onItemChange();
      } else {
        setItems(prevItems); // Rollback
        setFeedback({ type: "error", text: res.message || "Failed to update stock status." });
      }
    } catch {
      setItems(prevItems); // Rollback
      setFeedback({ type: "error", text: "Failed to update stock status." });
    } finally {
      togglingItemIdsRef.current.delete(item.id);
    }
  };

  // Delete item
  const handleDeleteItem = async (itemId: string) => {
    try {
      const res = await deleteMenuItemAction(itemId);
      if (res.success) {
        setFeedback({ type: "success", text: "Item removed from menu." });
        setDeletingItemId(null);
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        broadcastSyncEvent({
          type: "ITEM_AVAILABILITY_CHANGED",
          itemId,
          stockStatus: "ARCHIVED",
          availability: "ARCHIVED",
          timestamp: Date.now(),
          metadata: { id: itemId, status: "ARCHIVED", deleted: true },
        });
        if (onItemChange) onItemChange();
      } else {
        setFeedback({ type: "error", text: res.message });
      }
    } catch {
      setFeedback({ type: "error", text: "Failed to delete item." });
    }
  };

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.categoryName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat =
        selectedCategory === "ALL" ||
        item.categoryId === selectedCategory ||
        item.categoryName.toLowerCase() === selectedCategory.toLowerCase();

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "AVAILABLE" && item.status !== "SOLD_OUT") ||
        (statusFilter === "SOLD_OUT" && item.status === "SOLD_OUT");

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [items, searchQuery, selectedCategory, statusFilter]);

  const stats = useMemo(() => {
    const total = items.length;
    const available = items.filter((i) => i.status !== "SOLD_OUT").length;
    const soldOut = items.filter((i) => i.status === "SOLD_OUT").length;
    return { total, available, soldOut };
  }, [items]);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs">
        <div>
          <h2 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-[#B72E35]" />
            <span>Menu Catalog &amp; Dish Editor</span>
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Add new dishes, update prices, edit descriptions, or toggle stock. Changes reflect instantly on customer menu &amp; KDS.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadMenu}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition"
            title="Refresh Catalog"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#B72E35] hover:bg-[#9E2329] text-white rounded-xl text-sm font-semibold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Item</span>
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-medium ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
              : "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-md"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Stats and Filter bar */}
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl">
            <span className="text-[11px] uppercase tracking-wider font-mono text-stone-500">Total Items</span>
            <div className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100 mt-0.5">
              {stats.total}
            </div>
          </div>
          <div className="p-3.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl">
            <span className="text-[11px] uppercase tracking-wider font-mono text-emerald-600 dark:text-emerald-400">Available</span>
            <div className="text-xl font-serif font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
              {stats.available}
            </div>
          </div>
          <div className="p-3.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl">
            <span className="text-[11px] uppercase tracking-wider font-mono text-red-600 dark:text-red-400">Sold Out (86ed)</span>
            <div className="text-xl font-serif font-bold text-red-700 dark:text-red-300 mt-0.5">
              {stats.soldOut}
            </div>
          </div>
        </div>

        {/* Search & Category Filter */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search dishes by name, ingredients, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B72E35]/40"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-xs font-medium text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-[#B72E35]/40"
            >
              <option value="ALL">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <div className="flex items-center border border-stone-200 dark:border-stone-800 rounded-xl p-1 bg-white dark:bg-stone-900 text-xs">
              <button
                onClick={() => setStatusFilter("ALL")}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  statusFilter === "ALL"
                    ? "bg-[#B72E35] text-white"
                    : "text-stone-600 dark:text-stone-400 hover:text-stone-900"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter("AVAILABLE")}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  statusFilter === "AVAILABLE"
                    ? "bg-emerald-600 text-white"
                    : "text-stone-600 dark:text-stone-400 hover:text-stone-900"
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setStatusFilter("SOLD_OUT")}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  statusFilter === "SOLD_OUT"
                    ? "bg-red-600 text-white"
                    : "text-stone-600 dark:text-stone-400 hover:text-stone-900"
                }`}
              >
                Sold Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Items Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800">
          <RefreshCw className="w-8 h-8 text-[#B72E35] animate-spin mb-3" />
          <p className="text-sm text-stone-500 font-mono">Loading menu catalog...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800">
          <UtensilsCrossed className="w-10 h-10 text-stone-300 dark:text-stone-700 mx-auto mb-3" />
          <p className="text-stone-700 dark:text-stone-300 font-medium">No menu items found</p>
          <p className="text-xs text-stone-500 mt-1">Try adjusting your search or category filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const isSoldOut = item.status === "SOLD_OUT";
            const imgUrl = item.imageUrl ? getFoodImage(item.name, item.imageUrl) : "";
            return (
              <div
                key={item.id}
                className={`flex flex-col justify-between p-4 rounded-2xl border transition bg-white dark:bg-stone-900 ${
                  isSoldOut
                    ? "border-red-200 dark:border-red-950/60 opacity-80"
                    : "border-stone-200 dark:border-stone-800 hover:border-[#B72E35]/40"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {imgUrl && (
                        <div className="h-14 w-14 rounded-xl overflow-hidden shrink-0 border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-800">
                          <img
                            src={imgUrl}
                            alt={item.name}
                            className={`h-full w-full object-cover ${
                              isSoldOut ? "grayscale contrast-125" : ""
                            }`}
                          />
                        </div>
                      )}
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                            {item.categoryName}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md ${
                              item.dietary === "veg"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : item.dietary === "vegan"
                                ? "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300"
                                : item.dietary === "egg"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : item.dietary === "beverage"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                            }`}
                          >
                            {item.dietary}
                          </span>
                        </div>
                        <h3 className="font-serif font-bold text-stone-900 dark:text-stone-100 text-base leading-snug line-clamp-1">
                          {item.name}
                        </h3>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-serif font-bold text-base text-[#B72E35] dark:text-[#E25C64]">
                        ₹{item.priceRupees}
                      </div>
                    </div>
                  </div>

                  {item.description && (
                    <p className="text-xs text-stone-600 dark:text-stone-400 mt-2 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* 2-BUTTON STOCK CONTROL FOR ADMIN: 1. IN STOCK  2. OUT OF STOCK */}
                <div className="pt-3 mt-3 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between gap-2">
                  <div className="grid grid-cols-2 gap-2 flex-1">
                    {/* Button 1: IN STOCK */}
                    <button
                      type="button"
                      onClick={() => handleSetStockStatus(item, "AVAILABLE")}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                        !isSoldOut
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700"
                      }`}
                    >
                      <Check className="w-3 h-3" />
                      <span>In Stock</span>
                    </button>

                    {/* Button 2: OUT OF STOCK */}
                    <button
                      type="button"
                      onClick={() => handleSetStockStatus(item, "SOLD_OUT")}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                        isSoldOut
                          ? "bg-rose-600 text-white shadow-xs"
                          : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700"
                      }`}
                    >
                      <Ban className="w-3 h-3" />
                      <span>Out Of Stock</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 transition cursor-pointer"
                      title="Edit Dish"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {deletingItemId === item.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="px-2 py-1 bg-red-600 text-white text-[11px] font-bold rounded-lg hover:bg-red-700 cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeletingItemId(null)}
                          className="p-1 text-stone-500 hover:text-stone-800 text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingItemId(item.id)}
                        className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-red-50 dark:hover:bg-red-950/40 text-stone-400 hover:text-red-600 transition cursor-pointer"
                        title="Delete Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {mounted && isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 dark:bg-black/85 backdrop-blur-md">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-lg text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4 text-[#B72E35]" />
                  <span>{editingItem ? "Edit Menu Dish" : "Add New Dish"}</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  {editingItem
                    ? "Update pricing, description, category, or dietary status."
                    : "Add a new dish to the live customer menu &amp; kitchen display."}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Dish Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Artisanal Iced Vanilla Latte"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#B72E35]/40"
                />
              </div>

              {/* Category & Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-xs font-medium text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#B72E35]/40"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Price (₹ Rupees) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                      ₹
                    </span>
                    <input
                      type="number"
                      required
                      min={0}
                      step={1}
                      placeholder="220"
                      value={formPriceRupees}
                      onChange={(e) =>
                        setFormPriceRupees(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      className="w-full pl-7 pr-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-sm font-bold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#B72E35]/40"
                    />
                  </div>
                </div>
              </div>

              {/* Dietary & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Dietary Classification
                  </label>
                  <select
                    value={formDietary}
                    onChange={(e) => setFormDietary(e.target.value as any)}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-xs font-medium text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#B72E35]/40"
                  >
                    <option value="veg">Vegetarian (Green)</option>
                    <option value="vegan">Vegan (Teal)</option>
                    <option value="egg">Egg / Omelette (Amber)</option>
                    <option value="beverage">Beverage (Blue)</option>
                    <option value="non-veg">Non-Veg (Red)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Initial Stock Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-xs font-medium text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#B72E35]/40"
                  >
                    <option value="AVAILABLE">In Stock (Ordering Allowed)</option>
                    <option value="SOLD_OUT">Sold Out (86ed)</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Description &amp; Ingredients
                </label>
                <textarea
                  rows={3}
                  placeholder="Artisanal sourdough toast with whipped salted butter and organic berry jam."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#B72E35]/40"
                />
              </div>

              {/* Photo / Image Selection with Camera & Upload Support */}
              <DishImagePicker
                imageUrl={formImageUrl}
                onChange={setFormImageUrl}
                dishName={formName}
              />

              {/* Actions */}
              <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 dark:text-stone-400 hover:text-stone-900 rounded-xl"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#B72E35] hover:bg-[#9E2329] text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{editingItem ? "Save Changes" : "Create Item"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
