"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { getMenuCatalog, getMenuOverridesStore, type CategoryWithItems } from "@/lib/queries/menu";
import { broadcastSyncEvent } from "@/lib/sync-events";

export type ItemStockStatus = "IN_STOCK" | "LOW_STOCK" | "SOLD_OUT";

export interface KitchenMenuItem {
  id: string;
  name: string;
  category: string;
  station: string;
  priceRupees: number;
  stockStatus: ItemStockStatus;
  lowStockCount?: number;
  isChefSpecial?: boolean;
  chefNotes?: string;
  imageUrl?: string | null;
  coreIngredients?: string;
  dietary?: string;
  bestPairing?: string;
}

export interface KitchenIngredientItem {
  id: string;
  name: string;
  category: string;
  inStock: boolean;
  affectedItemsCount: number;
}

// Global in-memory overrides for zero-lag sync across actions
declare global {
  var __SMOL_KITCHEN_MENU_STOCK__: Record<
    string,
    {
      stockStatus: ItemStockStatus;
      lowStockCount?: number;
      isChefSpecial?: boolean;
      chefNotes?: string;
    }
  > | undefined;

  var __SMOL_KITCHEN_INGREDIENTS__: Record<string, boolean> | undefined;
}

function getStockStore() {
  if (!globalThis.__SMOL_KITCHEN_MENU_STOCK__) {
    globalThis.__SMOL_KITCHEN_MENU_STOCK__ = {};
  }
  return globalThis.__SMOL_KITCHEN_MENU_STOCK__;
}

function getIngredientStore() {
  if (!globalThis.__SMOL_KITCHEN_INGREDIENTS__) {
    globalThis.__SMOL_KITCHEN_INGREDIENTS__ = {
      "Sourdough Loaves": true,
      "Specialty Coffee Beans": true,
      "Organic Oat Milk": true,
      "Fresh Whole Milk": true,
      "Artisanal Paneer": true,
      "Avocados": true,
      "Brioche Buns": true,
      "Salted Butter": true,
    };
  }
  return globalThis.__SMOL_KITCHEN_INGREDIENTS__;
}

// Station classification helper
function inferStation(categoryName: string, itemName: string): string {
  const cat = categoryName.toLowerCase();
  const name = itemName.toLowerCase();

  if (cat.includes("coffee") || cat.includes("cold & easy") || cat.includes("shakes") || cat.includes("chai")) {
    return "Brew Bar & Beverages";
  }
  if (cat.includes("slow mornings") || cat.includes("there's always room") || name.includes("croissant") || name.includes("bun")) {
    return "Bakery & Bakes";
  }
  if (cat.includes("sandwiches") || cat.includes("pasta & pizza")) {
    return "Hot Kitchen & Grill";
  }
  return "Cold Prep & Bowls";
}

/**
 * Fetch all menu items formatted specifically for kitchen chefs and KDS inventory checks
 */
export async function fetchKitchenMenuCatalogAction(): Promise<{
  success: boolean;
  items: KitchenMenuItem[];
  ingredients: KitchenIngredientItem[];
  stations: string[];
}> {
  try {
    const catalog = await getMenuCatalog();
    const stockStore = getStockStore();
    const ingredientStore = getIngredientStore();

    const items: KitchenMenuItem[] = [];

    catalog.forEach((cat: CategoryWithItems) => {
      cat.items.forEach((it) => {
        const custom = stockStore[it.id] || { stockStatus: "IN_STOCK" };
        const station = inferStation(cat.name, it.name);

        items.push({
          id: it.id,
          name: it.name,
          category: cat.name,
          station,
          priceRupees: Math.round(it.pricePaise / 100),
          stockStatus: custom.stockStatus,
          lowStockCount: custom.lowStockCount,
          isChefSpecial: custom.isChefSpecial || false,
          chefNotes: custom.chefNotes || (it.metadata?.notes as string | undefined),
          imageUrl: it.imageUrl,
          coreIngredients: it.metadata?.core_ingredients as string | undefined,
          dietary: it.metadata?.dietary as string | undefined,
          bestPairing: it.metadata?.best_pairing as string | undefined,
        });
      });
    });

    const stations = [
      "All Stations",
      "Hot Kitchen & Grill",
      "Bakery & Bakes",
      "Brew Bar & Beverages",
      "Cold Prep & Bowls",
    ];

    const ingredients: KitchenIngredientItem[] = Object.entries(ingredientStore).map(
      ([name, inStock], idx) => {
        const lower = name.toLowerCase().split(" ")[0];
        const affected = items.filter((item) =>
          (item.coreIngredients || "").toLowerCase().includes(lower) ||
          item.name.toLowerCase().includes(lower)
        ).length;

        return {
          id: `ing_${idx + 1}`,
          name,
          category: name.includes("Milk") || name.includes("Butter") ? "Dairy" : "Pantry",
          inStock,
          affectedItemsCount: Math.max(affected, 2),
        };
      }
    );

    return {
      success: true,
      items,
      ingredients,
      stations,
    };
  } catch (err: any) {
    console.error("fetchKitchenMenuCatalogAction error:", err);
    return {
      success: false,
      items: [],
      ingredients: [],
      stations: [],
    };
  }
}

/**
 * Update stock status of an item (IN_STOCK, LOW_STOCK, SOLD_OUT)
 */
export async function updateMenuItemStockAction(
  itemId: string,
  stockStatus: ItemStockStatus,
  lowStockCount?: number
): Promise<{ success: boolean; message: string; itemId: string; stockStatus: ItemStockStatus }> {
  try {
    const stockStore = getStockStore();
    const existing = stockStore[itemId] || { stockStatus: "IN_STOCK" };

    stockStore[itemId] = {
      ...existing,
      stockStatus,
      lowStockCount: stockStatus === "LOW_STOCK" ? (lowStockCount ?? 3) : undefined,
    };

    // Keep overrides store 100% in sync
    const overridesStore = getMenuOverridesStore();
    const effectiveAdminStatus = stockStatus === "SOLD_OUT" ? "SOLD_OUT" : "AVAILABLE";
    overridesStore[itemId] = {
      ...(overridesStore[itemId] || {}),
      status: effectiveAdminStatus,
      metadata: {
        ...(overridesStore[itemId]?.metadata || {}),
        availability: stockStatus,
      },
    };

    // Also update in Supabase / Mock database if available
    try {
      const supabase = createAdminClient();
      await supabase
        .from("menu_items")
        .update({
          status: effectiveAdminStatus,
          metadata: {
            availability: stockStatus,
            low_stock_portions: stockStatus === "LOW_STOCK" ? (lowStockCount ?? 3) : null,
          },
        })
        .eq("id", itemId);
    } catch {
      // ignore
    }

    // Broadcast sync event to all connected interfaces (Customer, Admin, KDS, Barista)
    broadcastSyncEvent({
      type: "ITEM_AVAILABILITY_CHANGED",
      itemId,
      stockStatus,
      availability: stockStatus,
      timestamp: Date.now(),
      metadata: {
        id: itemId,
        status: effectiveAdminStatus,
        availability: stockStatus,
        stockStatus,
      },
    });

    const statusLabel =
      stockStatus === "SOLD_OUT" ? "OUT OF STOCK" : stockStatus === "LOW_STOCK" ? "LOW STOCK" : "IN STOCK";

    return {
      success: true,
      message: `Item status updated to ${statusLabel}`,
      itemId,
      stockStatus,
    };
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to update item stock.", itemId, stockStatus };
  }
}

/**
 * Bulk toggle all items in a station or category (e.g. 86 all Shakes or all Bakery items)
 */
export async function bulkSetCategoryStockAction(
  categoryOrStation: string,
  stockStatus: ItemStockStatus
): Promise<{ success: boolean; message: string; updatedCount: number; updatedItemIds: string[] }> {
  try {
    const catalog = await getMenuCatalog();
    const stockStore = getStockStore();
    let count = 0;
    const targetItems: string[] = [];

    catalog.forEach((cat) => {
      cat.items.forEach((it) => {
        const station = inferStation(cat.name, it.name);
        if (
          categoryOrStation === "ALL" ||
          cat.name.toLowerCase() === categoryOrStation.toLowerCase() ||
          station.toLowerCase() === categoryOrStation.toLowerCase()
        ) {
          targetItems.push(it.id);
          stockStore[it.id] = {
            stockStatus,
            lowStockCount: stockStatus === "LOW_STOCK" ? 3 : undefined,
          };
          count++;
        }
      });
    });

    try {
      const supabase = createAdminClient();
      if (targetItems.length > 0) {
        await supabase
          .from("menu_items")
          .update({
            status: stockStatus === "SOLD_OUT" ? "SOLD_OUT" : "ACTIVE",
            metadata: { availability: stockStatus },
          })
          .in("id", targetItems);
      }
    } catch {
      // ignore
    }

    revalidatePath("/kitchen");
    revalidatePath("/smol-menu");
    revalidatePath("/menu");
    revalidatePath("/admin");

    return {
      success: true,
      message: `${count} items marked as ${stockStatus.replace("_", " ")}`,
      updatedCount: count,
      updatedItemIds: targetItems,
    };
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed bulk update.", updatedCount: 0, updatedItemIds: [] };
  }
}

/**
 * Update Chef's special recommendation or daily preparation notes
 */
export async function updateChefItemNotesAction(
  itemId: string,
  chefNotes: string,
  isChefSpecial: boolean
): Promise<{ success: boolean; message: string }> {
  try {
    const stockStore = getStockStore();
    const existing = stockStore[itemId] || { stockStatus: "IN_STOCK" };

    stockStore[itemId] = {
      ...existing,
      chefNotes: chefNotes.trim(),
      isChefSpecial,
    };

    try {
      const supabase = createAdminClient();
      await supabase
        .from("menu_items")
        .update({
          metadata: {
            notes: chefNotes.trim(),
            chef_special: isChefSpecial,
          },
        })
        .eq("id", itemId);
    } catch {
      // ignore
    }

    revalidatePath("/kitchen");
    revalidatePath("/smol-menu");
    revalidatePath("/menu");

    return {
      success: true,
      message: "Chef notes updated successfully!",
    };
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to update chef notes." };
  }
}

/**
 * Update ingredient stock toggle (Available vs Depleted)
 */
export async function updateIngredientStockAction(
  ingredientName: string,
  inStock: boolean
): Promise<{ success: boolean; message: string }> {
  try {
    const ingredientStore = getIngredientStore();
    ingredientStore[ingredientName] = inStock;

    revalidatePath("/kitchen");

    return {
      success: true,
      message: `${ingredientName} marked as ${inStock ? "IN STOCK" : "DEPLETED"}`,
    };
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to toggle ingredient." };
  }
}
