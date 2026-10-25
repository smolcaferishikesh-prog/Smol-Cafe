"use server";

import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath, revalidateTag } from "next/cache";
import { broadcastSyncEvent } from "@/lib/sync-events";
import { invalidateAdminOverviewCache } from "@/app/admin/actions";
import {
  getMenuCatalog,
  getCustomItemsStore,
  getMenuOverridesStore,
  getDeletedItemsStore,
  savePersistedMenuStore,
  type MenuItemWithDetails,
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
 * Add or Edit a Menu Item with real-time propagation to Customer Menu & KDS
 */
/**
 * Add or Edit a Menu Item with real-time propagation to Customer Menu & KDS
 */
export async function saveMenuItemAction(
  payload: SaveMenuItemPayload
): Promise<{ success: boolean; message: string; itemId: string; imageUrl?: string | null }> {
  try {
    const { id, name, categoryId, priceRupees, description, imageUrl, dietary, bestPairing, status } = payload;
    const isEdit = !!id;
    const amountPaise = Math.round(priceRupees * 100);
    const itemStatus = status || "AVAILABLE";

    const supabase = createAdminClient();

    // Resolve categoryId to a valid category UUID if needed
    let resolvedCategoryId = categoryId;
    if (!isUuid(resolvedCategoryId)) {
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
      } catch {
        // keep as is
      }
    }

    // Determine final UUID for database persistence
    let finalItemId = id && isUuid(id) ? id : "";
    if (!finalItemId) {
      if (isEdit && id) {
        // Try looking up in Supabase by name if legacy ID was provided
        try {
          const { data: existingDbItem } = await supabase
            .from("menu_items")
            .select("id")
            .ilike("name", name.trim())
            .maybeSingle();
          if (existingDbItem?.id) {
            finalItemId = existingDbItem.id;
          }
        } catch {}
      }
      if (!finalItemId) {
        finalItemId = crypto.randomUUID();
      }
    }

    // Auto-upload base64 to Supabase Storage if present
    const finalImageUrl = imageUrl ? await uploadBase64ToStorage(imageUrl, finalItemId) : null;

    const customStore = getCustomItemsStore();
    const overridesStore = getMenuOverridesStore();
    const deletedStore = getDeletedItemsStore();

    // Ensure it's not marked deleted (both finalItemId and legacy id if provided)
    deletedStore.delete(finalItemId);
    if (id) deletedStore.delete(id);

    if (isEdit) {
      overridesStore[finalItemId] = {
        name: name.trim(),
        categoryId: resolvedCategoryId,
        pricePaise: amountPaise,
        description: description || "",
        imageUrl: finalImageUrl,
        status: itemStatus,
        metadata: {
          ...(overridesStore[finalItemId]?.metadata || {}),
          dietary: dietary || "veg",
          best_pairing: bestPairing !== undefined ? bestPairing.trim() : (overridesStore[finalItemId]?.metadata?.best_pairing || ""),
          availability: itemStatus === "SOLD_OUT" ? "SOLD_OUT" : "IN_STOCK",
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
      const newItem: MenuItemWithDetails = {
        id: finalItemId,
        categoryId: resolvedCategoryId,
        name: name.trim(),
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

    savePersistedMenuStore();

    // Persist to Supabase PostgreSQL
    try {
      if (isEdit && isUuid(finalItemId)) {
        await Promise.all([
          supabase
            .from("menu_items")
            .update({
              name: name.trim(),
              category_id: resolvedCategoryId,
              status: itemStatus,
              updated_at: new Date().toISOString(),
              metadata: {
                dietary: dietary || "veg",
                best_pairing: bestPairing?.trim() || "",
              },
            })
            .eq("id", finalItemId),
          supabase
            .from("menu_prices")
            .upsert({
              menu_item_id: finalItemId,
              amount_paise: amountPaise,
              currency: "INR",
              effective_from: new Date().toISOString(),
            }),
          supabase
            .from("menu_item_versions")
            .insert({
              menu_item_id: finalItemId,
              description: description || "",
              image_url: finalImageUrl || null,
              metadata: {
                dietary: dietary || "veg",
                best_pairing: bestPairing?.trim() || "",
              },
            }),
        ]);
      } else {
        const itemRes = await supabase
          .from("menu_items")
          .insert({
            id: finalItemId,
            category_id: resolvedCategoryId,
            name: name.trim(),
            status: itemStatus,
            metadata: {
              dietary: dietary || "veg",
              best_pairing: bestPairing?.trim() || "",
            },
          });

        if (!itemRes.error) {
          await Promise.all([
            supabase
              .from("menu_prices")
              .insert({
                menu_item_id: finalItemId,
                amount_paise: amountPaise,
                currency: "INR",
                effective_from: new Date().toISOString(),
              }),
            supabase
              .from("menu_item_versions")
              .insert({
                menu_item_id: finalItemId,
                description: description || "",
                image_url: finalImageUrl || null,
                metadata: {
                  dietary: dietary || "veg",
                  best_pairing: bestPairing?.trim() || "",
                },
              }),
          ]);
        }
      }
    } catch (pgErr) {
      console.warn("Notice updating Supabase menu tables:", pgErr);
    }

    // Ensure kitchen stock store is 100% in sync
    if (!globalThis.__SMOL_KITCHEN_MENU_STOCK__) {
      globalThis.__SMOL_KITCHEN_MENU_STOCK__ = {};
    }
    globalThis.__SMOL_KITCHEN_MENU_STOCK__[finalItemId] = {
      ...(globalThis.__SMOL_KITCHEN_MENU_STOCK__[finalItemId] || {}),
      stockStatus: itemStatus === "SOLD_OUT" ? "SOLD_OUT" : "IN_STOCK",
      chefNotes: description || "",
    };

    broadcastSyncEvent({
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
        imageUrl: finalImageUrl,
      },
    });

    try {
      revalidateTag("menu-catalog");
      revalidatePath("/");
      revalidatePath("/admin/menu");
      revalidatePath("/menu");
    } catch {
      // ignore
    }

    invalidateAdminOverviewCache();

    return {
      success: true,
      message: isEdit ? `Dish "${name.trim()}" updated successfully.` : `Dish "${name.trim()}" created and added to menu.`,
      itemId: finalItemId,
      imageUrl: finalImageUrl,
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
 * Delete / Archive a Menu Item permanently
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
    let deletedItemName = "";
    if (idx >= 0) {
      deletedItemName = customStore[idx].name;
      customStore.splice(idx, 1);
    }

    // Save deletion to disk immediately
    savePersistedMenuStore();

    // Mark archived in Supabase PostgreSQL
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
    } catch (dbErr) {
      console.warn("Notice updating Supabase archive status:", dbErr);
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
        deleted: true,
      },
    });

    try {
      revalidateTag("menu-catalog");
      revalidatePath("/");
      revalidatePath("/admin/menu");
      revalidatePath("/menu");
    } catch {
      // ignore
    }

    invalidateAdminOverviewCache();

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
  try {
    const supabase = createAdminClient();

    // 1. Archive all active items in Supabase
    try {
      await supabase
        .from("menu_items")
        .update({ status: "ARCHIVED", updated_at: new Date().toISOString() })
        .neq("status", "ARCHIVED");
    } catch (dbErr) {
      console.warn("Notice archiving Supabase items:", dbErr);
    }

    // 2. Clear local custom items & overrides
    const customStore = getCustomItemsStore();
    customStore.length = 0;

    const overridesStore = getMenuOverridesStore();
    Object.keys(overridesStore).forEach((key) => delete overridesStore[key]);

    // 3. Mark all 66 default mock IDs as deleted in deletedStore
    const deletedStore = getDeletedItemsStore();
    for (let i = 1; i <= 66; i++) {
      deletedStore.add(`item_${i.toString().padStart(2, "0")}`);
      deletedStore.add(`item_${i}`);
    }

    // Save to disk
    savePersistedMenuStore();

    broadcastSyncEvent({
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
      revalidatePath("/");
      revalidatePath("/admin/menu");
      revalidatePath("/menu");
    } catch {}

    invalidateAdminOverviewCache();

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
 * Restore Smol Café Master Menu
 */
export async function resetToMasterMenuAction(): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = createAdminClient();

    // 1. Mark existing Supabase items as ARCHIVED so previous non-master items are deactivated
    try {
      await supabase
        .from("menu_items")
        .update({ status: "ARCHIVED", updated_at: new Date().toISOString() })
        .neq("status", "ARCHIVED");
    } catch (dbErr) {
      console.warn("Notice archiving existing Supabase items:", dbErr);
    }

    // 2. Upsert the 10 official categories
    try {
      for (const cat of MOCK_CATEGORIES) {
        await supabase.from("menu_categories").upsert({
          id: cat.id,
          location_id: cat.location_id,
          name: cat.name,
          sort_order: cat.sort_order,
          updated_at: new Date().toISOString(),
        });
      }

      // Clean up any extra categories not in the official 10
      const officialCatIds = MOCK_CATEGORIES.map((c) => c.id);
      const { data: allCats } = await supabase.from("menu_categories").select("id");
      if (allCats) {
        const extraCats = allCats.filter((c) => !officialCatIds.includes(c.id));
        for (const ec of extraCats) {
          try {
            await supabase.from("menu_categories").delete().eq("id", ec.id);
          } catch {}
        }
      }
    } catch (catErr) {
      console.warn("Notice syncing categories:", catErr);
    }

    // 3. Upsert official menu items into Supabase
    try {
      for (const item of MOCK_MENU_ITEMS) {
        const isDrink = [
          "Tea",
          "Coffee Classics",
          "Flavoured & Sweet Coffee",
          "Specialty Drinks & Refreshers",
        ].some((catName) => {
          const cat = MOCK_CATEGORIES.find((c) => c.id === item.category_id);
          return cat?.name === catName;
        });

        await supabase.from("menu_items").upsert({
          id: item.id,
          category_id: item.category_id,
          name: item.name,
          status: item.status || "AVAILABLE",
          metadata: item.metadata,
          station_id: isDrink ? "COLD_BAR" : "HOT_KITCHEN",
          base_prep_seconds: 300,
          updated_at: new Date().toISOString(),
        });
      }

      // Upsert versions and prices
      for (const ver of MOCK_MENU_VERSIONS) {
        await supabase.from("menu_item_versions").upsert({
          id: ver.id,
          menu_item_id: ver.menu_item_id,
          description: ver.description,
          image_url: ver.image_url,
          metadata: ver.metadata,
        });
      }

      for (const prc of MOCK_MENU_PRICES) {
        await supabase.from("menu_prices").upsert({
          id: prc.id,
          menu_item_id: prc.menu_item_id,
          amount_paise: prc.amount_paise,
          currency: prc.currency || "INR",
          effective_from: prc.effective_from || new Date().toISOString(),
          effective_to: null,
        });
      }
    } catch (itemErr) {
      console.warn("Notice seeding Supabase master items:", itemErr);
    }

    // 4. Clear memory and disk stores (custom items, overrides, deleted items)
    const deletedStore = getDeletedItemsStore();
    deletedStore.clear();

    const customStore = getCustomItemsStore();
    customStore.length = 0;

    const overridesStore = getMenuOverridesStore();
    Object.keys(overridesStore).forEach((key) => delete overridesStore[key]);

    // Save empty stores to disk
    savePersistedMenuStore();

    // 5. Broadcast sync event across network
    broadcastSyncEvent({
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
      revalidatePath("/");
      revalidatePath("/admin/menu");
      revalidatePath("/menu");
      revalidatePath("/drinks");
      revalidatePath("/smol-menu");
    } catch {}

    invalidateAdminOverviewCache();

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
