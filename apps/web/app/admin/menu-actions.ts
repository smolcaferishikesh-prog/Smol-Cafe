"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath, revalidateTag } from "next/cache";
import { broadcastSyncEvent } from "@/lib/sync-events";
import {
  getMenuCatalog,
  getCustomItemsStore,
  getMenuOverridesStore,
  getDeletedItemsStore,
  type MenuItemWithDetails,
} from "@/lib/queries/menu";
import { MOCK_CATEGORIES } from "@/lib/mock-db/seedData";

export interface SaveMenuItemPayload {
  id?: string;
  name: string;
  categoryId: string;
  priceRupees: number;
  description?: string;
  imageUrl?: string | null;
  dietary?: "veg" | "non-veg" | "vegan" | "egg" | "beverage";
  bestPairing?: string;
  status?: "AVAILABLE" | "SOLD_OUT" | "ARCHIVED";
}

export interface AdminCategoryOption {
  id: string;
  name: string;
}

export interface AdminMenuItem {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  priceRupees: number;
  description: string;
  imageUrl: string | null;
  dietary: string;
  bestPairing?: string;
  status: string;
}

/**
 * Fetch all categories & menu items for Admin management
 */
export async function fetchAdminMenuCatalogAction(): Promise<{
  success: boolean;
  categories: AdminCategoryOption[];
  items: AdminMenuItem[];
}> {
  try {
    const catalog = await getMenuCatalog();

    const categories: AdminCategoryOption[] = catalog.map((cat) => ({
      id: cat.id,
      name: cat.name,
    }));

    // If catalog was empty or missing default categories, fallback to mock categories
    if (categories.length === 0) {
      MOCK_CATEGORIES.forEach((c) => {
        categories.push({ id: c.id, name: c.name });
      });
    }

    const items: AdminMenuItem[] = [];
    catalog.forEach((cat) => {
      cat.items.forEach((it) => {
        items.push({
          id: it.id,
          name: it.name,
          categoryId: cat.id,
          categoryName: cat.name,
          priceRupees: Math.round(it.pricePaise / 100),
          description: it.description || "",
          imageUrl: it.imageUrl || null,
          dietary: it.metadata?.dietary || "veg",
          bestPairing: it.metadata?.best_pairing || "",
          status: it.status || "AVAILABLE",
        });
      });
    });

    return {
      success: true,
      categories,
      items,
    };
  } catch (error: any) {
    console.error("fetchAdminMenuCatalogAction error:", error);
    return {
      success: false,
      categories: MOCK_CATEGORIES.map((c) => ({ id: c.id, name: c.name })),
      items: [],
    };
  }
}

/**
 * Uploads a base64 image data string to Supabase Storage ('menu-photos' bucket)
 * and returns the public CDN URL to prevent database text bloat.
 */
async function uploadBase64ToStorage(base64Data: string, itemId: string): Promise<string> {
  if (!base64Data || !base64Data.startsWith("data:image")) {
    return base64Data;
  }
  try {
    const supabase = createAdminClient();
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return base64Data;

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], "base64");
    const ext = mimeType.split("/")[1] || "jpeg";
    const filename = `dishes/${itemId}_${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
      .from("menu-photos")
      .upload(filename, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (!error && data?.path) {
      const { data: publicUrlData } = supabase.storage
        .from("menu-photos")
        .getPublicUrl(data.path);
      if (publicUrlData?.publicUrl) {
        return publicUrlData.publicUrl;
      }
    }
  } catch (storageErr) {
    console.warn("Storage upload notice (falling back to data string):", storageErr);
  }
  return base64Data;
}

/**
 * Add or Edit a Menu Item with real-time propagation to Customer Menu & KDS
 */
export async function saveMenuItemAction(
  payload: SaveMenuItemPayload
): Promise<{ success: boolean; message: string; itemId: string }> {
  try {
    const { id, name, categoryId, priceRupees, description, imageUrl, dietary, bestPairing, status } = payload;
    const isEdit = !!id;
    const itemId = id || `item_custom_${Date.now()}`;
    const amountPaise = Math.round(priceRupees * 100);
    const itemStatus = status || "AVAILABLE";

    // Auto-upload base64 to Supabase Storage if present
    const finalImageUrl = imageUrl ? await uploadBase64ToStorage(imageUrl, itemId) : null;

    const customStore = getCustomItemsStore();
    const overridesStore = getMenuOverridesStore();
    const deletedStore = getDeletedItemsStore();

    // Ensure it's not marked deleted
    deletedStore.delete(itemId);

    if (isEdit) {
      // Record override for existing item
      overridesStore[itemId] = {
        name,
        categoryId,
        pricePaise: amountPaise,
        description: description || "",
        imageUrl: finalImageUrl,
        status: itemStatus,
        metadata: {
          ...(overridesStore[itemId]?.metadata || {}),
          dietary: dietary || "veg",
          best_pairing: bestPairing !== undefined ? bestPairing.trim() : (overridesStore[itemId]?.metadata?.best_pairing || ""),
          availability: itemStatus === "SOLD_OUT" ? "SOLD_OUT" : "IN_STOCK",
        },
      };

      // If it exists in custom store, update in place
      const existingCustomIdx = customStore.findIndex((i) => i.id === itemId);
      if (existingCustomIdx >= 0) {
        customStore[existingCustomIdx] = {
          ...customStore[existingCustomIdx],
          name,
          categoryId,
          pricePaise: amountPaise,
          description: description || "",
          imageUrl: finalImageUrl,
          status: itemStatus,
          metadata: {
            ...customStore[existingCustomIdx].metadata,
            dietary: dietary || "veg",
            best_pairing: bestPairing !== undefined ? bestPairing.trim() : (customStore[existingCustomIdx].metadata?.best_pairing || ""),
            availability: itemStatus === "SOLD_OUT" ? "SOLD_OUT" : "IN_STOCK",
          },
        };
      }
    } else {
      // Create new dynamic custom item
      const newItem: MenuItemWithDetails = {
        id: itemId,
        categoryId,
        name,
        status: itemStatus,
        description: description || "",
        pricePaise: amountPaise,
        imageUrl: finalImageUrl,
        metadata: {
          dietary: dietary || "veg",
          best_pairing: bestPairing?.trim() || "",
          availability: itemStatus === "SOLD_OUT" ? "SOLD_OUT" : "IN_STOCK",
        },
      };
      customStore.push(newItem);
    }

    // Attempt Supabase PostgreSQL upsert if configured
    try {
      const supabase = createAdminClient();

      if (isEdit) {
        await supabase
          .from("menu_items")
          .update({
            name,
            category_id: categoryId,
            status: itemStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", itemId);

        await supabase
          .from("menu_prices")
          .upsert({
            menu_item_id: itemId,
            amount_paise: amountPaise,
            currency: "INR",
            effective_from: new Date().toISOString(),
          });

        await supabase
          .from("menu_item_versions")
          .insert({
            menu_item_id: itemId,
            description: description || "",
            image_url: imageUrl || null,
          });
      } else {
        await supabase
          .from("menu_items")
          .insert({
            id: itemId,
            category_id: categoryId,
            name,
            status: itemStatus,
          });

        await supabase
          .from("menu_prices")
          .insert({
            menu_item_id: itemId,
            amount_paise: amountPaise,
            currency: "INR",
            effective_from: new Date().toISOString(),
          });

        await supabase
          .from("menu_item_versions")
          .insert({
            menu_item_id: itemId,
            description: description || "",
            image_url: imageUrl || null,
          });
      }
    } catch {
      // In-memory fallback handles gracefully
    }

    // Ensure kitchen stock store is 100% in sync
    if (!globalThis.__SMOL_KITCHEN_MENU_STOCK__) {
      globalThis.__SMOL_KITCHEN_MENU_STOCK__ = {};
    }
    globalThis.__SMOL_KITCHEN_MENU_STOCK__[itemId] = {
      ...(globalThis.__SMOL_KITCHEN_MENU_STOCK__[itemId] || {}),
      stockStatus: itemStatus === "SOLD_OUT" ? "SOLD_OUT" : "IN_STOCK",
      chefNotes: description || "",
    };

    broadcastSyncEvent({
      type: "ITEM_AVAILABILITY_CHANGED",
      itemId,
      stockStatus: itemStatus === "SOLD_OUT" ? "SOLD_OUT" : "IN_STOCK",
      availability: itemStatus === "SOLD_OUT" ? "SOLD_OUT" : "IN_STOCK",
      priceRupees,
      timestamp: Date.now(),
      metadata: {
        id: itemId,
        name,
        categoryId,
        priceRupees,
        description: description || "",
        dietary: dietary || "veg",
        best_pairing: bestPairing?.trim() || "",
        status: itemStatus,
        stockStatus: itemStatus === "SOLD_OUT" ? "SOLD_OUT" : "IN_STOCK",
        imageUrl: finalImageUrl,
      },
    });

    try {
      revalidateTag("menu-catalog");
      revalidatePath("/menu");
      revalidatePath("/smol-menu");
      revalidatePath("/admin");
      revalidatePath("/");
    } catch {
      // ignore
    }

    return {
      success: true,
      message: isEdit ? `Dish "${name}" updated successfully.` : `Dish "${name}" created and added to menu.`,
      itemId,
    };
  } catch (error: any) {
    console.error("saveMenuItemAction error:", error);
    return {
      success: false,
      message: error?.message || "Failed to save menu item.",
      itemId: payload.id || "",
    };
  }
}

/**
 * Delete / Archive a Menu Item
 */
export async function deleteMenuItemAction(
  itemId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const deletedStore = getDeletedItemsStore();
    deletedStore.add(itemId);

    // Also remove from custom store if present
    const customStore = getCustomItemsStore();
    const idx = customStore.findIndex((i) => i.id === itemId);
    if (idx >= 0) {
      customStore.splice(idx, 1);
    }

    // Try deleting or marking archived in Supabase
    try {
      const supabase = createAdminClient();
      await supabase
        .from("menu_items")
        .update({ status: "ARCHIVED" })
        .eq("id", itemId);
    } catch {
      // ignore
    }

    broadcastSyncEvent({
      type: "ITEM_AVAILABILITY_CHANGED",
      itemId,
      stockStatus: "ARCHIVED",
      availability: "ARCHIVED",
      timestamp: Date.now(),
      metadata: {
        id: itemId,
        status: "ARCHIVED",
      },
    });

    return {
      success: true,
      message: "Menu item removed successfully.",
    };
  } catch (error: any) {
    console.error("deleteMenuItemAction error:", error);
    return {
      success: false,
      message: error?.message || "Failed to delete menu item.",
    };
  }
}

/**
 * Fetch full live catalog for customer menu instant refresh
 */
export async function fetchLiveMenuCatalogAction() {
  try {
    const categories = await getMenuCatalog();
    return {
      success: true,
      categories,
    };
  } catch (error: any) {
    console.error("fetchLiveMenuCatalogAction error:", error);
    return {
      success: false,
      categories: [],
    };
  }
}
