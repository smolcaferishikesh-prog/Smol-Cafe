"use client";

import React, { useState, useMemo } from "react";
import type { MenuItemWithDetails, CategoryWithItems } from "@/lib/queries/menu";
import { useCart } from "@/context/CartContext";
import { getFoodImage, SHOW_MENU_IMAGES } from "@/lib/food-images";
import { ChevronLeft, Heart, Plus, Check, Coffee } from "lucide-react";

interface ItemDetailModalProps {
  item: MenuItemWithDetails | null;
  categories?: CategoryWithItems[];
  onClose: () => void;
}

interface CustomOption {
  id: string;
  label: string;
  priceDelta: number;
}

/**
 * Locked Smol Café Brand Palette (from smol_cafe_brand_kit.pdf):
 * - café crème:    #F3E7D3 (Canvas / background)
 * - smol cherry:   #B72E35 (Iconic red / CTA / accents)
 * - butter taxi:   #F2C84B (Egg tag / yellow spark)
 * - espresso ink:  #241F1C (Headlines / body text / night background)
 * - biscuit:       #C9AE8B (Dividers / hairline borders / neutral accent)
 * - dusty pool:    #75AFA7 (Vegetarian tag / cool accent)
 * - walnut:        #725039 (Secondary copy / arch frame)
 */

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  categories = [],
  onClose,
}) => {
  const { addItem } = useCart();
  const [isFavorite, setIsFavorite] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [pairedAdded, setPairedAdded] = useState(false);
  const foodImageUrl = item ? getFoodImage(item.name, item.imageUrl) : "";
  const hasHeroImage = Boolean(SHOW_MENU_IMAGES && foodImageUrl && !imageError);

  // Determine beverage vs food for customization options
  const isBeverage = useMemo(() => {
    if (!item) return false;
    const name = item.name.toLowerCase();
    const sub = (item.metadata?.subcategory || "").toLowerCase();
    return (
      name.includes("coffee") ||
      name.includes("pour over") ||
      name.includes("latte") ||
      name.includes("cappuccino") ||
      name.includes("espresso") ||
      name.includes("chai") ||
      name.includes("brew") ||
      name.includes("tea") ||
      sub.includes("coffee") ||
      sub.includes("tea") ||
      sub.includes("brew")
    );
  }, [item]);

  // Dynamic customization groups
  const customizationTitle = isBeverage ? "Milk Preference" : "Bread & Style";
  const customOptions: CustomOption[] = useMemo(() => {
    if (isBeverage) {
      return [
        { id: "none", label: "None", priceDelta: 0 },
        { id: "dairy", label: "Dairy", priceDelta: 0 },
        { id: "oat", label: "Oat +₹30", priceDelta: 30 },
        { id: "almond", label: "Almond +₹30", priceDelta: 30 },
      ];
    }
    return [
      { id: "classic", label: "Classic", priceDelta: 0 },
      { id: "sourdough", label: "Sourdough +₹40", priceDelta: 40 },
      { id: "extra_cheese", label: "Extra Cheese +₹35", priceDelta: 35 },
      { id: "spicy_dip", label: "Spicy Dip +₹25", priceDelta: 25 },
    ];
  }, [isBeverage]);

  const [selectedOptionId, setSelectedOptionId] = useState<string>("none");

  // Lookup / resolve paired recommendation
  const pairedItemInfo = useMemo(() => {
    if (!item) return null;

    const allItems = categories.flatMap((c) => c.items);
    const pairingText = (item.metadata?.best_pairing || "").toLowerCase();

    // 1. Try to match from pairing metadata in catalog
    if (pairingText && pairingText.trim() !== "—") {
      const tokens = pairingText
        .split(/[\/,]/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      for (const token of tokens) {
        const match = allItems.find(
          (it) =>
            it.id !== item.id &&
            (it.name.toLowerCase().includes(token) || token.includes(it.name.toLowerCase()))
        );
        if (match) {
          return {
            item: match,
            name: match.name.replace(/^the\s+/i, ""),
            tagline: match.description || "Crispy, melty, wildly satisfying.",
            price: Math.round(match.pricePaise / 100),
            imageUrl: getFoodImage(match.name, match.imageUrl),
          };
        }
      }

      // If text exists but no exact catalog item matched, show clean custom paired badge
      return {
        item: null,
        name: item.metadata?.best_pairing?.replace(/^the\s+/i, "") || "Chef Recommendation",
        tagline: "Recommended pairing for this artisanal dish.",
        price: 180,
        imageUrl: getFoodImage(pairingText, null),
      };
    }

    // 2. Default pairing: if beverage -> pair with Triple Decker
    if (isBeverage) {
      const decker = allItems.find((it) =>
        it.name.toLowerCase().includes("triple decker")
      );
      if (decker) {
        return {
          item: decker,
          name: "Triple Decker",
          tagline: "Crispy, melty, wildly satisfying.",
          price: Math.round(decker.pricePaise / 100),
          imageUrl: getFoodImage("triple decker", decker.imageUrl),
        };
      }
      return {
        item: null,
        name: "Triple Decker",
        tagline: "Crispy, melty, wildly satisfying.",
        price: 220,
        imageUrl: getFoodImage("triple decker", null),
      };
    }

    // 3. If food -> pair with Chai or Tapovan Pour Over
    const chaiOrCoffee = allItems.find(
      (it) =>
        it.name.toLowerCase().includes("smol chai") ||
        it.name.toLowerCase().includes("pour over") ||
        it.name.toLowerCase().includes("cappuccino")
    );
    if (chaiOrCoffee) {
      return {
        item: chaiOrCoffee,
        name: chaiOrCoffee.name,
        tagline: chaiOrCoffee.description || "Freshly brewed in house with warming spices.",
        price: Math.round(chaiOrCoffee.pricePaise / 100),
        imageUrl: getFoodImage(chaiOrCoffee.name, chaiOrCoffee.imageUrl),
      };
    }

    return {
      item: null,
      name: "Tapovan Pour Over",
      tagline: "Single-origin South Indian estate beans.",
      price: 180,
      imageUrl: getFoodImage("tapovan pour over", null),
    };
  }, [item, categories, isBeverage]);

  if (!item) return null;

  const isItemSoldOut =
    item.status === "SOLD_OUT" ||
    (item.metadata as any)?.availability === "SOLD_OUT" ||
    (item.metadata as any)?.availability === "86";

  const basePriceRupees = Math.round(item.pricePaise / 100);
  const selectedOption = customOptions.find((o) => o.id === selectedOptionId);
  const optionDelta = selectedOption ? selectedOption.priceDelta : 0;
  const totalPriceRupees = basePriceRupees + optionDelta;

  const dietary = (item.metadata?.dietary || "").toLowerCase();
  const isNonVeg =
    dietary.includes("non-veg") ||
    dietary.includes("meat") ||
    dietary.includes("chicken") ||
    dietary.includes("fish");
  const isEgg =
    !isNonVeg &&
    (dietary.includes("egg") ||
      item.name.toLowerCase().includes("egg") ||
      item.name.toLowerCase().includes("omelette") ||
      (item.metadata?.core_ingredients || "").toLowerCase().includes("egg"));
  const isVegan = !isNonVeg && !isEgg && dietary.includes("vegan");
  const isVeg = !isNonVeg && !isEgg && !isVegan;

  // Determine tag badge
  let tagBadge = "SINGLE ORIGIN";
  if (item.name.toLowerCase().includes("pour over")) {
    tagBadge = "SINGLE ORIGIN";
  } else if (item.metadata?.subcategory) {
    tagBadge = item.metadata.subcategory.toUpperCase();
  } else if (
    item.metadata?.spice &&
    !["none", "no", "0", "n/a", "mild", "—", "-"].includes(item.metadata.spice.toLowerCase().trim())
  ) {
    tagBadge = `${item.metadata.spice.toUpperCase()} SPICE`;
  }

  const handleAddToCart = () => {
    // If an add-on was selected, bundle it with option details
    if (optionDelta > 0 && selectedOption) {
      const modifierLabel = selectedOption.label.replace(/\s*\+₹\d+.*$/, "").trim();
      const modifiedItem: MenuItemWithDetails = {
        ...item,
        id: `${item.id}-${selectedOption.id}`,
        name: `${item.name} (${modifierLabel})`,
        pricePaise: item.pricePaise + optionDelta * 100,
      };
      addItem(modifiedItem, 1);
    } else {
      addItem(item, 1);
    }
    onClose();
  };

  const handleQuickAddPaired = () => {
    if (!pairedItemInfo) return;
    if (pairedItemInfo.item) {
      addItem(pairedItemInfo.item, 1);
    } else {
      // Fallback synthetic item if not in database
      const fallbackItem: MenuItemWithDetails = {
        id: `paired_${pairedItemInfo.name.toLowerCase().replace(/\s+/g, "_")}`,
        categoryId: item.categoryId,
        name: pairedItemInfo.name,
        status: "ACTIVE",
        description: pairedItemInfo.tagline,
        pricePaise: pairedItemInfo.price * 100,
        imageUrl: pairedItemInfo.imageUrl,
        metadata: { dietary: "Vegetarian" },
      };
      addItem(fallbackItem, 1);
    }
    setPairedAdded(true);
    setTimeout(() => setPairedAdded(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-[#241F1C]/70 sm:p-4 backdrop-blur-xs transition-opacity duration-200"
      onClick={onClose}
    >
      {/* Modal Container: Canvas set to Café Crème (#F3E7D3), with dark mode Espresso Ink (#241F1C) */}
      <div
        className="relative flex h-[92vh] sm:h-[88vh] w-full max-w-lg sm:max-w-[425px] flex-col rounded-t-[2.5rem] sm:rounded-[2.5rem] border border-[#C9AE8B]/60 bg-[#F3E7D3] dark:bg-[#241F1C] text-[#241F1C] dark:text-[#F3E7D3] shadow-2xl overflow-hidden animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar Navigation: sticky at top */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-5 pt-4 pb-2 bg-[#F3E7D3]/95 dark:bg-[#241F1C]/95 backdrop-blur-xs border-b border-[#C9AE8B]/20">
          <button
            onClick={onClose}
            aria-label="Go back to menu"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#241F1C] dark:text-[#F3E7D3] hover:bg-[#EAE0D2] active:scale-95 transition"
          >
            <ChevronLeft className="h-6 w-6 stroke-[2]" />
          </button>

          <button
            onClick={() => setIsFavorite(!isFavorite)}
            aria-label="Toggle favorite"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#241F1C] dark:text-[#F3E7D3] hover:bg-[#EAE0D2] active:scale-90 transition"
          >
            <Heart
              className={`h-6 w-6 stroke-[1.8] transition-colors ${
                isFavorite
                  ? "fill-[#B72E35] text-[#B72E35]"
                  : "text-[#241F1C] dark:text-[#F3E7D3]"
              }`}
            />
          </button>
        </div>

        {/* Scrollable Content with generous bottom padding (pb-32) so all options scroll cleanly above the sticky button */}
        <div className="flex-1 overflow-y-auto px-5 pt-2 pb-32">
          {/* Optional: Arched Window Food Image Hero (Rendered only when SHOW_MENU_IMAGES is enabled) */}
          {hasHeroImage && (
            <div className="flex justify-center pt-1 pb-3">
              <div className="relative w-full max-w-[310px] aspect-[4/4.3] rounded-t-[7.5rem] p-1 border-[1.5px] border-[#725039]/40 dark:border-[#C9AE8B]/40 bg-[#FAF4EB] dark:bg-[#1E1916] shadow-sm overflow-hidden">
                <div className="h-full w-full overflow-hidden rounded-t-[7.2rem] bg-[#EAE0D2] dark:bg-[#2A231E]">
                  <img
                    src={foodImageUrl}
                    alt={item.name}
                    onError={() => setImageError(true)}
                    className={`h-full w-full object-cover transition-transform duration-500 hover:scale-105 ${
                      isItemSoldOut ? "grayscale contrast-125 brightness-95" : ""
                    }`}
                  />
                </div>

                {/* Iconic Diagonal Red Stamped "SOLD OUT" Badge on Modal Hero */}
                {isItemSoldOut && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <div className="relative rounded-md border-[2.5px] border-[#C22828] bg-[#C22828] px-5 py-2 shadow-2xl transform -rotate-12">
                      <div className="absolute inset-[2px] rounded-[3px] border border-dashed border-white/60 pointer-events-none" />
                      <span className="relative z-10 font-mono text-base sm:text-lg font-black tracking-widest text-white uppercase drop-shadow-md">
                        SOLD OUT
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Title and Price Header */}
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <h1 className="font-serif text-[28px] sm:text-[30px] font-normal leading-tight text-[#241F1C] dark:text-[#F3E7D3] capitalize">
              {item.name}
            </h1>
            <span className={`font-serif text-[26px] sm:text-[28px] font-normal shrink-0 ${
              isItemSoldOut ? "text-stone-400 dark:text-stone-500 line-through" : "text-[#241F1C] dark:text-[#F3E7D3]"
            }`}>
              ₹{basePriceRupees}
            </span>
          </div>

          {/* Editorial Description: Walnut (#725039) on Crème */}
          <p className="mt-1.5 font-sans sm:font-serif text-[13.5px] leading-relaxed text-[#725039] dark:text-[#C9AE8B]">
            {item.description ||
              "Single-origin South Indian estate beans, light floral notes with a clean finish."}
          </p>

          {/* Badges: Dietary & Origin */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {isNonVeg ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-[10.5px] font-bold tracking-wider text-rose-800 dark:text-rose-300 uppercase font-sans">
                <span className="h-1.5 w-1.5 rounded-full bg-[#E11D48]" />
                Non-Vegetarian
              </span>
            ) : isEgg ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 text-[10.5px] font-bold tracking-wider text-amber-800 dark:text-amber-300 uppercase font-sans">
                <span className="h-1.5 w-1.5 rounded-full bg-[#EAB308]" />
                Contains Egg
              </span>
            ) : isVegan ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-300 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 text-[10.5px] font-bold tracking-wider text-emerald-800 dark:text-emerald-300 uppercase font-sans">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                Vegan
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-300 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 text-[10.5px] font-bold tracking-wider text-emerald-800 dark:text-emerald-300 uppercase font-sans">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                Vegetarian
              </span>
            )}
            {tagBadge && (
              <span className="px-3 py-1 rounded-full border border-[#C9AE8B]/60 bg-[#FAF4EB] dark:bg-[#2A231E] text-[10px] font-semibold tracking-wider text-[#241F1C] dark:text-[#F3E7D3] uppercase font-sans">
                {tagBadge}
              </span>
            )}
          </div>

          {/* Decorative Floral / Star Divider: Biscuit (#C9AE8B) */}
          <div className="my-4 flex items-center justify-center opacity-70">
            <div className="h-[0.5px] flex-1 bg-[#C9AE8B]" />
            <span className="px-3 text-[11px] text-[#C9AE8B] font-serif">❖</span>
            <div className="h-[0.5px] flex-1 bg-[#C9AE8B]" />
          </div>

          {/* Pairs Beautifully With Card */}
          {pairedItemInfo && (
            <div>
              <div className="rounded-2xl border border-[#C9AE8B]/60 bg-[#FAF4EB] dark:bg-[#2A231E] p-3.5 shadow-xs">
                <h3 className="font-serif text-sm sm:text-base font-semibold text-[#241F1C] dark:text-[#F3E7D3] mb-2.5">
                  Pairs beautifully with
                </h3>
                <div className="flex items-center justify-between gap-3">
                  {/* Paired Item Thumbnail (Optional: rendered only when SHOW_MENU_IMAGES is enabled) */}
                  {SHOW_MENU_IMAGES && pairedItemInfo.imageUrl && (
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-[#C9AE8B]/50 bg-[#EAE0D2]">
                      <img
                        src={pairedItemInfo.imageUrl}
                        alt={pairedItemInfo.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}

                  {/* Title & Subtitle */}
                  <div className="flex-1 min-w-0 pr-1">
                    <h4 className="font-serif text-sm font-semibold text-[#241F1C] dark:text-[#F3E7D3] truncate">
                      {pairedItemInfo.name}
                    </h4>
                    <p className="text-xs text-[#725039] dark:text-[#C9AE8B] font-sans truncate">
                      {pairedItemInfo.tagline}
                    </p>
                  </div>

                  {/* Price & Quick Add (+) Button */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="font-serif text-sm font-semibold text-[#241F1C] dark:text-[#F3E7D3]">
                      ₹{pairedItemInfo.price}
                    </span>
                    <button
                      type="button"
                      onClick={handleQuickAddPaired}
                      aria-label={`Add ${pairedItemInfo.name} to order`}
                      className={`h-8 w-8 rounded-full border border-[#241F1C]/40 flex items-center justify-center transition active:scale-90 ${
                        pairedAdded
                          ? "bg-emerald-700 border-emerald-700 text-white shadow-xs"
                          : "text-[#241F1C] dark:text-[#F3E7D3] hover:bg-[#B72E35] hover:text-white hover:border-[#B72E35]"
                      }`}
                    >
                      {pairedAdded ? (
                        <Check className="h-4 w-4 stroke-[2.5]" />
                      ) : (
                        <Plus className="h-4 w-4 stroke-[2]" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Decorative Floral / Star Divider: Biscuit (#C9AE8B) */}
          <div className="my-4 flex items-center justify-center opacity-70">
            <div className="h-[0.5px] flex-1 bg-[#C9AE8B]" />
            <span className="px-3 text-[11px] text-[#C9AE8B] font-serif">❖</span>
            <div className="h-[0.5px] flex-1 bg-[#C9AE8B]" />
          </div>

          {/* Customization Options (e.g. Milk Preference / Bread & Style) */}
          <div className="mb-6">
            <h3 className="font-serif text-sm sm:text-base font-semibold text-[#241F1C] dark:text-[#F3E7D3] mb-2.5">
              {customizationTitle}
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {customOptions.map((opt) => {
                const isSelected = selectedOptionId === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedOptionId(opt.id)}
                    className={`py-2 px-1 rounded-2xl text-xs sm:text-[13px] font-serif transition text-center active:scale-95 ${
                      isSelected
                        ? "bg-[#B72E35] text-[#F3E7D3] border border-[#B72E35] shadow-xs font-semibold"
                        : "bg-[#FAF4EB] dark:bg-[#2A231E] text-[#241F1C] dark:text-[#F3E7D3] border border-[#C9AE8B]/70 hover:border-[#725039]"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Floating / Sticky Bottom Action Button: Liquid Ruby Glass (Light) / Amethyst Purple Glass (Dark) */}
        <div className="absolute bottom-0 left-0 right-0 z-30 px-5 pt-3 pb-7 sm:pb-8 bg-gradient-to-t from-[#F3E7D3] via-[#F3E7D3]/98 to-transparent dark:from-[#241F1C] dark:via-[#241F1C]/98">
          {(() => {
            const isSoldOut = isItemSoldOut;

            return (
              <button
                type="button"
                disabled={isSoldOut}
                onClick={handleAddToCart}
                className={`group relative overflow-hidden w-full min-h-[54px] sm:min-h-[58px] py-4 px-6 rounded-full font-serif text-lg tracking-wide flex items-center justify-center gap-4 transition-all duration-300 active:scale-[0.98] cursor-pointer ${
                  isSoldOut
                    ? "bg-stone-300 dark:bg-stone-800 text-stone-500 cursor-not-allowed"
                    : "bg-gradient-to-b from-[#E03A43]/70 via-[#B72E35]/80 to-[#7D1217]/90 dark:from-[#A855F7]/70 dark:via-[#7E22CE]/80 dark:to-[#4C1D95]/90 text-white backdrop-blur-[16px] border border-white/55 dark:border-purple-300/40 shadow-[0_8px_26px_rgba(183,46,53,0.42),inset_0_1.5px_1.5px_rgba(255,255,255,0.85),inset_0_-1.5px_2px_rgba(0,0,0,0.4),inset_0_0_14px_rgba(255,140,140,0.35)] dark:shadow-[0_8px_28px_rgba(126,34,206,0.5),inset_0_1.5px_1.5px_rgba(255,255,255,0.85),inset_0_-1.5px_2px_rgba(0,0,0,0.5),inset_0_0_16px_rgba(192,132,252,0.45)]"
                }`}
              >
                {/* Curved Specular Glass Gloss Reflection */}
                {!isSoldOut && (
                  <span className="absolute inset-x-4 top-1 h-[42%] rounded-full bg-gradient-to-b from-white/50 via-white/15 to-transparent pointer-events-none opacity-90" />
                )}

                {isSoldOut ? (
                  <span className="relative z-10 font-bold">86 / Sold Out Today</span>
                ) : (
                  <div className="relative z-10 flex items-center gap-4 drop-shadow-[0_1.5px_2.5px_rgba(0,0,0,0.35)]">
                    <span className="font-semibold text-lg sm:text-xl">Add to Table</span>
                    <span className="opacity-50 font-light text-base">|</span>
                    <span className="font-mono font-bold text-lg sm:text-xl">₹{totalPriceRupees}</span>
                  </div>
                )}
              </button>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
