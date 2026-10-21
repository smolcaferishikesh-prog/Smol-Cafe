"use client";

import React, { useState } from "react";
import Image from "next/image";
import type { MenuItemWithDetails } from "@/lib/queries/menu";
import { X, Plus, Minus, Coffee } from "lucide-react";

interface ItemCustomizationModalProps {
  item: MenuItemWithDetails;
  onClose: () => void;
  onAddToCart: (customizedItem: MenuItemWithDetails, qty: number, notes?: string) => void;
}

export const ItemCustomizationModal: React.FC<ItemCustomizationModalProps> = ({
  item,
  onClose,
  onAddToCart,
}) => {
  const isBeverage =
    item.name.toLowerCase().includes("coffee") ||
    item.name.toLowerCase().includes("latte") ||
    item.name.toLowerCase().includes("cappuccino") ||
    item.name.toLowerCase().includes("flat white") ||
    item.name.toLowerCase().includes("chai") ||
    item.name.toLowerCase().includes("brew") ||
    item.name.toLowerCase().includes("pour over");

  const [milkOption, setMilkOption] = useState<"dairy" | "oat" | "almond">("dairy");
  const [sweetness, setSweetness] = useState<"standard" | "half" | "zero">("standard");
  const [extraShot, setExtraShot] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [quantity, setQuantity] = useState(1);

  // Price calculations
  let additionalCostPaise = 0;
  if (isBeverage) {
    if (milkOption === "oat" || milkOption === "almond") additionalCostPaise += 4000; // ₹40
    if (extraShot) additionalCostPaise += 5000; // ₹50
  }

  const unitPricePaise = item.pricePaise + additionalCostPaise;
  const totalPriceRupees = Math.round((unitPricePaise * quantity) / 100);

  const handleAdd = () => {
    let customSummary = "";
    if (isBeverage) {
      const parts = [];
      if (milkOption !== "dairy") parts.push(`${milkOption.toUpperCase()} milk`);
      if (sweetness === "half") parts.push("50% sweet");
      if (sweetness === "zero") parts.push("No sugar");
      if (extraShot) parts.push("Extra shot");
      customSummary = parts.join(", ");
    }

    const fullNotes = [customSummary, instructions.trim()].filter(Boolean).join(" • ");

    // Clone item with customized price
    const customItem: MenuItemWithDetails = {
      ...item,
      pricePaise: unitPricePaise,
    };

    onAddToCart(customItem, quantity, fullNotes || undefined);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs sm:items-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-t-[2.5rem] sm:rounded-3xl border border-[#E2D7C7] bg-[#FAF4EB] shadow-2xl text-[#241F1C] transition-all animate-scale-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Hero / Image */}
        <div className="relative h-48 w-full bg-[#241F1C]/10">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              unoptimized={item.imageUrl.startsWith("data:")}
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 448px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#EFE7DC] text-[#725039]">
              <Coffee className="h-12 w-12 opacity-40" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[#241F1C]/80 via-transparent to-black/30" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70 transition"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Title & Price Overlay */}
          <div className="absolute bottom-3 left-4 right-4 text-white">
            <h3 className="font-serif text-2xl font-bold tracking-tight">{item.name}</h3>
            <p className="font-mono text-sm text-[#F2C84B] font-semibold">
              ₹{Math.round(item.pricePaise / 100)} base price
            </p>
          </div>
        </div>

        {/* Customization Options Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <p className="font-serif italic text-xs text-[#725039] leading-relaxed">
            {item.description || "Handcrafted with fresh ingredients at smol café."}
          </p>

          {/* Milk Options for Coffee/Chai */}
          {isBeverage && (
            <div className="space-y-2 rounded-2xl border border-[#E2D7C7] bg-white p-3.5">
              <label className="font-serif text-xs font-bold text-[#241F1C] block">
                Choice of Milk
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { id: "dairy", label: "Full Cream", price: "+₹0" },
                  { id: "oat", label: "Oat Milk", price: "+₹40" },
                  { id: "almond", label: "Almond", price: "+₹40" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMilkOption(m.id as "dairy" | "oat" | "almond")}
                    className={`rounded-xl border p-2 text-center transition-all ${
                      milkOption === m.id
                        ? "border-[#B72E35] bg-[#FFF8E7] font-bold text-[#B72E35] shadow-xs"
                        : "border-[#E2D7C7] text-stone-600 hover:border-stone-400"
                    }`}
                  >
                    <div>{m.label}</div>
                    <div className="text-[10px] text-stone-500 font-mono">{m.price}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sweetness Preference */}
          {isBeverage && (
            <div className="space-y-2 rounded-2xl border border-[#E2D7C7] bg-white p-3.5">
              <label className="font-serif text-xs font-bold text-[#241F1C] block">
                Sweetness Level
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { id: "standard", label: "Regular" },
                  { id: "half", label: "50% Sweet" },
                  { id: "zero", label: "No Sugar" },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSweetness(s.id as "standard" | "half" | "zero")}
                    className={`rounded-xl border p-2 text-center transition-all ${
                      sweetness === s.id
                        ? "border-[#B72E35] bg-[#FFF8E7] font-bold text-[#B72E35] shadow-xs"
                        : "border-[#E2D7C7] text-stone-600 hover:border-stone-400"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add-ons */}
          {isBeverage && (
            <div className="rounded-2xl border border-[#E2D7C7] bg-white p-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-serif text-xs font-bold text-[#241F1C] block">
                    Extra Espresso Shot
                  </span>
                  <span className="text-[11px] text-stone-500 font-mono">+₹50</span>
                </div>
                <input
                  type="checkbox"
                  checked={extraShot}
                  onChange={(e) => setExtraShot(e.target.checked)}
                  className="h-5 w-5 rounded border-stone-300 text-[#B72E35] focus:ring-[#B72E35]"
                />
              </div>
            </div>
          )}

          {/* Special Cooking Instructions */}
          <div className="space-y-1.5">
            <label className="font-serif text-xs font-bold text-[#241F1C] block">
              Special Kitchen Notes
            </label>
            <input
              type="text"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g., extra crispy, separate dressing, less ice..."
              className="w-full rounded-xl border border-[#E2D7C7] bg-white px-3.5 py-2 text-xs text-[#241F1C] placeholder:text-stone-400 focus:border-[#B72E35] focus:outline-none"
            />
          </div>
        </div>

        {/* Modal Footer with Stepper and Add Button */}
        <div className="border-t border-[#E2D7C7] bg-[#FAF4EB] p-4 flex items-center justify-between gap-3">
          {/* Quantity Stepper */}
          <div className="flex items-center rounded-2xl border border-[#E2D7C7] bg-white p-1 shadow-xs">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-stone-600 hover:bg-stone-100 active:scale-95"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-8 text-center font-mono font-bold text-sm text-[#241F1C]">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-stone-600 hover:bg-stone-100 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Add to Cart CTA: Liquid Ruby (Light) / Amethyst Purple (Dark) */}
          <button
            onClick={handleAdd}
            className="group relative overflow-hidden flex-1 rounded-2xl bg-gradient-to-b from-[#E03A43]/70 via-[#B72E35]/80 to-[#7D1217]/90 dark:from-[#A855F7]/70 dark:via-[#7E22CE]/80 dark:to-[#4C1D95]/90 py-3.5 px-4 font-serif text-sm font-bold text-white backdrop-blur-[16px] border border-white/55 dark:border-purple-300/40 shadow-[0_6px_22px_rgba(183,46,53,0.4),inset_0_1.5px_1.5px_rgba(255,255,255,0.85),inset_0_-1.5px_2px_rgba(0,0,0,0.4),inset_0_0_12px_rgba(255,140,140,0.35)] dark:shadow-[0_6px_24px_rgba(126,34,206,0.5),inset_0_1.5px_1.5px_rgba(255,255,255,0.85),inset_0_-1.5px_2px_rgba(0,0,0,0.5),inset_0_0_14px_rgba(192,132,252,0.45)] active:scale-[0.98] transition flex items-center justify-between cursor-pointer"
          >
            {/* Curved Specular Glass Gloss Reflection */}
            <span className="absolute inset-x-3 top-0.5 h-[42%] rounded-full bg-gradient-to-b from-white/50 via-white/15 to-transparent pointer-events-none opacity-90" />
            <span className="relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">Add to Order</span>
            <span className="relative z-10 font-mono drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">₹{totalPriceRupees}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
