import React, { useState } from "react";
import type { MenuItemWithDetails } from "@/lib/queries/menu";
import { getFoodImage, SHOW_MENU_IMAGES } from "@/lib/food-images";
import { Coffee, Flame, Sparkles, Plus, Minus } from "lucide-react";
import { useCart } from "@/context/CartContext";

interface MenuItemCardProps {
  item: MenuItemWithDetails;
  onOpenDetail: (item: MenuItemWithDetails) => void;
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({ item, onOpenDetail }) => {
  const { items: cartItems, addItem, updateQty } = useCart();
  const cartItem = cartItems.find((ci) => ci.item.id === item.id);
  const quantity = cartItem?.qty || 0;

  const [imageError, setImageError] = useState(false);
  const priceRupees = Math.round(item.pricePaise / 100);
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
  const isVegan = dietary.includes("vegan");
  const isVeg = !isNonVeg && !isEgg && !isVegan;
  const rawSpice = (item.metadata?.spice || "").trim();
  const spiceLower = rawSpice.toLowerCase();
  const isMeaningfulSpice = Boolean(
    rawSpice &&
    spiceLower !== "none" &&
    spiceLower !== "no" &&
    spiceLower !== "0" &&
    spiceLower !== "not spicy" &&
    spiceLower !== "n/a" &&
    spiceLower !== "mild" &&
    spiceLower !== "—" &&
    spiceLower !== "-"
  );
  const pairing = item.metadata?.best_pairing || "";
  const foodImageUrl = getFoodImage(item.name, item.imageUrl);
  const hasImage = Boolean(SHOW_MENU_IMAGES && foodImageUrl && !imageError);
  const isSoldOut =
    item.status === "SOLD_OUT" ||
    (item.metadata as any)?.availability === "SOLD_OUT" ||
    (item.metadata as any)?.availability === "86";
  const isLowStock =
    item.status === "LOW_STOCK" || (item.metadata as any)?.availability === "LOW_STOCK";
  const lowStockCount = (item.metadata as any)?.low_stock_portions;
  const isChefSpecial = (item.metadata as any)?.chef_special;
  const chefNotes = (item.metadata as any)?.customer_note || (item.metadata as any)?.chef_note;

  return (
    <div
      onClick={() => onOpenDetail(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetail(item);
        }
      }}
      className={`group relative flex items-start justify-between gap-3.5 rounded-2xl border p-3.5 text-left shadow-xs transition duration-200 hover-lift hover:shadow-md cursor-pointer animate-fade-in-up overflow-hidden ${
        isSoldOut
          ? "border-stone-300 dark:border-stone-800 bg-[#FAF4EB]/80 dark:bg-[#1A1614] opacity-90"
          : "border-[#C9AE8B]/50 dark:border-white/10 bg-[#FAF4EB] dark:bg-[#201A17] hover:border-[#B72E35]/60 dark:hover:border-purple-500/50 active:scale-[0.98]"
      }`}
    >
      {/* Optional: Arched Food Image (Rendered only when SHOW_MENU_IMAGES is enabled) */}
      {hasImage && (
        <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-t-full rounded-b-xl border border-[#C9AE8B]/40 dark:border-white/10 bg-[#EFE7DC] dark:bg-[#171311] shadow-inner">
          <img
            src={foodImageUrl}
            alt={item.name}
            loading="lazy"
            onError={() => setImageError(true)}
            className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-110 ${
              isSoldOut ? "grayscale contrast-125 brightness-95" : ""
            }`}
          />
        </div>
      )}

      {/* Details */}
      <div className="flex-1 min-w-0 pr-2">
        {/* Title & Dietary Badge */}
        <div className="flex items-center gap-2 flex-wrap">
          {isEgg ? (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-amber-400/80 dark:border-amber-600/60 bg-amber-100/70 dark:bg-amber-950/60 px-1.5 py-0.5 text-[9.5px] font-bold text-amber-900 dark:text-amber-200 shrink-0"
              title="Contains Egg"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#EAB308]" />
              Egg
            </span>
          ) : isNonVeg ? (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-rose-400/80 dark:border-rose-600/60 bg-rose-100/70 dark:bg-rose-950/60 px-1.5 py-0.5 text-[9.5px] font-bold text-rose-900 dark:text-rose-200 shrink-0"
              title="Non-Vegetarian"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#E11D48]" />
              Non-Veg
            </span>
          ) : isVegan ? (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-emerald-400/80 dark:border-emerald-600/60 bg-emerald-100/70 dark:bg-emerald-950/60 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-900 dark:text-emerald-200 shrink-0"
              title="Vegan"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
              Vegan
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-emerald-400/80 dark:border-emerald-600/60 bg-emerald-100/70 dark:bg-emerald-950/60 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-900 dark:text-emerald-200 shrink-0"
              title="Vegetarian"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
              Veg
            </span>
          )}

          <h3 className={`text-[17px] sm:text-[18px] font-bold tracking-tight leading-snug transition-colors capitalize ${
            isSoldOut
              ? "text-stone-600 dark:text-stone-400"
              : "text-[#1C1917] dark:text-[#FAF4EB] group-hover:text-[#B72E35] dark:group-hover:text-purple-400"
          }`}>
            {item.name}
          </h3>
        </div>

        {/* Live Status & Chef Badges */}
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          {isLowStock && !isSoldOut && (
            <span className="rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 px-1.5 py-0.5 text-[9.5px] font-mono font-bold">
              Only {lowStockCount || 3} left
            </span>
          )}
          {isChefSpecial && (
            <span className="flex items-center gap-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-900 dark:text-purple-300 border border-purple-300 dark:border-purple-800 px-1.5 py-0.5 text-[9.5px] font-mono font-bold">
              <Sparkles className="h-2.5 w-2.5" /> Chef&apos;s Pick
            </span>
          )}
          {isMeaningfulSpice && (
            <span className="flex items-center gap-0.5 font-serif italic text-[11px] text-[#725039] dark:text-[#C9AE8B]">
              <Flame className="h-3 w-3 text-red-500 fill-current" />
              <span>{rawSpice}</span>
            </span>
          )}
        </div>

        {/* Description / Ingredients */}
        {item.description && (
          <p className="mt-1.5 line-clamp-2 text-xs font-normal leading-relaxed text-[#5C534B] dark:text-[#C5BAAF] font-sans">
            {item.description}
          </p>
        )}

        {/* Chef Daily Note */}
        {chefNotes && (
          <p className="mt-1 text-[10.5px] font-mono italic text-[#B72E35] dark:text-[#F2C84B] line-clamp-1">
            &ldquo;{chefNotes}&rdquo;
          </p>
        )}

        {/* Pairing info */}
        {pairing && pairing.trim() !== "—" && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#F3E7D3]/90 dark:bg-[#2C2420] border border-[#C9AE8B]/50 dark:border-white/10 text-[11px] text-[#725039] dark:text-[#E2D2BF] max-w-full">
            <Sparkles className="h-3 w-3 text-[#B72E35] dark:text-[#E25C64] shrink-0" />
            <span className="font-serif italic truncate">
              <span className="font-sans font-semibold not-italic text-[#B72E35] dark:text-[#E25C64] mr-1">
                pairs with:
              </span>
              {pairing}
            </span>
          </div>
        )}
      </div>

      {/* Right Column: Price & Direct Cart Add Button */}
      <div className="shrink-0 flex flex-col items-end justify-between self-stretch pl-1 pt-0.5 min-w-[76px]">
        <span
          className={`font-mono text-base sm:text-[17px] font-bold ${
            isSoldOut ? "text-stone-400 dark:text-stone-500" : "text-[#1C1917] dark:text-[#FAF4EB]"
          }`}
        >
          ₹{priceRupees}
        </span>

        {!isSoldOut && (
          <div className="mt-auto pt-2">
            {quantity === 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  addItem(item, 1);
                }}
                className="relative inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-purple-950/40 border border-[#B72E35]/60 dark:border-purple-500/60 text-[#B72E35] dark:text-purple-300 hover:bg-[#B72E35] hover:text-white dark:hover:bg-purple-600 dark:hover:text-white dark:hover:border-purple-600 shadow-xs font-mono text-xs font-bold transition-all duration-150 active:scale-95 cursor-pointer z-10 select-none"
                aria-label={`Add ${item.name} to cart`}
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>ADD</span>
              </button>
            ) : (
              <div
                onClick={(e) => e.stopPropagation()}
                className="relative inline-flex items-center justify-between rounded-xl bg-[#B72E35] dark:bg-purple-600 text-white shadow-sm font-mono text-xs font-bold overflow-hidden z-10 border border-[#9B252B] dark:border-purple-500 select-none"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateQty(item.id, -1);
                  }}
                  className="px-2 py-1.5 hover:bg-black/20 dark:hover:bg-purple-700/60 active:scale-90 transition cursor-pointer flex items-center justify-center text-white"
                  title="Decrease quantity"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3 h-3 stroke-[2.5]" />
                </button>
                <span className="px-1.5 py-0.5 min-w-[20px] text-center font-bold text-xs text-white">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateQty(item.id, 1);
                  }}
                  className="px-2 py-1.5 hover:bg-black/20 dark:hover:bg-purple-700/60 active:scale-90 transition cursor-pointer flex items-center justify-center text-white"
                  title="Increase quantity"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3 h-3 stroke-[2.5]" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Iconic Diagonal Red Stamped "SOLD OUT" Badge */}
      {isSoldOut && (
        <div className="absolute right-4 sm:right-10 top-1/2 -translate-y-1/2 z-20 pointer-events-none transform -rotate-12 select-none">
          <div className="relative rounded-md border-[2.5px] border-[#C22828] bg-[#C22828] px-3.5 sm:px-5 py-1 sm:py-1.5 shadow-xl shadow-red-950/20">
            {/* Inner dashed stamp border */}
            <div className="absolute inset-[2px] rounded-[3px] border border-dashed border-white/60 pointer-events-none" />
            <span className="relative z-10 font-mono text-xs sm:text-sm font-black tracking-widest text-white uppercase drop-shadow-md">
              SOLD OUT
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

