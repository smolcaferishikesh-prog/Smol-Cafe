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

const isServer = typeof window === "undefined";

interface PersistedMenuStore {
  customItems: MenuItemWithDetails[];
  menuOverrides: Record<string, Partial<MenuItemWithDetails>>;
  deletedItemIds: string[];
}

function getPersistenceFilePath(): string | null {
  if (!isServer) return null;
  try {
    const path = require("path");
    const cwd = process.cwd();
    if (cwd.endsWith("apps/web")) {
      return path.join(cwd, "data/menu-store.json");
    }
    return path.join(cwd, "apps/web/data/menu-store.json");
  } catch {
    return null;
  }
}

function loadPersistedStore(): PersistedMenuStore {
  if (!isServer) return { customItems: [], menuOverrides: {}, deletedItemIds: [] };
  try {
    const fs = require("fs");
    const filePath = getPersistenceFilePath();
    if (filePath && fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        customItems: Array.isArray(parsed.customItems) ? parsed.customItems : [],
        menuOverrides: parsed.menuOverrides && typeof parsed.menuOverrides === "object" ? parsed.menuOverrides : {},
        deletedItemIds: Array.isArray(parsed.deletedItemIds) ? parsed.deletedItemIds : [],
      };
    }
  } catch (err) {
    console.warn("Notice loading menu-store.json:", err);
  }
  return { customItems: [], menuOverrides: {}, deletedItemIds: [] };
}

declare global {
  var __SMOL_CUSTOM_MENU_ITEMS__: MenuItemWithDetails[] | undefined;
  var __SMOL_MENU_OVERRIDES__: Record<string, Partial<MenuItemWithDetails>> | undefined;
  var __SMOL_DELETED_ITEM_IDS__: Set<string> | undefined;
  var __SMOL_MENU_CATALOG_CACHE__: {
    timestamp: number;
    allCategories: CategoryWithItems[];
  } | undefined;
}

export function invalidateMenuCatalogCache() {
  if (typeof globalThis !== "undefined") {
    globalThis.__SMOL_MENU_CATALOG_CACHE__ = undefined;
  }
}

export function savePersistedMenuStore() {
  invalidateMenuCatalogCache();
  if (!isServer) return;
  try {
    const fs = require("fs");
    const path = require("path");
    const filePath = getPersistenceFilePath();
    if (!filePath) return;
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data: PersistedMenuStore = {
      customItems: globalThis.__SMOL_CUSTOM_MENU_ITEMS__ || [],
      menuOverrides: globalThis.__SMOL_MENU_OVERRIDES__ || {},
      deletedItemIds: Array.from(globalThis.__SMOL_DELETED_ITEM_IDS__ || []),
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("Notice saving menu-store.json:", err);
  }
}

export function getCustomItemsStore(): MenuItemWithDetails[] {
  if (!globalThis.__SMOL_CUSTOM_MENU_ITEMS__) {
    const persisted = loadPersistedStore();
    globalThis.__SMOL_CUSTOM_MENU_ITEMS__ = persisted.customItems;
    if (!globalThis.__SMOL_MENU_OVERRIDES__) {
      globalThis.__SMOL_MENU_OVERRIDES__ = persisted.menuOverrides;
    }
    if (!globalThis.__SMOL_DELETED_ITEM_IDS__) {
      globalThis.__SMOL_DELETED_ITEM_IDS__ = new Set(persisted.deletedItemIds);
    }
  }
  return globalThis.__SMOL_CUSTOM_MENU_ITEMS__;
}

export function getMenuOverridesStore(): Record<string, Partial<MenuItemWithDetails>> {
  if (!globalThis.__SMOL_MENU_OVERRIDES__) {
    const persisted = loadPersistedStore();
    globalThis.__SMOL_MENU_OVERRIDES__ = persisted.menuOverrides;
    if (!globalThis.__SMOL_CUSTOM_MENU_ITEMS__) {
      globalThis.__SMOL_CUSTOM_MENU_ITEMS__ = persisted.customItems;
    }
    if (!globalThis.__SMOL_DELETED_ITEM_IDS__) {
      globalThis.__SMOL_DELETED_ITEM_IDS__ = new Set(persisted.deletedItemIds);
    }
  }
  return globalThis.__SMOL_MENU_OVERRIDES__;
}

export function getDeletedItemsStore(): Set<string> {
  if (!globalThis.__SMOL_DELETED_ITEM_IDS__) {
    const persisted = loadPersistedStore();
    globalThis.__SMOL_DELETED_ITEM_IDS__ = new Set(persisted.deletedItemIds);
    if (!globalThis.__SMOL_CUSTOM_MENU_ITEMS__) {
      globalThis.__SMOL_CUSTOM_MENU_ITEMS__ = persisted.customItems;
    }
    if (!globalThis.__SMOL_MENU_OVERRIDES__) {
      globalThis.__SMOL_MENU_OVERRIDES__ = persisted.menuOverrides;
    }
  }
  return globalThis.__SMOL_DELETED_ITEM_IDS__;
}

/**
 * Applies in-memory overrides, custom items, deleted items, and kitchen stock status in < 1ms
 * on top of cached or freshly fetched categories.
 */
function applyLiveOverridesToCategories(
  baseCategories: CategoryWithItems[],
  includeEmptyCategories: boolean
): CategoryWithItems[] {
  const stockStore = (globalThis as any).__SMOL_KITCHEN_MENU_STOCK__ || {};
  const overrides = getMenuOverridesStore();
  const deletedIds = getDeletedItemsStore();
  const customItems = getCustomItemsStore();

  const categoryMap = new Map<string, CategoryWithItems>();
  for (const cat of baseCategories) {
    categoryMap.set(cat.id, {
      ...cat,
      items: [],
    });
  }

  for (const cat of baseCategories) {
    for (const item of cat.items) {
      if (deletedIds.has(item.id) || item.status === "ARCHIVED") continue;
      const override = overrides[item.id];
      const liveStock = stockStore[item.id];
      const effectiveStatus =
        override?.status ||
        (liveStock
          ? liveStock.stockStatus === "SOLD_OUT"
            ? "SOLD_OUT"
            : item.status
          : item.status);

      if (effectiveStatus === "ARCHIVED") continue;

      const targetCatId = override?.categoryId || item.categoryId;
      const targetCat = categoryMap.get(targetCatId) || categoryMap.get(cat.id);
      if (!targetCat) continue;

      targetCat.items.push({
        ...item,
        ...(override || {}),
        id: item.id,
        categoryId: targetCat.id,
        status: effectiveStatus,
        metadata: {
          ...item.metadata,
          ...(override?.metadata || {}),
          availability: liveStock
            ? liveStock.stockStatus
            : override?.metadata?.availability || item.metadata.availability,
          low_stock_portions:
            liveStock?.lowStockCount ??
            (override?.metadata?.low_stock_portions ?? item.metadata.low_stock_portions),
        },
      });
    }
  }

  for (const custom of customItems) {
    if (deletedIds.has(custom.id) || custom.status === "ARCHIVED") continue;
    const override = overrides[custom.id];
    if (override?.status === "ARCHIVED") continue;

    const catId = override?.categoryId || custom.categoryId;
    let cat = categoryMap.get(catId);
    if (!cat) {
      const foundCat = Array.from(categoryMap.values()).find(
        (c) => c.name.toLowerCase() === catId.toLowerCase() || c.id === catId
      );
      cat = foundCat || categoryMap.values().next().value;
    }
    if (cat) {
      const liveStock = stockStore[custom.id];
      const effectiveStatus =
        override?.status ||
        (liveStock
          ? liveStock.stockStatus === "SOLD_OUT"
            ? "SOLD_OUT"
            : custom.status
          : custom.status);
      const resolvedItem: MenuItemWithDetails = {
        ...custom,
        ...(override || {}),
        categoryId: cat.id,
        status: effectiveStatus,
        metadata: {
          ...custom.metadata,
          ...(override?.metadata || {}),
          availability: liveStock
            ? liveStock.stockStatus
            : override?.metadata?.availability || custom.metadata.availability,
        },
      };
      const existingIdx = cat.items.findIndex((i) => i.id === custom.id);
      if (existingIdx >= 0) {
        cat.items[existingIdx] = resolvedItem;
      } else {
        cat.items.push(resolvedItem);
      }
    }
  }

  const seenCatalogItemIds = new Set<string>();
  for (const cat of categoryMap.values()) {
    cat.items = cat.items.filter((item) => {
      if (seenCatalogItemIds.has(item.id)) return false;
      seenCatalogItemIds.add(item.id);
      return true;
    });
  }

  return Array.from(categoryMap.values())
    .filter((cat) => includeEmptyCategories || cat.items.length > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Fallback menu catalog builder from master seed data.
 */
function getFallbackCatalog(includeEmptyCategories = false): CategoryWithItems[] {
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

  for (const item of MOCK_MENU_ITEMS) {
    const cat = categoryMap.get(item.category_id);
    if (!cat) continue;

    const ver = versionMap.get(item.id);
    const rawPricePaise = priceMap.get(item.id) || 18000;
    const baseMeta = (ver?.metadata || item.metadata || {}) as MenuItemWithDetails["metadata"];

    cat.items.push({
      id: item.id,
      categoryId: item.category_id,
      name: item.name,
      status: item.status,
      description: ver?.description || "",
      pricePaise: rawPricePaise,
      imageUrl: ver?.image_url || null,
      metadata: baseMeta,
    });
  }

  return applyLiveOverridesToCategories(Array.from(categoryMap.values()), includeEmptyCategories);
}

export async function fetchMenuCatalogDirectly(includeEmptyCategories = false): Promise<CategoryWithItems[]> {
  // Check hot in-memory catalog cache (15s TTL) + apply live in-memory overrides in < 1ms
  if (globalThis.__SMOL_MENU_CATALOG_CACHE__) {
    const age = Date.now() - globalThis.__SMOL_MENU_CATALOG_CACHE__.timestamp;
    if (age < 15000) {
      return applyLiveOverridesToCategories(
        globalThis.__SMOL_MENU_CATALOG_CACHE__.allCategories,
        includeEmptyCategories
      );
    }
  }

  try {
    const supabase = createAdminClient();
    const nowIso = new Date().toISOString();

    // Run bounded queries in parallel
    const [categoriesRes, itemsRes, pricesRes, versionsRes] = await Promise.all([
      supabase
        .from("menu_categories")
        .select("*")
        .order("sort_order", { ascending: true }),
      supabase
        .from("menu_items")
        .select("*")
        .neq("status", "ARCHIVED")
        .order("created_at", { ascending: true }),
      supabase
        .from("menu_prices")
        .select("menu_item_id, amount_paise, effective_from, effective_to")
        .lte("effective_from", nowIso)
        .or(`effective_to.is.null,effective_to.gt.${nowIso}`)
        .order("effective_from", { ascending: false })
        .limit(500),
      supabase
        .from("menu_item_versions")
        .select("menu_item_id, description, image_url, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    const categories = categoriesRes.data;
    const items = itemsRes.data || [];

    // Fall back to seed catalog only if database connection failed or categories table is completely empty
    if (!categories || categories.length === 0) {
      return getFallbackCatalog(includeEmptyCategories);
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
      if (item.status === "ARCHIVED") continue;
      const cat = categoryMap.get(item.category_id);
      if (!cat) continue;

      const ver = versionMap.get(item.id);
      const rawPricePaise = priceMap.get(item.id) || 0;
      const baseMeta = (ver?.metadata || item.metadata || {}) as MenuItemWithDetails["metadata"];

      cat.items.push({
        id: item.id,
        categoryId: item.category_id,
        name: item.name,
        status: item.status,
        description: ver?.description || "",
        pricePaise: rawPricePaise,
        imageUrl: ver?.image_url || null,
        metadata: baseMeta,
      });
    }

    const allBaseCategories = Array.from(categoryMap.values()).sort((a, b) => a.sortOrder - b.sortOrder);

    globalThis.__SMOL_MENU_CATALOG_CACHE__ = {
      timestamp: Date.now(),
      allCategories: allBaseCategories,
    };

    return applyLiveOverridesToCategories(allBaseCategories, includeEmptyCategories);
  } catch (error) {
    console.warn("Using fallback menu catalog due to error:", error);
    return getFallbackCatalog(includeEmptyCategories);
  }
}

/**
 * Direct getter for real-time menu catalog with live in-memory override application.
 */
export async function getMenuCatalog(includeEmptyCategories = false): Promise<CategoryWithItems[]> {
  return fetchMenuCatalogDirectly(includeEmptyCategories);
}
