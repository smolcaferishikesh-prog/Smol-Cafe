"use server";

import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffAuth } from "@/lib/auth/rbac";
import { revalidateTag } from "next/cache";
import { broadcastSyncEvent } from "@/lib/sync-events";
import { invalidateAdminOverviewCache } from "@/app/admin/actions";
import {
  getMenuCatalog,
  getCustomItemsStore,
  getMenuOverridesStore,
  getDeletedItemsStore,
  savePersistedMenuStore,
  invalidateMenuCatalogCache,
  type MenuItemWithDetails,
  type MenuCustomizationOption,
} from "@/lib/queries/menu";
import {
  MOCK_CATEGORIES,
  MOCK_MENU_ITEMS,
  MOCK_MENU_VERSIONS,
  MOCK_MENU_PRICES,
} from "@/lib/mock-db/seedData";

const isUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

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
  customizationEnabled?: boolean;
  customizationTitle?: string;
  customizationOptions?: MenuCustomizationOption[];
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
  customizationEnabled?: boolean;
  customizationTitle?: string;
  customizationOptions?: MenuCustomizationOption[];
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
    const catalog = await getMenuCatalog(true);

    const categories: AdminCategoryOption[] = catalog.map((cat) => ({
      id: cat.id,
      name: cat.name,
    }));

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
          customizationEnabled: it.metadata?.customization_enabled,
          customizationTitle: it.metadata?.customization_title,
          customizationOptions: it.metadata?.customization_options,
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

    let uploadRes = await supabase.storage
      .from("menu-photos")
      .upload(filename, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadRes.error && (uploadRes.error as any).message?.toLowerCase().includes("not found")) {
      try {
        await supabase.storage.createBucket("menu-photos", { public: true });
        uploadRes = await supabase.storage
          .from("menu-photos")
          .upload(filename, buffer, {
            contentType: mimeType,
            upsert: true,
          });
      } catch {}
    }

    if (!uploadRes.error && uploadRes.data?.path) {
      const { data: publicUrlData } = supabase.storage
        .from("menu-photos")
        .getPublicUrl(uploadRes.data.path);
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
 * Add or Edit a Menu Item with instant memory/disk persistence and background DB sync
 */
export async function saveMenuItemAction(
  payload: SaveMenuItemPayload
): Promise<{ success: boolean; message: string; itemId: string; imageUrl?: string | null }> {
  const auth = await requireStaffAuth(["admin", "super_admin"]);
  if (!auth.authorized) {
    return { success: false, message: auth.message || "Unauthorized.", itemId: payload.id || "" };
  }

  try {
    const {
      id,
      name,
      categoryId,
      priceRupees,
      description,
      imageUrl,
      dietary,
      bestPairing,
      status,
      customizationEnabled,
      customizationTitle,
      customizationOptions,
    } = payload;
    const isEdit = !!id;
    const amountPaise = Math.round(priceRupees * 100);
    const itemStatus = status || "AVAILABLE";

    const supabase = createAdminClient();

    // Fast category resolution using MOCK_CATEGORIES first (0ms), fallback to DB only if unknown
    let resolvedCategoryId = categoryId;
    if (!isUuid(resolvedCategoryId)) {
      const mockMatch = MOCK_CATEGORIES.find(
        (c) =>
          c.id === categoryId ||
          c.name.toLowerCase() === categoryId.toLowerCase() ||
          c.name.toLowerCase().includes(categoryId.toLowerCase())
      );
      if (mockMatch) {
        resolvedCategoryId = mockMatch.id;
      } else {
        try {
          const { data: allDbCats } = await supabase.from("menu_categories").select("id, name");
          const matched = allDbCats?.find(
            (c) =>
              c.id === categoryId ||
              c.name.toLowerCase() === categoryId.toLowerCase() ||
              c.name.toLowerCase().includes(categoryId.toLowerCase())
          );
          if (matched) {
            resolvedCategoryId = matched.id;
          } else if (allDbCats && allDbCats.length > 0) {
            resolvedCategoryId = allDbCats[0].id;
          }
        } catch {}
      }
    }

    // Determine final UUID immediately (deterministic UUID for legacy mock IDs if needed)
    let finalItemId = id && isUuid(id) ? id : "";
    if (!finalItemId) {
      if (isEdit && id) {
        const mockItem = MOCK_MENU_ITEMS.find((m) => m.id === id || m.name.toLowerCase() === name.trim().toLowerCase());
        if (mockItem && isUuid(mockItem.id)) {
          finalItemId = mockItem.id;
        } else {
          finalItemId = id;
        }
      } else {
        finalItemId = crypto.randomUUID();
      }
    }

    const initialImageUrl = imageUrl || null;

    const customStore = getCustomItemsStore();
    const overridesStore = getMenuOverridesStore();
    const deletedStore = getDeletedItemsStore();

    deletedStore.delete(finalItemId);
    if (id) deletedStore.delete(id);

    const customizationMeta: Partial<MenuItemWithDetails["metadata"]> = {};
    if (customizationEnabled !== undefined) {
      customizationMeta.customization_enabled = customizationEnabled;
    }
    if (customizationTitle !== undefined) {
      customizationMeta.customization_title = customizationTitle.trim();
    }
    if (customizationOptions !== undefined) {
      customizationMeta.customization_options = customizationOptions;
    }

    if (isEdit) {
      overridesStore[finalItemId] = {
        name: name.trim(),
        categoryId: resolvedCategoryId,
        pricePaise: amountPaise,
        description: description || "",
        imageUrl: initialImageUrl,
        status: itemStatus,
        metadata: {
          ...(overridesStore[finalItemId]?.metadata || {}),
          dietary: dietary || "veg",
          best_pairing: bestPairing !== undefined ? bestPairing.trim() : (overridesStore[finalItemId]?.metadata?.best_pairing || ""),
          availability: itemStatus === "SOLD_OUT" ? "SOLD_OUT" : "IN_STOCK",
          ...customizationMeta,
        },
      };

      if (id && id !== finalItemId) {
        overridesStore[id] = overridesStore[finalItemId];
      }

      const existingCustomIdx = customStore.findIndex((i) => i.id === finalItemId || (id && i.id === id));
      if (existingCustomIdx >= 0) {
        customStore[existingCustomIdx] = {
          ...customStore[existingCustomIdx],
          id: finalItemId,
          name: name.trim(),
          categoryId: resolvedCategoryId,
          pricePaise: amountPaise,
          description: description || "",
          imageUrl: initialImageUrl,
          status: itemStatus,
          metadata: {
            ...customStore[existingCustomIdx].metadata,
            dietary: dietary || "veg",
            best_pairing: bestPairing !== undefined ? bestPairing.trim() : (customStore[existingCustomIdx].metadata?.best_pairing || ""),
            availability: itemStatus === "SOLD_OUT" ? "SOLD_OUT" : "IN_STOCK",
            ...customizationMeta,
          },
        };
      }
    } else {
      const newItem: MenuItemWithDetails = {
        id: finalItemId,
        categoryId: resolvedCategoryId,
        name: name.trim(),
        status: itemStatus,
        description: description || "",
        pricePaise: amountPaise,
        imageUrl: initialImageUrl,
        metadata: {
          dietary: dietary || "veg",
          best_pairing: bestPairing?.trim() || "",
          availability: itemStatus === "SOLD_OUT" ? "SOLD_OUT" : "IN_STOCK",
          ...customizationMeta,
        },
      };
      customStore.push(newItem);
    }

    // Ensure kitchen stock store is 100% in sync immediately
    if (!globalThis.__SMOL_KITCHEN_MENU_STOCK__) {
      globalThis.__SMOL_KITCHEN_MENU_STOCK__ = {};
    }
    globalThis.__SMOL_KITCHEN_MENU_STOCK__[finalItemId] = {
      ...(globalThis.__SMOL_KITCHEN_MENU_STOCK__[finalItemId] || {}),
      stockStatus: itemStatus === "SOLD_OUT" ? "SOLD_OUT" : "IN_STOCK",
      chefNotes: description || "",
    };

    savePersistedMenuStore();
    void invalidateAdminOverviewCache();

    // Persist to Supabase PostgreSQL & Storage in parallel/background without blocking the UI response
    void (async () => {
      try {
        const finalImageUrl =
          initialImageUrl && initialImageUrl.startsWith("data:image")
            ? await uploadBase64ToStorage(initialImageUrl, finalItemId)
            : initialImageUrl;

        if (finalImageUrl !== initialImageUrl) {
          if (overridesStore[finalItemId]) {
            overridesStore[finalItemId].imageUrl = finalImageUrl;
          }
          const cIdx = customStore.findIndex((i) => i.id === finalItemId);
          if (cIdx >= 0) {
            customStore[cIdx].imageUrl = finalImageUrl;
          }
          savePersistedMenuStore();
        }

        const dbItemId = isUuid(finalItemId) ? finalItemId : undefined;
        if (!dbItemId) return;

        const dbMetadata = {
          dietary: dietary || "veg",
          best_pairing: bestPairing?.trim() || "",
          ...customizationMeta,
        };

        await Promise.all([
          supabase.from("menu_items").upsert({
            id: dbItemId,
            category_id: resolvedCategoryId,
            name: name.trim(),
            status: itemStatus,
            updated_at: new Date().toISOString(),
            metadata: dbMetadata,
          }),
          supabase.from("menu_prices").upsert({
            menu_item_id: dbItemId,
            amount_paise: amountPaise,
            currency: "INR",
            effective_from: new Date().toISOString(),
          }),
          supabase.from("menu_item_versions").upsert({
            menu_item_id: dbItemId,
            description: description || "",
            image_url: finalImageUrl || null,
            metadata: dbMetadata,
          }),
        ]);
        invalidateMenuCatalogCache();
      } catch (pgErr) {
        console.warn("Notice updating Supabase menu tables:", pgErr);
      }
    })();

    void broadcastSyncEvent({
      type: "ITEM_AVAILABILITY_CHANGED",
      itemId: finalItemId,
      stockStatus: itemStatus === "SOLD_OUT" ? "SOLD_OUT" : "IN_STOCK",
      availability: itemStatus === "SOLD_OUT" ? "SOLD_OUT" : "IN_STOCK",
      priceRupees,
      timestamp: Date.now(),
      metadata: {
        id: finalItemId,
        name: name.trim(),
        categoryId: resolvedCategoryId,
        priceRupees,
        description: description || "",
        dietary: dietary || "veg",
        best_pairing: bestPairing?.trim() || "",
        status: itemStatus,
        stockStatus: itemStatus === "SOLD_OUT" ? "SOLD_OUT" : "IN_STOCK",
        imageUrl: initialImageUrl,
        ...customizationMeta,
      },
    });

    try {
      revalidateTag("menu-catalog");
    } catch {}

    return {
      success: true,
      message: isEdit ? `Dish "${name.trim()}" updated successfully.` : `Dish "${name.trim()}" created and added to menu.`,
      itemId: finalItemId,
      imageUrl: initialImageUrl,
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
 * Delete / Archive a Menu Item permanently (Instant return)
 */
export async function deleteMenuItemAction(
  itemId: string
): Promise<{ success: boolean; message: string }> {
  const auth = await requireStaffAuth(["admin", "super_admin"]);
  if (!auth.authorized) {
    return { success: false, message: auth.message || "Unauthorized." };
  }

  try {
    const deletedStore = getDeletedItemsStore();
    deletedStore.add(itemId);

    const customStore = getCustomItemsStore();
    const idx = customStore.findIndex((i) => i.id === itemId);
    let deletedItemName = "";
    if (idx >= 0) {
      deletedItemName = customStore[idx].name;
      customStore.splice(idx, 1);
    }

    // Save deletion to disk & invalidate memory cache immediately
    savePersistedMenuStore();
    void invalidateAdminOverviewCache();

    // Mark archived in Supabase PostgreSQL in background
    void (async () => {
      try {
        const supabase = createAdminClient();
        if (isUuid(itemId)) {
          await supabase
            .from("menu_items")
            .update({ status: "ARCHIVED", updated_at: new Date().toISOString() })
            .eq("id", itemId);
        } else if (deletedItemName) {
          await supabase
            .from("menu_items")
            .update({ status: "ARCHIVED", updated_at: new Date().toISOString() })
            .ilike("name", deletedItemName);
        }
        invalidateMenuCatalogCache();
      } catch (dbErr) {
        console.warn("Notice updating Supabase archive status:", dbErr);
      }
    })();

    void broadcastSyncEvent({
      type: "ITEM_AVAILABILITY_CHANGED",
      itemId,
      stockStatus: "ARCHIVED",
      availability: "ARCHIVED",
      timestamp: Date.now(),
      metadata: {
        id: itemId,
        status: "ARCHIVED",
        deleted: true,
      },
    });

    try {
      revalidateTag("menu-catalog");
    } catch {}

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
 * Clear Entire Menu Catalog (Archive all active items & reset custom store)
 */
export async function clearAllMenuItemsAction(): Promise<{ success: boolean; message: string }> {
  const auth = await requireStaffAuth(["admin", "super_admin"]);
  if (!auth.authorized) {
    return { success: false, message: auth.message || "Unauthorized." };
  }

  try {
    // 1. Clear local custom items & overrides immediately
    const customStore = getCustomItemsStore();
    customStore.length = 0;

    const overridesStore = getMenuOverridesStore();
    Object.keys(overridesStore).forEach((key) => delete overridesStore[key]);

    // 2. Mark all default mock IDs and current cached IDs as deleted in deletedStore
    const deletedStore = getDeletedItemsStore();
    for (let i = 1; i <= 66; i++) {
      deletedStore.add(`item_${i.toString().padStart(2, "0")}`);
      deletedStore.add(`item_${i}`);
    }
    MOCK_MENU_ITEMS.forEach((it) => deletedStore.add(it.id));
    if (globalThis.__SMOL_MENU_CATALOG_CACHE__) {
      globalThis.__SMOL_MENU_CATALOG_CACHE__.allCategories.forEach((cat) =>
        cat.items.forEach((it) => deletedStore.add(it.id))
      );
    }

    savePersistedMenuStore();
    void invalidateAdminOverviewCache();

    // 3. Archive all active items in Supabase in background
    void (async () => {
      try {
        const supabase = createAdminClient();
        await supabase
          .from("menu_items")
          .update({ status: "ARCHIVED", updated_at: new Date().toISOString() })
          .neq("status", "ARCHIVED");
        invalidateMenuCatalogCache();
      } catch (dbErr) {
        console.warn("Notice archiving Supabase items:", dbErr);
      }
    })();

    void broadcastSyncEvent({
      type: "ITEM_AVAILABILITY_CHANGED",
      stockStatus: "ARCHIVED",
      availability: "ARCHIVED",
      timestamp: Date.now(),
      metadata: {
        clearedAll: true,
        status: "ARCHIVED",
      },
    });

    try {
      revalidateTag("menu-catalog");
    } catch {}

    return {
      success: true,
      message: "Entire menu cleared. You can now add your own fresh dishes.",
    };
  } catch (err: any) {
    console.error("clearAllMenuItemsAction error:", err);
    return {
      success: false,
      message: err?.message || "Failed to clear menu.",
    };
  }
}

/**
 * Restore Smol Café Master Menu (Batched Bulk Upserts instead of 190 sequential loops)
 */
export async function resetToMasterMenuAction(): Promise<{ success: boolean; message: string }> {
  const auth = await requireStaffAuth(["admin", "super_admin"]);
  if (!auth.authorized) {
    return { success: false, message: auth.message || "Unauthorized." };
  }

  try {
    // 1. Clear memory and disk stores immediately so getMenuCatalog returns master items right away
    const deletedStore = getDeletedItemsStore();
    deletedStore.clear();

    const customStore = getCustomItemsStore();
    customStore.length = 0;

    const overridesStore = getMenuOverridesStore();
    Object.keys(overridesStore).forEach((key) => delete overridesStore[key]);

    savePersistedMenuStore();
    void invalidateAdminOverviewCache();

    // 2. Sync Supabase in background using bulk array upserts (3 queries total instead of 190 serial queries)
    void (async () => {
      try {
        const supabase = createAdminClient();
        const nowIso = new Date().toISOString();

        await supabase
          .from("menu_items")
          .update({ status: "ARCHIVED", updated_at: nowIso })
          .neq("status", "ARCHIVED");

        await supabase.from("menu_categories").upsert(
          MOCK_CATEGORIES.map((cat) => ({
            id: cat.id,
            location_id: cat.location_id,
            name: cat.name,
            sort_order: cat.sort_order,
            updated_at: nowIso,
          }))
        );

        await supabase.from("menu_items").upsert(
          MOCK_MENU_ITEMS.map((item) => {
            const isDrink = [
              "Tea",
              "Coffee Classics",
              "Flavoured & Sweet Coffee",
              "Specialty Drinks & Refreshers",
            ].some((catName) => {
              const cat = MOCK_CATEGORIES.find((c) => c.id === item.category_id);
              return cat?.name === catName;
            });
            return {
              id: item.id,
              category_id: item.category_id,
              name: item.name,
              status: item.status || "AVAILABLE",
              metadata: item.metadata,
              station_id: isDrink ? "COLD_BAR" : "HOT_KITCHEN",
              base_prep_seconds: 300,
              updated_at: nowIso,
            };
          })
        );

        await Promise.all([
          supabase.from("menu_item_versions").upsert(
            MOCK_MENU_VERSIONS.map((ver) => ({
              id: ver.id,
              menu_item_id: ver.menu_item_id,
              description: ver.description,
              image_url: ver.image_url,
              metadata: ver.metadata,
            }))
          ),
          supabase.from("menu_prices").upsert(
            MOCK_MENU_PRICES.map((prc) => ({
              id: prc.id,
              menu_item_id: prc.menu_item_id,
              amount_paise: prc.amount_paise,
              currency: prc.currency || "INR",
              effective_from: prc.effective_from || nowIso,
              effective_to: null,
            }))
          ),
        ]);
        invalidateMenuCatalogCache();
      } catch (itemErr) {
        console.warn("Notice seeding Supabase master items:", itemErr);
      }
    })();

    // 3. Broadcast sync event across network
    void broadcastSyncEvent({
      type: "ITEM_AVAILABILITY_CHANGED",
      stockStatus: "AVAILABLE",
      availability: "AVAILABLE",
      timestamp: Date.now(),
      metadata: {
        restoredMaster: true,
        status: "AVAILABLE",
      },
    });

    try {
      revalidateTag("menu-catalog");
    } catch {}

    return {
      success: true,
      message: "Smol Café master menu restored successfully with official PDF items & prices.",
    };
  } catch (err: any) {
    console.error("resetToMasterMenuAction error:", err);
    return {
      success: false,
      message: err?.message || "Failed to restore master menu.",
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
