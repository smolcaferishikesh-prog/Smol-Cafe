import { createAdminClient } from "@/lib/supabase/admin";
import type { MenuCategory, MenuItem, MenuItemVersion, MenuPrice } from "@smol-cafe/db";
import {
  MOCK_CATEGORIES,
  MOCK_MENU_ITEMS,
  MOCK_MENU_VERSIONS,
  MOCK_MENU_PRICES,
} from "@/lib/mock-db/seedData";

export interface MenuItemWithDetails {
  id: string;
  categoryId: string;
  name: string;
  status: string;
  description: string;
  pricePaise: number;
  imageUrl: string | null;
  metadata: {
    dietary?: string;
    protein_focus?: string;
    spice?: string;
    best_pairing?: string;
    chai_ke_saathi?: boolean;
    subcategory?: string;
    availability?: string;
    low_stock_portions?: number | null;
    chef_special?: boolean;
    core_ingredients?: string;
    primary_equipment?: string;
    serving_ware?: string;
    notes?: string;
    internal_notes?: string;
    customer_note?: string;
  };
}

export interface CategoryWithItems {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  items: MenuItemWithDetails[];
}

declare global {
  var __SMOL_CUSTOM_MENU_ITEMS__: MenuItemWithDetails[] | undefined;
  var __SMOL_MENU_OVERRIDES__: Record<string, Partial<MenuItemWithDetails>> | undefined;
  var __SMOL_DELETED_ITEM_IDS__: Set<string> | undefined;
}

export function getCustomItemsStore(): MenuItemWithDetails[] {
  if (!globalThis.__SMOL_CUSTOM_MENU_ITEMS__) {
    globalThis.__SMOL_CUSTOM_MENU_ITEMS__ = [];
  }
  return globalThis.__SMOL_CUSTOM_MENU_ITEMS__;
}

export function getMenuOverridesStore(): Record<string, Partial<MenuItemWithDetails>> {
  if (!globalThis.__SMOL_MENU_OVERRIDES__) {
    globalThis.__SMOL_MENU_OVERRIDES__ = {};
  }
  return globalThis.__SMOL_MENU_OVERRIDES__;
}

export function getDeletedItemsStore(): Set<string> {
  if (!globalThis.__SMOL_DELETED_ITEM_IDS__) {
    globalThis.__SMOL_DELETED_ITEM_IDS__ = new Set<string>();
  }
  return globalThis.__SMOL_DELETED_ITEM_IDS__;
}

/**
 * Fallback menu catalog builder from master seed data (59 artisanal items).
 */
function getFallbackCatalog(): CategoryWithItems[] {
  const categoryMap = new Map<string, CategoryWithItems>();

  for (const cat of MOCK_CATEGORIES) {
    categoryMap.set(cat.id, {
      id: cat.id,
      name: cat.name,
      sortOrder: cat.sort_order,
      items: [],
    });
  }

  const priceMap = new Map<string, number>();
  for (const p of MOCK_MENU_PRICES) {
    if (!priceMap.has(p.menu_item_id)) {
      priceMap.set(p.menu_item_id, p.amount_paise);
    }
  }

  const versionMap = new Map<string, (typeof MOCK_MENU_VERSIONS)[0]>();
  for (const v of MOCK_MENU_VERSIONS) {
    if (!versionMap.has(v.menu_item_id)) {
      versionMap.set(v.menu_item_id, v);
    }
  }

  const stockStore = (globalThis as any).__SMOL_KITCHEN_MENU_STOCK__ || {};
  const overrides = getMenuOverridesStore();
  const deletedIds = getDeletedItemsStore();

  for (const item of MOCK_MENU_ITEMS) {
    if (deletedIds.has(item.id)) continue;

    const cat = categoryMap.get(item.category_id);
    if (!cat) continue;

    const ver = versionMap.get(item.id);
    const rawPricePaise = priceMap.get(item.id) || 18000;
    const baseMeta = (ver?.metadata || item.metadata || {}) as MenuItemWithDetails["metadata"];
    const liveStock = stockStore[item.id];
    const override = overrides[item.id];

    let effectiveStatus = override?.status || (liveStock
      ? (liveStock.stockStatus === "SOLD_OUT" ? "SOLD_OUT" : item.status)
      : item.status);

    const metadata: MenuItemWithDetails["metadata"] = {
      ...baseMeta,
      ...(override?.metadata || {}),
      availability: liveStock ? liveStock.stockStatus : (override?.metadata?.availability || baseMeta.availability),
      low_stock_portions: liveStock?.lowStockCount ?? (override?.metadata?.low_stock_portions ?? (baseMeta as any)?.low_stock_portions),
    };

    cat.items.push({
      id: item.id,
      categoryId: override?.categoryId || item.category_id,
      name: override?.name || item.name,
      status: effectiveStatus,
      description: override?.description ?? (ver?.description || ""),
      pricePaise: override?.pricePaise !== undefined ? override.pricePaise : rawPricePaise,
      imageUrl: override?.imageUrl !== undefined ? override.imageUrl : (ver?.image_url || null),
      metadata,
    });
  }

  // Include dynamic custom items
  const customItems = getCustomItemsStore();
  for (const custom of customItems) {
    if (deletedIds.has(custom.id)) continue;
    const override = overrides[custom.id];
    const catId = override?.categoryId || custom.categoryId;
    let cat = categoryMap.get(catId);
    if (!cat) {
      // Find category by name or fallback to first
      const foundCat = Array.from(categoryMap.values()).find((c) => c.name.toLowerCase() === catId.toLowerCase() || c.id === catId);
      if (foundCat) {
        cat = foundCat;
      } else {
        cat = categoryMap.values().next().value;
      }
    }
    if (cat) {
      cat.items.push({
        ...custom,
        ...(override || {}),
        metadata: {
          ...custom.metadata,
          ...(override?.metadata || {}),
        },
      });
    }
  }

  return Array.from(categoryMap.values())
    .filter((cat) => cat.items.length > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

import { unstable_cache } from "next/cache";

export async function fetchMenuCatalogDirectly(): Promise<CategoryWithItems[]> {
  try {
    const supabase = createAdminClient();
    const nowIso = new Date().toISOString();

    // Run queries in parallel
    const [categoriesRes, itemsRes, pricesRes, versionsRes] = await Promise.all([
      supabase
        .from("menu_categories")
        .select("*")
        .order("sort_order", { ascending: true }),
      supabase
        .from("menu_items")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase
        .from("menu_prices")
        .select("*")
        .lte("effective_from", nowIso)
        .or(`effective_to.is.null,effective_to.gt.${nowIso}`)
        .order("effective_from", { ascending: false }),
      supabase
        .from("menu_item_versions")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    const categories = categoriesRes.data;
    const items = itemsRes.data;

    if (!categories || categories.length === 0 || !items || items.length === 0) {
      return getFallbackCatalog();
    }

    const prices = pricesRes.data;
    const versions = versionsRes.data;

    const priceMap = new Map<string, number>();
    for (const p of (prices as unknown as MenuPrice[]) || []) {
      if (!priceMap.has(p.menu_item_id)) {
        priceMap.set(p.menu_item_id, p.amount_paise);
      }
    }

    const versionMap = new Map<string, MenuItemVersion>();
    for (const v of (versions as unknown as MenuItemVersion[]) || []) {
      if (!versionMap.has(v.menu_item_id)) {
        versionMap.set(v.menu_item_id, v);
      }
    }

    const stockStore = (globalThis as any).__SMOL_KITCHEN_MENU_STOCK__ || {};
    const overrides = getMenuOverridesStore();
    const deletedIds = getDeletedItemsStore();

    // Combine into CategoryWithItems
    const categoryMap = new Map<string, CategoryWithItems>();

    for (const cat of categories as MenuCategory[]) {
      categoryMap.set(cat.id, {
        id: cat.id,
        name: cat.name,
        sortOrder: cat.sort_order,
        items: [],
      });
    }

    for (const item of items as MenuItem[]) {
      if (deletedIds.has(item.id)) continue;
      const cat = categoryMap.get(item.category_id);
      if (!cat) continue;

      const ver = versionMap.get(item.id);
      const rawPricePaise = priceMap.get(item.id) || 0;
      const baseMeta = (ver?.metadata || item.metadata || {}) as MenuItemWithDetails["metadata"];
      const liveStock = stockStore[item.id];
      const override = overrides[item.id];

      const effectiveStatus = override?.status || (liveStock
        ? (liveStock.stockStatus === "SOLD_OUT" ? "SOLD_OUT" : item.status)
        : item.status);

      const metadata: MenuItemWithDetails["metadata"] = {
        ...baseMeta,
        ...(override?.metadata || {}),
        availability: liveStock ? liveStock.stockStatus : (override?.metadata?.availability || baseMeta.availability),
        low_stock_portions: liveStock?.lowStockCount ?? (override?.metadata?.low_stock_portions ?? (baseMeta as any)?.low_stock_portions),
      };

      cat.items.push({
        id: item.id,
        categoryId: override?.categoryId || item.category_id,
        name: override?.name || item.name,
        status: effectiveStatus,
        description: override?.description ?? (ver?.description || ""),
        pricePaise: override?.pricePaise !== undefined ? override.pricePaise : rawPricePaise,
        imageUrl: override?.imageUrl !== undefined ? override.imageUrl : (ver?.image_url || null),
        metadata,
      });
    }

    // Include dynamic custom items
    const customItems = getCustomItemsStore();
    for (const custom of customItems) {
      if (deletedIds.has(custom.id)) continue;
      const override = overrides[custom.id];
      const catId = override?.categoryId || custom.categoryId;
      let cat = categoryMap.get(catId);
      if (!cat) {
        const foundCat = Array.from(categoryMap.values()).find((c) => c.name.toLowerCase() === catId.toLowerCase() || c.id === catId);
        if (foundCat) cat = foundCat;
        else cat = categoryMap.values().next().value;
      }
      if (cat) {
        cat.items.push({
          ...custom,
          ...(override || {}),
          metadata: {
            ...custom.metadata,
            ...(override?.metadata || {}),
          },
        });
      }
    }

    const result = Array.from(categoryMap.values())
      .filter((cat) => cat.items.length > 0)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return result.length > 0 ? result : getFallbackCatalog();
  } catch (error) {
    console.warn("Using fallback menu catalog due to error:", error);
    return getFallbackCatalog();
  }
}

/**
 * Cached getter for menu catalog.
 * Caches for 60 seconds and supports on-demand tag revalidation ("menu-catalog").
 */
export const getMenuCatalog = unstable_cache(
  async (): Promise<CategoryWithItems[]> => {
    return fetchMenuCatalogDirectly();
  },
  ["smol_menu_catalog_v3"],
  {
    revalidate: 1,
    tags: ["menu-catalog"],
  }
);


