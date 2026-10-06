"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { CategoryWithItems, MenuItemWithDetails } from "@/lib/queries/menu";
import { CartProvider } from "@/context/CartContext";
import { MenuItemCard } from "./MenuItemCard";
import { ItemDetailModal } from "./ItemDetailModal";
import { FloatingCartBar } from "@/components/cart/FloatingCartBar";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { subscribeToSyncEvents } from "@/lib/sync-events";
import { cacheMenuCatalog, getCachedMenuCatalog } from "@/lib/offline-cache";
import { fetchLiveMenuCatalogAction } from "@/app/admin/menu-actions";
import MenuLoading from "@/app/menu/loading";

import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";

interface MenuClientViewProps {
  categories: CategoryWithItems[];
  tableLabel?: string;
  locationName?: string;
  guestName?: string;
  customTitle?: string;
}

const MenuContentInner: React.FC<MenuClientViewProps> = ({
  categories: initialCategories,
  tableLabel,
  locationName = "Smol Café",
  guestName = "",
  customTitle,
}) => {
  const searchParams = useSearchParams();
  const categoryParam = searchParams ? searchParams.get("category") : null;

  const [categories, setCategories] = useState<CategoryWithItems[]>(() => {
    if (initialCategories && initialCategories.length > 0) return initialCategories;
    const cached = getCachedMenuCatalog<CategoryWithItems[]>();
    return cached && cached.length > 0 ? cached : initialCategories;
  });
  const [currentGuestName, setCurrentGuestName] = useState(guestName);

  useEffect(() => {
    if (initialCategories && initialCategories.length > 0) {
      setCategories(initialCategories);
      cacheMenuCatalog(initialCategories);
    } else {
      const cached = getCachedMenuCatalog<CategoryWithItems[]>();
      if (cached && cached.length > 0) {
        setCategories(cached);
      }
    }
  }, [initialCategories]);

  // Single Item Realtime Update Handler (Near-Instant, 0ms local state mutation)
  const handleItemRealtimeUpdate = useCallback((payload: {
    id: string;
    name?: string;
    categoryId?: string;
    priceRupees?: number;
    pricePaise?: number;
    status?: string;
    stockStatus?: string;
    availability?: string;
    description?: string;
    imageUrl?: string | null;
    dietary?: string;
    bestPairing?: string;
  }) => {
    setCategories((prevCategories) => {
      if (payload.status === "ARCHIVED" || payload.stockStatus === "ARCHIVED") {
        const next = prevCategories.map((cat) => ({
          ...cat,
          items: cat.items.filter((it) => it.id !== payload.id),
        }));
        cacheMenuCatalog(next);
        return next;
      }

      let found = false;
      const updatedCategories = prevCategories.map((cat) => {
        const itemIndex = cat.items.findIndex((it) => it.id === payload.id);
        if (itemIndex >= 0) {
          found = true;
          const targetItem = cat.items[itemIndex];
          const isSoldOut = payload.stockStatus === "SOLD_OUT" || payload.status === "SOLD_OUT";
          const newStatus = isSoldOut ? "SOLD_OUT" : "ACTIVE";
          const newPricePaise =
            payload.pricePaise !== undefined
              ? payload.pricePaise
              : payload.priceRupees !== undefined
              ? Math.round(payload.priceRupees * 100)
              : targetItem.pricePaise;

          const updatedItems = [...cat.items];
          updatedItems[itemIndex] = {
            ...targetItem,
            name: payload.name || targetItem.name,
            description: payload.description !== undefined ? payload.description : targetItem.description,
            imageUrl: payload.imageUrl !== undefined ? payload.imageUrl : targetItem.imageUrl,
            pricePaise: newPricePaise,
            status: newStatus,
            metadata: {
              ...targetItem.metadata,
              availability: isSoldOut ? "SOLD_OUT" : "IN_STOCK",
              dietary: payload.dietary || targetItem.metadata?.dietary || "veg",
              best_pairing:
                payload.bestPairing !== undefined
                  ? payload.bestPairing
                  : targetItem.metadata?.best_pairing || "",
            },
          };
          return { ...cat, items: updatedItems };
        }
        return cat;
      });

      if (!found && payload.name && payload.id) {
        // Newly added dish by Admin/KDS — append to category dynamically in 0ms!
        const targetCategory =
          updatedCategories.find(
            (c) =>
              c.id === payload.categoryId ||
              c.name.toLowerCase() === (payload.categoryId || "").toLowerCase()
          ) || updatedCategories[0];

        if (targetCategory) {
          const isSoldOut = payload.stockStatus === "SOLD_OUT" || payload.status === "SOLD_OUT";
          const newItem: MenuItemWithDetails = {
            id: payload.id,
            categoryId: targetCategory.id,
            name: payload.name,
            description: payload.description || "",
            pricePaise:
              payload.pricePaise || Math.round((payload.priceRupees || 100) * 100),
            status: isSoldOut ? "SOLD_OUT" : "ACTIVE",
            imageUrl: payload.imageUrl || null,
            metadata: {
              dietary: payload.dietary || "veg",
              best_pairing: payload.bestPairing || "",
              availability: isSoldOut ? "SOLD_OUT" : "IN_STOCK",
            },
          };

          const next = updatedCategories.map((c) =>
            c.id === targetCategory.id ? { ...c, items: [newItem, ...c.items] } : c
          );
          cacheMenuCatalog(next);
          return next;
        }
      }

      // Also update open selectedItem modal if active
      setSelectedItem((prev) => {
        if (prev && prev.id === payload.id) {
          const isSoldOut = payload.stockStatus === "SOLD_OUT" || payload.status === "SOLD_OUT" || payload.availability === "SOLD_OUT";
          const newPricePaise =
            payload.pricePaise !== undefined
              ? payload.pricePaise
              : payload.priceRupees !== undefined
              ? Math.round(payload.priceRupees * 100)
              : prev.pricePaise;
          return {
            ...prev,
            name: payload.name || prev.name,
            description: payload.description !== undefined ? payload.description : prev.description,
            imageUrl: payload.imageUrl !== undefined ? payload.imageUrl : prev.imageUrl,
            status: isSoldOut ? "SOLD_OUT" : "ACTIVE",
            pricePaise: newPricePaise,
            metadata: {
              ...prev.metadata,
              availability: isSoldOut ? "SOLD_OUT" : "IN_STOCK",
              dietary: payload.dietary || prev.metadata?.dietary || "veg",
              best_pairing:
                payload.bestPairing !== undefined
                  ? payload.bestPairing
                  : prev.metadata?.best_pairing || "",
            },
          };
        }
        return prev;
      });

      cacheMenuCatalog(updatedCategories);
      return updatedCategories;
    });
  }, []);

  // Realtime WebSocket for instantaneous menu_items changes (stock, price, status)
  useSupabaseRealtime({
    table: "menu_items",
    onData: (payload: any) => {
      const item = payload?.new;
      if (item && item.id) {
        handleItemRealtimeUpdate({
          id: item.id,
          name: item.name,
          categoryId: item.category_id,
          pricePaise: item.price_snapshot || item.price_paise,
          status: item.status,
          stockStatus: item.status === "SOLD_OUT" ? "SOLD_OUT" : "IN_STOCK",
          description: item.description,
          imageUrl: item.image_url,
          bestPairing: item.metadata?.best_pairing || item.metadata?.bestPairing,
        });
      }
    },
  });

  // Listen for real-time item stock, new items, and menu changes across all tabs & devices
  useEffect(() => {
    const unsub = subscribeToSyncEvents((event) => {
      if (event.type === "ITEM_AVAILABILITY_CHANGED" || event.type === "INVENTORY_UPDATED") {
        if (event.itemId) {
          const meta = (event.metadata as any) || {};
          handleItemRealtimeUpdate({
            id: event.itemId,
            name: meta.name,
            categoryId: meta.categoryId,
            priceRupees: meta.priceRupees,
            status: meta.status || event.availability,
            stockStatus: event.stockStatus || event.availability,
            description: meta.description,
            imageUrl: meta.imageUrl,
            dietary: meta.dietary,
            bestPairing: meta.best_pairing || meta.bestPairing,
          });
        }
      }
    });

    return () => unsub();
  }, [handleItemRealtimeUpdate]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("smol_guest_name");
      if (saved && !currentGuestName) {
        setCurrentGuestName(saved);
      }
    }
  }, [currentGuestName]);

  const [activeCategoryId, setActiveCategoryId] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<MenuItemWithDetails | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterVegOnly, setFilterVegOnly] = useState(false);

  useEffect(() => {
    if (!categoryParam) return;
    const lowerParam = categoryParam.toLowerCase();

    const match = categories.find((c) => {
      if (c.id.toLowerCase() === lowerParam) return true;
      const lowerName = c.name.toLowerCase();
      if (lowerParam.includes("chai") && lowerName.includes("chai")) return true;
      if (lowerParam.includes("coffee") && lowerName.includes("coffee")) return true;
      if (lowerParam.includes("sandwich") && lowerName.includes("sandwich")) return true;
      if (lowerParam.includes("bowl") && lowerName.includes("bowl")) return true;
      if (lowerParam.includes("munchies") && lowerName.includes("munchies")) return true;
      if (lowerParam.includes("morning") && lowerName.includes("morning")) return true;
      return lowerName.includes(lowerParam);
    });

    if (match) {
      setActiveCategoryId(match.id);
      setTimeout(() => {
        const element = document.getElementById(`category-${match.id}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 150);
    }
  }, [categoryParam, categories]);

  const handleSelectCategory = (categoryId: string) => {
    setActiveCategoryId(categoryId);
    if (categoryId !== "") {
      const element = document.getElementById(`category-${categoryId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  // Filter items based on active category, search, and veg toggle
  const filteredCategories = categories
    .filter((cat) => activeCategoryId === "" || cat.id === activeCategoryId)
    .map((category) => {
      const filteredItems = category.items.filter((item) => {
        const matchesSearch =
          searchQuery === "" ||
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.metadata.core_ingredients?.toLowerCase().includes(searchQuery.toLowerCase());

        const isVeg =
          !filterVegOnly ||
          (item.metadata.dietary || "").toLowerCase().includes("veg") ||
          (item.metadata.dietary || "").toLowerCase().includes("vegan");

        return matchesSearch && isVeg;
      });

      return {
        ...category,
        items: filteredItems,
      };
    })
    .filter((cat) => cat.items.length > 0);

  return (
    <div className="min-h-screen bg-[#F3E7D3] dark:bg-[#151110] text-[#241F1C] dark:text-[#FAF4EB] pb-44 font-sans transition-colors duration-200">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-[#C9AE8B]/40 dark:border-white/10 bg-[#F3E7D3]/90 dark:bg-[#181412]/90 px-4 py-3.5 backdrop-blur-md transition-colors duration-200">
        <div className="mx-auto flex max-w-md items-center justify-between">
          {/* Back Button */}
          <Link
            href="/home"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#241F1C] dark:text-[#FAF4EB] transition hover:bg-black/5 dark:hover:bg-white/10 active:scale-95"
            aria-label="Back to home"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>

          {/* Title & Location Context */}
          <div className="text-center">
            <h1 className="font-serif text-2xl font-bold tracking-tight text-[#B72E35] dark:text-[#FF5B52] lowercase">
              {customTitle || "smol menu"}
            </h1>
            {tableLabel ? (
              <p className="text-[10px] font-mono font-medium text-[#725039] dark:text-[#C9AE8B]">
                table {tableLabel} • {currentGuestName || locationName}
              </p>
            ) : null}
          </div>

          {/* Right Controls: Search Toggle & Day/Night Mode Switcher */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("menu-search-input");
                el?.focus();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[#241F1C] dark:text-[#FAF4EB] transition hover:bg-black/5 dark:hover:bg-white/10 active:scale-95"
              aria-label="Search menu"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
            <ThemeToggle variant="icon" />
          </div>
        </div>

        {/* Subtitle & Item Count */}
        <div className="mx-auto mt-2 flex max-w-md items-baseline justify-between px-1">
          <p className="font-serif italic text-xs text-[#725039] dark:text-[#C9AE8B]/80">
            what are we brewing &amp; baking today?
          </p>
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#B72E35] dark:text-[#FF5B52]">
            {categories.reduce((acc, cat) => acc + (cat.items?.length || 0), 0)} ITEMS
          </span>
        </div>

        {/* Category Horizontal Pill Scroller */}
        <div className="mx-auto mt-3 flex max-w-md items-center gap-2 overflow-x-auto no-scrollbar py-1 px-0.5">
          <button
            type="button"
            onClick={() => setActiveCategoryId("")}
            className={`group relative shrink-0 rounded-full px-4 py-1.5 text-xs font-serif transition-all duration-300 ease-[cubic-bezier(0.25,1,0.35,1)] active:scale-95 touch-manipulation cursor-pointer ${activeCategoryId === ""
                ? "bg-gradient-to-b from-[#E03A43]/70 via-[#B72E35]/80 to-[#7D1217]/90 dark:from-[#A855F7]/70 dark:via-[#7E22CE]/80 dark:to-[#4C1D95]/90 text-white font-bold backdrop-blur-[16px] border border-white/55 dark:border-purple-300/40 shadow-[0_6px_20px_rgba(183,46,53,0.38),inset_0_1.5px_1.5px_rgba(255,255,255,0.85),inset_0_-1.5px_2px_rgba(0,0,0,0.4),inset_0_0_12px_rgba(255,140,140,0.35)] dark:shadow-[0_6px_22px_rgba(126,34,206,0.5),inset_0_1.5px_1.5px_rgba(255,255,255,0.85),inset_0_-1.5px_2px_rgba(0,0,0,0.5),inset_0_0_14px_rgba(192,132,252,0.45)] scale-[1.03]"
                : "border border-[#C9AE8B]/50 dark:border-white/10 bg-white/45 dark:bg-white/[0.05] backdrop-blur-md text-[#241F1C] dark:text-[#FAF4EB] hover:bg-white/70 dark:hover:bg-white/10 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] scale-100 hover:scale-[1.02]"
              }`}
          >
            {/* Curved Specular Glass Gloss Reflection */}
            {activeCategoryId === "" && (
              <span className="absolute inset-x-2 top-0.5 h-[42%] rounded-full bg-gradient-to-b from-white/55 via-white/15 to-transparent pointer-events-none opacity-90" />
            )}
            <span className="relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
              all items
            </span>
          </button>

          {categories.map((cat) => {
            const isActive = activeCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSelectCategory(cat.id)}
                className={`group relative shrink-0 rounded-full px-4 py-1.5 text-xs font-serif lowercase transition-all duration-300 ease-[cubic-bezier(0.25,1,0.35,1)] active:scale-95 touch-manipulation cursor-pointer ${isActive
                    ? "bg-gradient-to-b from-[#E03A43]/70 via-[#B72E35]/80 to-[#7D1217]/90 dark:from-[#A855F7]/70 dark:via-[#7E22CE]/80 dark:to-[#4C1D95]/90 text-white font-bold backdrop-blur-[16px] border border-white/55 dark:border-purple-300/40 shadow-[0_6px_20px_rgba(183,46,53,0.38),inset_0_1.5px_1.5px_rgba(255,255,255,0.85),inset_0_-1.5px_2px_rgba(0,0,0,0.4),inset_0_0_12px_rgba(255,140,140,0.35)] dark:shadow-[0_6px_22px_rgba(126,34,206,0.5),inset_0_1.5px_1.5px_rgba(255,255,255,0.85),inset_0_-1.5px_2px_rgba(0,0,0,0.5),inset_0_0_14px_rgba(192,132,252,0.45)] scale-[1.03]"
                    : "border border-[#C9AE8B]/50 dark:border-white/10 bg-white/45 dark:bg-white/[0.05] backdrop-blur-md text-[#241F1C] dark:text-[#FAF4EB] hover:bg-white/70 dark:hover:bg-white/10 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] scale-100 hover:scale-[1.02]"
                  }`}
              >
                {/* Curved Specular Glass Gloss Reflection */}
                {isActive && (
                  <span className="absolute inset-x-2 top-0.5 h-[42%] rounded-full bg-gradient-to-b from-white/55 via-white/15 to-transparent pointer-events-none opacity-90" />
                )}
                <span className={`relative z-10 ${isActive ? "drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]" : ""}`}>
                  {cat.name}
                </span>
              </button>
            );
          })}

          {/* Filter button */}
          <button
            type="button"
            onClick={() => setFilterVegOnly(!filterVegOnly)}
            className={`shrink-0 flex items-center justify-center h-8 w-8 rounded-full border transition-all duration-200 active:scale-90 cursor-pointer ${filterVegOnly
                ? "bg-gradient-to-b from-[#75AFA7] to-[#4F8B83] text-white border-white/40 shadow-[0_4px_12px_rgba(79,139,131,0.4),inset_0_1px_1px_rgba(255,255,255,0.7)]"
                : "border-[#C9AE8B]/50 dark:border-white/10 bg-white/45 dark:bg-white/[0.05] backdrop-blur-md text-[#241F1C] dark:text-[#FAF4EB] hover:bg-white/70 dark:hover:bg-white/10 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]"
              }`}
            title="Filter Veg only"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
          </button>
        </div>

        {/* Quick Table Switcher Bar for guests */}
        {!tableLabel && (
          <div className="mx-auto mt-2.5 flex max-w-md items-center justify-between rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/20 px-3 py-1.5 text-xs text-amber-900 dark:text-amber-200">
            <span className="text-[11px] font-medium">Seated at:</span>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[1, 2, 3, 4, 5, 6].map((num) => {
                const label = num.toString().padStart(2, "0");
                return (
                  <Link
                    key={num}
                    href={`/t/table-${label}`}
                    className="rounded-lg border border-amber-300 dark:border-amber-700/50 bg-white dark:bg-[#251E1A] px-2 py-0.5 text-[11px] font-bold shadow-xs hover:bg-amber-100 dark:hover:bg-amber-900/40"
                  >
                    T{label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>
      {/* Main Menu List */}
      <main className="mx-auto max-w-md px-4 pt-4 space-y-6">
        {filteredCategories.map((category) => (
          <section key={category.id} id={`category-${category.id}`} className="space-y-2.5">
            {/* Category Section Header */}
            <div className="pt-2">
              <div className="flex items-baseline justify-between">
                <h2 className="font-serif text-lg sm:text-xl font-bold tracking-tight text-[#1C1917] dark:text-[#FAF4EB] lowercase flex items-center gap-1">
                  <span>{category.name}</span>
                  <span className="text-xs text-[#A62B34] dark:text-[#FF5B52]">✧</span>
                </h2>
                <span className="font-mono text-xs text-[#786F66] dark:text-[#C9AE8B]">
                  {category.items.length} items
                </span>
              </div>
              {category.description && (
                <p className="font-serif italic text-xs text-[#786F66] dark:text-[#C9AE8B]/70 mt-0.5 lowercase">
                  {category.description}
                </p>
              )}
            </div>

            {/* Item List */}
            <div className="space-y-3">
              {category.items.map((item) => (
                <MenuItemCard key={item.id} item={item} onOpenDetail={setSelectedItem} />
              ))}
            </div>
          </section>
        ))}

        {filteredCategories.length === 0 && (
          <div className="py-16 text-center text-stone-500 dark:text-stone-400">
            <p className="text-sm font-serif">No items found matching your search.</p>
            <button
              onClick={() => {
                setSearchQuery("");
                setFilterVegOnly(false);
              }}
              className="mt-3 text-xs font-semibold text-[#9B2C2C] dark:text-[#FF5B52] underline cursor-pointer"
            >
              Clear filters
            </button>
          </div>
        )}
      </main>

      {/* Floating Cart Bar */}
      <FloatingCartBar />

      {/* Cart Drawer */}
      <CartDrawer tableLabel={tableLabel} guestName={currentGuestName} />

      {/* Item Detail Modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          categories={categories}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
};

export const MenuClientView: React.FC<MenuClientViewProps> = (props) => {
  return (
    <CartProvider>
      <Suspense fallback={<MenuLoading />}>
        <MenuContentInner {...props} />
      </Suspense>
    </CartProvider>
  );
};
