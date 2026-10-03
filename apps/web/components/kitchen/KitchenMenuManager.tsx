"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ChefHat,
  Search,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  X,
  Plus,
  Check,
  RefreshCw,
  Ban,
  CheckCheck,
  Trash2,
} from "lucide-react";
import {
  type KitchenMenuItem,
  type KitchenIngredientItem,
  fetchKitchenMenuCatalogAction,
  updateMenuItemStockAction,
} from "@/app/kitchen/menu-actions";
import { saveMenuItemAction, deleteMenuItemAction } from "@/app/admin/menu-actions";
import { broadcastSyncEvent, subscribeToSyncEvents } from "@/lib/sync-events";
import { getFoodImage } from "@/lib/food-images";
import { DishImagePicker } from "@/components/common/DishImagePicker";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";

interface KitchenMenuManagerProps {
  onClose?: () => void;
}

export const KitchenMenuManager: React.FC<KitchenMenuManagerProps> = () => {
  const [items, setItems] = useState<KitchenMenuItem[]>([]);
  const [, setIngredients] = useState<KitchenIngredientItem[]>([]);
  const [stations, setStations] = useState<string[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>("All Stations");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [stockFilter, setStockFilter] = useState<"ALL" | "IN_STOCK" | "SOLD_OUT">("ALL");

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);



  // Dish Add / Edit Modal state for Kitchen Chefs
  const [isDishModalOpen, setIsDishModalOpen] = useState<boolean>(false);
  const [editingDish, setEditingDish] = useState<KitchenMenuItem | null>(null);
  const [dishName, setDishName] = useState<string>("");
  const [dishCategory, setDishCategory] = useState<string>("");
  const [dishPrice, setDishPrice] = useState<number | "">("");
  const [dishDescription, setDishDescription] = useState<string>("");
  const [dishDietary, setDishDietary] = useState<"veg" | "non-veg" | "vegan" | "egg" | "beverage">("veg");
  const [dishStatus, setDishStatus] = useState<"AVAILABLE" | "SOLD_OUT">("AVAILABLE");
  const [dishImageUrl, setDishImageUrl] = useState<string>("");
  const [isSavingDish, setIsSavingDish] = useState<boolean>(false);

  // Load menu items on mount
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchKitchenMenuCatalogAction();
      if (res.success) {
        setItems(res.items);
        setIngredients(res.ingredients);
        setStations(res.stations);
      }
    } catch {
      setFeedback({ type: "error", text: "Failed to load kitchen menu catalog." });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime Supabase WebSocket subscription for instant CDC menu_items changes
  useSupabaseRealtime({
    table: "menu_items",
    onData: (payload: any) => {
      const item = payload?.new;
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
                    stockStatus: item.status === "SOLD_OUT" ? "SOLD_OUT" : "IN_STOCK",
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

  // Subscribe to real-time events across tabs/stations (Admin <-> KDS <-> Customer)
  useEffect(() => {
    const unsub = subscribeToSyncEvents((event) => {
      if (event.type === "ITEM_AVAILABILITY_CHANGED" || event.type === "INVENTORY_UPDATED") {
        if (event.itemId) {
          const meta = (event.metadata as any) || {};
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
            const newStatus = isSoldOut ? "SOLD_OUT" : "IN_STOCK";
            const newPrice =
              event.priceRupees !== undefined
                ? event.priceRupees
                : meta.priceRupees !== undefined
                ? meta.priceRupees
                : 100;

            if (exists) {
              return prev.map((i) => {
                if (i.id === event.itemId) {
                  return {
                    ...i,
                    stockStatus: newStatus,
                    priceRupees: newPrice,
                    name: meta.name || i.name,
                  };
                }
                return i;
              });
            }

            // Newly added dish — append to KDS in 0ms!
            if (meta.name) {
              const newItem: KitchenMenuItem = {
                id: event.itemId!,
                name: meta.name,
                category: meta.categoryId || "Slow Mornings",
                station: "Hot Kitchen & Grill",
                priceRupees: meta.priceRupees || newPrice,
                stockStatus: newStatus as "IN_STOCK" | "SOLD_OUT",
                isChefSpecial: false,
                chefNotes: meta.description || "",
                imageUrl: meta.imageUrl || null,
                coreIngredients: meta.description || "",
                dietary: meta.dietary || "veg",
              };
              return [newItem, ...prev];
            }

            return prev;
          });
        }
      }
    });
    return () => unsub();
  }, []);

  // Compute stats (Simple 2-state: In Stock vs Out of Stock)
  const stats = useMemo(() => {
    const total = items.length;
    const inStock = items.filter((i) => i.stockStatus !== "SOLD_OUT").length;
    const soldOut = items.filter((i) => i.stockStatus === "SOLD_OUT").length;
    const specials = items.filter((i) => i.isChefSpecial).length;
    return { total, inStock, soldOut, specials };
  }, [items]);

  // Filtered menu items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchStation = selectedStation === "All Stations" || item.station === selectedStation;
      const matchStock =
        stockFilter === "ALL" ||
        (stockFilter === "IN_STOCK" ? item.stockStatus !== "SOLD_OUT" : item.stockStatus === "SOLD_OUT");
      const matchSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.coreIngredients || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchStation && matchStock && matchSearch;
    });
  }, [items, selectedStation, stockFilter, searchQuery]);

  const togglingItemIdsRef = React.useRef<Set<string>>(new Set());

  // Toggle Item Stock Status (IN_STOCK / SOLD_OUT) with instant optimistic update & rollback
  const handleSetStock = async (itemId: string, newStatus: "IN_STOCK" | "SOLD_OUT") => {
    if (togglingItemIdsRef.current.has(itemId)) return;
    togglingItemIdsRef.current.add(itemId);

    const prevItems = items;

    // Instant 0ms Optimistic UI Update
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, stockStatus: newStatus } : i))
    );
    setFeedback({
      type: "success",
      text: newStatus === "IN_STOCK" ? "Marked as In Stock" : "Marked as Out Of Stock",
    });

    try {
      const res = await updateMenuItemStockAction(itemId, newStatus);
      if (res.success) {
        broadcastSyncEvent({
          type: "ITEM_AVAILABILITY_CHANGED",
          itemId: itemId,
          availability: newStatus,
          stockStatus: newStatus,
          timestamp: Date.now(),
        });
      } else {
        setItems(prevItems); // Rollback on failure
        setFeedback({ type: "error", text: res.message || "Failed to update item availability." });
      }
    } catch {
      setItems(prevItems); // Rollback on network exception
      setFeedback({ type: "error", text: "Failed to update item availability." });
    } finally {
      togglingItemIdsRef.current.delete(itemId);
    }
  };





  const [deletingDishId, setDeletingDishId] = useState<string | null>(null);

  // Open Add Dish modal
  const handleOpenAddDish = () => {
    setEditingDish(null);
    setDishName("");
    setDishCategory(items[0]?.category || "Slow Mornings");
    setDishPrice("");
    setDishDescription("");
    setDishDietary("veg");
    setDishStatus("AVAILABLE");
    setDishImageUrl("");
    setIsDishModalOpen(true);
  };

  // Add New Dish with 0ms Optimistic UI update & Realtime Broadcast to Customers & Admin
  const handleSaveDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingDish) return; // Prevent duplicate submissions

    if (!dishName.trim()) {
      setFeedback({ type: "error", text: "Dish name is required." });
      return;
    }
    if (dishPrice === "" || Number(dishPrice) < 0) {
      setFeedback({ type: "error", text: "Valid price is required." });
      return;
    }

    const prevItems = items;
    const targetId = `item_custom_${Date.now()}`;
    const targetPrice = Number(dishPrice);
    const targetStatus = dishStatus === "SOLD_OUT" ? "SOLD_OUT" : "IN_STOCK";

    const optimisticItem: KitchenMenuItem = {
      id: targetId,
      name: dishName.trim(),
      category: dishCategory || "Slow Mornings",
      station: "Hot Kitchen & Grill",
      priceRupees: targetPrice,
      stockStatus: targetStatus as "IN_STOCK" | "SOLD_OUT",
      isChefSpecial: false,
      chefNotes: dishDescription.trim(),
      imageUrl: dishImageUrl.trim() || null,
      coreIngredients: dishDescription.trim(),
      dietary: dishDietary,
    };

    // 1. Instant 0ms Optimistic UI Update (Prepend to menu list)
    setItems((prev) => [optimisticItem, ...prev]);

    // 2. Close modal & show instant feedback
    setIsDishModalOpen(false);
    setIsSavingDish(true);
    setFeedback({
      type: "success",
      text: `Adding "${dishName.trim()}" to menu...`,
    });

    try {
      const res = await saveMenuItemAction({
        name: dishName.trim(),
        categoryId: dishCategory,
        priceRupees: targetPrice,
        description: dishDescription.trim(),
        dietary: dishDietary,
        status: dishStatus,
        imageUrl: dishImageUrl.trim() || null,
      });

      if (res.success) {
        setFeedback({ type: "success", text: `Dish "${dishName.trim()}" added to menu successfully!` });
      } else {
        setItems(prevItems); // Rollback on failure
        setFeedback({ type: "error", text: res.message || "Failed to save dish." });
      }
    } catch {
      setItems(prevItems); // Rollback on error
      setFeedback({ type: "error", text: "Failed to save dish." });
    } finally {
      setIsSavingDish(false);
    }
  };

  // Delete Dish from Kitchen GDS with 0ms Optimistic UI Update & Realtime Sync
  const handleDeleteDish = async (itemId: string) => {
    const prevItems = items;
    // Instant 0ms removal
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    setDeletingDishId(null);
    setFeedback({ type: "success", text: "Removing dish from menu..." });

    try {
      const res = await deleteMenuItemAction(itemId);
      if (res.success) {
        setFeedback({ type: "success", text: "Dish removed from menu." });
      } else {
        setItems(prevItems); // Rollback
        setFeedback({ type: "error", text: res.message || "Failed to delete dish." });
      }
    } catch {
      setItems(prevItems); // Rollback
      setFeedback({ type: "error", text: "Failed to delete dish." });
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`flex items-center justify-between rounded-2xl p-4 text-xs font-mono transition-all border ${feedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 text-rose-900 border-rose-300 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-800"
            }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span className="font-semibold">{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-stone-400 hover:text-stone-700 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#B72E35] text-white shadow-xs shrink-0 mt-0.5 sm:mt-0">
            <ChefHat className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-serif text-lg sm:text-2xl font-bold text-[#241F1C] dark:text-white leading-tight">
                Kitchen Menu &amp; Stock Manager
              </h1>
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 px-2.5 py-0.5 text-[10px] sm:text-[11px] font-mono font-bold shrink-0">
                Live Kitchen Sync
              </span>
            </div>
            <p className="font-mono text-[11px] sm:text-xs text-[#725039] dark:text-stone-400 mt-1">
              Easily toggle dishes between In Stock and Out Of Stock in real time.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <button
            onClick={handleOpenAddDish}
            className="flex items-center gap-1.5 rounded-2xl bg-[#B72E35] hover:bg-[#9E2329] px-3.5 py-1.5 sm:py-2 text-xs font-mono font-bold text-white transition shadow-xs cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Dish</span>
          </button>

          <button
            onClick={loadData}
            className="flex items-center gap-1.5 rounded-2xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-[#FAF4EB] dark:bg-stone-900 px-3.5 py-1.5 sm:py-2 text-xs font-mono font-bold text-[#241F1C] dark:text-white hover:bg-[#F3E7D3] dark:hover:bg-stone-800 transition shadow-xs cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Sync Catalog</span>
          </button>
        </div>
      </div>

      {/* Simplified Status Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1C1815] p-3 shadow-xs">
          <span className="text-[10px] font-mono uppercase text-[#725039] dark:text-stone-400 block font-semibold">
            Total Dishes
          </span>
          <p className="mt-1 text-2xl font-serif font-bold text-[#241F1C] dark:text-white">{stats.total}</p>
        </div>

        <div className="rounded-2xl border border-emerald-300/60 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/20 p-3 shadow-xs">
          <span className="text-[10px] font-mono uppercase text-emerald-800 dark:text-emerald-300 block font-bold">
            1. In Stock
          </span>
          <p className="mt-1 text-2xl font-serif font-bold text-emerald-700 dark:text-emerald-400">{stats.inStock}</p>
        </div>

        <div className="rounded-2xl border border-rose-300/60 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/20 p-3 shadow-xs">
          <span className="text-[10px] font-mono uppercase text-rose-800 dark:text-rose-300 block font-bold">
            2. Out Of Stock
          </span>
          <p className="mt-1 text-2xl font-serif font-bold text-rose-700 dark:text-rose-400">{stats.soldOut}</p>
        </div>

        <div className="rounded-2xl border border-purple-300/60 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/20 p-3 shadow-xs">
          <span className="text-[10px] font-mono uppercase text-purple-800 dark:text-purple-300 block font-bold">
            Chef Specials
          </span>
          <p className="mt-1 text-2xl font-serif font-bold text-purple-700 dark:text-purple-400">{stats.specials}</p>
        </div>
      </div>

      {/* Station Filter & Bulk Action Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#FAF4EB] dark:bg-[#1A1715] p-3 rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800">
        {/* Station Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0">
          {stations.map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStation(st)}
              className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition whitespace-nowrap cursor-pointer ${selectedStation === st
                  ? "bg-[#B72E35] text-white shadow-xs"
                  : "bg-white/80 dark:bg-stone-900 text-[#725039] dark:text-stone-300 border border-[#C9AE8B]/30 dark:border-stone-800 hover:bg-[#F3E7D3]"
                }`}
            >
              {st}
            </button>
          ))}
        </div>


      </div>

      {/* Search & Simple 2-State Filter Pills */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search dish, category or ingredient..."
            className="w-full pl-10 pr-4 py-2 rounded-2xl border border-[#C9AE8B]/40 dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1A1715] text-xs font-mono text-[#241F1C] dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B72E35]"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 rounded-2xl bg-[#EFE7DC] dark:bg-stone-900 p-1 border border-[#C9AE8B]/30 dark:border-stone-800 shrink-0">
          <button
            onClick={() => setStockFilter("ALL")}
            className={`px-3 py-1.5 rounded-xl font-mono text-[11px] font-bold transition cursor-pointer ${stockFilter === "ALL"
                ? "bg-[#241F1C] dark:bg-white text-white dark:text-[#241F1C] shadow-xs"
                : "text-[#725039] dark:text-stone-400 hover:text-[#241F1C] dark:hover:text-white"
              }`}
          >
            All Dishes
          </button>

          <button
            onClick={() => setStockFilter("IN_STOCK")}
            className={`px-3 py-1.5 rounded-xl font-mono text-[11px] font-bold transition cursor-pointer ${stockFilter === "IN_STOCK"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-[#725039] dark:text-stone-400 hover:text-emerald-700 dark:hover:text-emerald-400"
              }`}
          >
            In Stock
          </button>

          <button
            onClick={() => setStockFilter("SOLD_OUT")}
            className={`px-3 py-1.5 rounded-xl font-mono text-[11px] font-bold transition cursor-pointer ${stockFilter === "SOLD_OUT"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-[#725039] dark:text-stone-400 hover:text-rose-700 dark:hover:text-rose-400"
              }`}
          >
            Out Of Stock
          </button>
        </div>
      </div>

      {/* Menu Items Grid */}
      {isLoading ? (
        <div className="py-16 text-center text-stone-500 font-mono text-xs">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-[#B72E35]" />
          Loading kitchen catalog...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-16 text-center text-stone-500 font-mono text-xs bg-[#FAF4EB] dark:bg-[#1A1715] rounded-3xl border border-[#C9AE8B]/30 dark:border-stone-800">
          No menu items found matching current filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredItems.map((item) => {
            const isOutOfStock = item.stockStatus === "SOLD_OUT";
            const imgUrl = item.imageUrl ? getFoodImage(item.name, item.imageUrl) : "";

            return (
              <div
                key={item.id}
                className={`rounded-3xl border p-4 transition-all relative flex flex-col justify-between shadow-xs bg-[#FAF4EB] dark:bg-[#1A1715] ${isOutOfStock
                    ? "border-rose-300 dark:border-rose-900/80 bg-rose-50/30 dark:bg-rose-950/20"
                    : "border-[#C9AE8B]/40 dark:border-stone-800 hover:border-[#C9AE8B]/70"
                  }`}
              >
                {/* Item Card Content */}
                <div>
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      {imgUrl && (
                        <div className="h-12 w-12 rounded-xl overflow-hidden shrink-0 border border-[#C9AE8B]/30 dark:border-stone-800 bg-[#EFE7DC] dark:bg-stone-800">
                          <img
                            src={imgUrl}
                            alt={item.name}
                            className={`h-full w-full object-cover transition-all ${isOutOfStock ? "grayscale opacity-60" : ""
                              }`}
                          />
                        </div>
                      )}
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono uppercase text-[#725039] dark:text-stone-400 font-bold">
                            {item.station}
                          </span>
                          {item.isChefSpecial && (
                            <span className="flex items-center gap-0.5 text-[9.5px] font-mono font-bold bg-purple-100 text-purple-900 dark:bg-purple-950/80 dark:text-purple-300 px-1.5 py-0.5 rounded-md">
                              <Sparkles className="h-2.5 w-2.5" /> Special
                            </span>
                          )}
                          {isOutOfStock && (
                            <span className="text-[9.5px] font-mono font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 px-1.5 py-0.5 rounded-md border border-rose-300 dark:border-rose-800">
                              Out Of Stock
                            </span>
                          )}
                        </div>
                        <h3
                          className={`font-serif text-base font-bold leading-tight mt-0.5 line-clamp-1 ${isOutOfStock
                              ? "text-stone-500 dark:text-stone-400 line-through decoration-rose-500/60"
                              : "text-[#241F1C] dark:text-white"
                            }`}
                        >
                          {item.name}
                        </h3>
                        <p className="text-[11px] font-mono text-[#725039] dark:text-stone-400">
                          {item.category} • ₹{item.priceRupees}
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons: Delete Dish & Chef Note */}
                    <div className="flex items-center gap-1 shrink-0">
                      {deletingDishId === item.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDeleteDish(item.id)}
                            className="px-2 py-1 bg-red-600 text-white text-[11px] font-bold rounded-lg hover:bg-red-700 cursor-pointer"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeletingDishId(null)}
                            className="p-1 text-stone-500 hover:text-stone-800 text-xs cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleDeleteDish(item.id)}
                          className="p-1.5 rounded-xl border border-rose-200 dark:border-stone-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 hover:text-rose-700 transition cursor-pointer"
                          title="Delete Dish"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Chef Daily Note Display if present */}
                  {item.chefNotes && (
                    <div className="mt-2 text-[10.5px] font-mono italic bg-[#F3E7D3]/70 dark:bg-stone-900/80 p-2 rounded-xl text-[#725039] dark:text-stone-300 border border-[#C9AE8B]/30 dark:border-stone-800">
                      &ldquo;{item.chefNotes}&rdquo;
                    </div>
                  )}
                </div>

                {/* 2-BUTTON STOCK TOGGLE: 1. IN STOCK  2. OUT OF STOCK */}
                <div className="mt-4 pt-3 border-t border-[#C9AE8B]/20 dark:border-stone-800">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Button 1: IN STOCK */}
                    <button
                      onClick={() => handleSetStock(item.id, "IN_STOCK")}
                      className={`py-2 px-3 rounded-xl font-mono text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${!isOutOfStock
                          ? "bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600"
                          : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700"
                        }`}
                    >
                      <Check className="h-3.5 w-3.5 shrink-0" />
                      <span>In Stock</span>
                    </button>

                    {/* Button 2: OUT OF STOCK */}
                    <button
                      onClick={() => handleSetStock(item.id, "SOLD_OUT")}
                      className={`py-2 px-3 rounded-xl font-mono text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${isOutOfStock
                          ? "bg-rose-600 text-white hover:bg-rose-700 border border-rose-600"
                          : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700"
                        }`}
                    >
                      <Ban className="h-3.5 w-3.5 shrink-0" />
                      <span>Out Of Stock</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}



      {/* ========================================================================= */}
      {/* CHEF ADD / EDIT DISH MODAL                                               */}
      {/* ========================================================================= */}
      {isDishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-md rounded-3xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-[#FAF4EB] dark:bg-[#1A1715] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#C9AE8B]/30 dark:border-stone-800 pb-3">
              <div>
                <h3 className="font-serif text-lg font-bold text-[#241F1C] dark:text-white">
                  {editingDish ? `Edit Dish: ${editingDish.name}` : "Add New Kitchen Dish"}
                </h3>
                <p className="text-[11px] font-mono text-stone-500">
                  Updates price and details live across Customer Menu &amp; Kitchen Board
                </p>
              </div>
              <button
                onClick={() => setIsDishModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDish} className="space-y-4">
              {/* Dish Name */}
              <div>
                <label className="block text-xs font-mono font-bold text-[#241F1C] dark:text-stone-300 mb-1">
                  Dish Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Masala French Toast"
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                  className="w-full rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-white dark:bg-stone-900 p-3 text-xs font-mono text-[#241F1C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#B72E35]"
                />
              </div>

              {/* Category & Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono font-bold text-[#241F1C] dark:text-stone-300 mb-1">
                    Category
                  </label>
                  <select
                    value={dishCategory}
                    onChange={(e) => setDishCategory(e.target.value)}
                    className="w-full rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-white dark:bg-stone-900 p-2.5 text-xs font-mono text-[#241F1C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#B72E35]"
                  >
                    {Array.from(new Set(items.map((i) => i.category))).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold text-[#241F1C] dark:text-stone-300 mb-1">
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={1}
                    placeholder="240"
                    value={dishPrice}
                    onChange={(e) =>
                      setDishPrice(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="w-full rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-white dark:bg-stone-900 p-2.5 text-xs font-mono font-bold text-[#241F1C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#B72E35]"
                  />
                </div>
              </div>

              {/* Dietary & Stock Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono font-bold text-[#241F1C] dark:text-stone-300 mb-1">
                    Dietary
                  </label>
                  <select
                    value={dishDietary}
                    onChange={(e) => setDishDietary(e.target.value as any)}
                    className="w-full rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-white dark:bg-stone-900 p-2.5 text-xs font-mono text-[#241F1C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#B72E35]"
                  >
                    <option value="veg">Vegetarian</option>
                    <option value="vegan">Vegan</option>
                    <option value="egg">Contains Egg</option>
                    <option value="beverage">Beverage</option>
                    <option value="non-veg">Non-Veg</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold text-[#241F1C] dark:text-stone-300 mb-1">
                    Stock Status
                  </label>
                  <select
                    value={dishStatus}
                    onChange={(e) => setDishStatus(e.target.value as any)}
                    className="w-full rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-white dark:bg-stone-900 p-2.5 text-xs font-mono text-[#241F1C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#B72E35]"
                  >
                    <option value="AVAILABLE">In Stock</option>
                    <option value="SOLD_OUT">Out Of Stock</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-mono font-bold text-[#241F1C] dark:text-stone-300 mb-1">
                  Description / Core Ingredients
                </label>
                <textarea
                  rows={2}
                  value={dishDescription}
                  onChange={(e) => setDishDescription(e.target.value)}
                  placeholder="Brioche bread, cinnamon, whipped vanilla mascarpone, maple drizzle"
                  className="w-full rounded-xl border border-[#C9AE8B]/50 dark:border-stone-700 bg-white dark:bg-stone-900 p-2.5 text-xs font-mono text-[#241F1C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#B72E35]"
                />
              </div>

              {/* Photo / Image Selection with Camera & Upload Support */}
              <DishImagePicker
                imageUrl={dishImageUrl}
                onChange={setDishImageUrl}
                dishName={dishName}
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#C9AE8B]/20 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsDishModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-mono text-stone-600 dark:text-stone-400 hover:bg-black/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingDish}
                  className="rounded-xl bg-[#B72E35] hover:bg-[#9B252B] px-5 py-2 text-xs font-mono font-bold text-white shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {isSavingDish ? "Saving..." : editingDish ? "Save Dish" : "Create Dish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
