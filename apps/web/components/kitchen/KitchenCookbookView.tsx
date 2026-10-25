"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import {
  BookOpen,
  Search,
  Clock,
  Flame,
  ChefHat,
  Plus,
  Edit3,
  Check,
  X,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Utensils,
  Layers,
  Thermometer,
  ShieldAlert,
  Save,
  Trash2,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Info,
  Lightbulb,
  ShieldCheck,
  LayoutGrid,
  Coffee,
  Leaf,
  UtensilsCrossed,
} from "lucide-react";
import { type KitchenMenuItem, fetchKitchenMenuCatalogAction } from "@/app/kitchen/menu-actions";

export interface RecipeIngredient {
  name: string;
  quantity: string;
  notes?: string;
}

export interface RecipeStep {
  stepNumber: number;
  title: string;
  instruction: string;
  durationSeconds?: number;
  heatLevel?: "Off" | "Low Heat" | "Medium Flame" | "High Flame" | "Brew Temp (92°C)";
}

export interface RecipeDetail {
  itemId: string;
  dishName: string;
  station: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  difficulty: "Beginner (Easy)" | "Intermediate" | "Chef Special";
  servingWare: string;
  idealTemperature: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  proTips: string[];
  substitutions: string[];
  allergens: string[];
}

// Master Pre-seeded Artisanal Recipes for Smol Café standard menu
const DEFAULT_RECIPES: Record<string, RecipeDetail> = {
  item_croissant_butter: {
    itemId: "item_croissant_butter",
    dishName: "Flaky Butter Croissant",
    station: "Bakery & Bakes",
    prepTimeMinutes: 2,
    cookTimeMinutes: 4,
    difficulty: "Beginner (Easy)",
    servingWare: "Small Terracotta Oval Plate with parchment liner",
    idealTemperature: "Warm (60°C)",
    ingredients: [
      { name: "Pre-laminated Croissant", quantity: "1 piece (fresh batch)", notes: "Room temp" },
      { name: "French Salted Butter", quantity: "10g pat", notes: "Served on the side" },
      { name: "Sea Salt Flakes (Maldon)", quantity: "1 pinch", notes: "Top garnish" },
    ],
    steps: [
      {
        stepNumber: 1,
        title: "Pre-heat & Prep",
        instruction: "Preheat convection toaster oven to 175°C. Slice croissant horizontally 80% through if serving with butter.",
        durationSeconds: 60,
        heatLevel: "Medium Flame",
      },
      {
        stepNumber: 2,
        title: "Flash Toast for Crispiness",
        instruction: "Bake on baking parchment for exactly 3.5 minutes until exterior layers turn golden, crackly, and fragrant.",
        durationSeconds: 210,
        heatLevel: "Medium Flame",
      },
      {
        stepNumber: 3,
        title: "Plating & Serve",
        instruction: "Place diagonally on terracotta plate. Sprinkle delicate sea salt flakes on top and place butter quenelle beside it.",
        durationSeconds: 30,
        heatLevel: "Off",
      },
    ],
    proTips: [
      "Do NOT microwave! Microwaving makes the laminated layers soggy and chewy.",
      "If the croissant was baked in the morning, a 3-minute flash toast revives 100% of crispiness.",
    ],
    substitutions: ["Vegan Butter available in fridge shelf 2 for vegan guests."],
    allergens: ["Gluten", "Dairy"],
  },
  item_pour_over: {
    itemId: "item_pour_over",
    dishName: "Ratnagiri Pour Over",
    station: "Brew Bar & Beverages",
    prepTimeMinutes: 2,
    cookTimeMinutes: 3,
    difficulty: "Intermediate",
    servingWare: "Amber Glass Carafe + Ribbed Ceramic Tasting Cup",
    idealTemperature: "88°C - 92°C",
    ingredients: [
      { name: "Ratnagiri Estate Specialty Beans", quantity: "18.5g", notes: "Medium-coarse grind (Setting 16 on Fellow Ode)" },
      { name: "Filtered RO Water (92°C)", quantity: "285ml", notes: "1:15.4 brew ratio" },
      { name: "Hario V60 Paper Filter", quantity: "1 sheet", notes: "Pre-rinsed thoroughly" },
    ],
    steps: [
      {
        stepNumber: 1,
        title: "Filter Rinse & Grind",
        instruction: "Rinse paper filter with hot water to wash away paper taste and pre-warm carafe. Discard rinse water. Add 18.5g ground coffee and create a small center divot.",
        durationSeconds: 45,
        heatLevel: "Brew Temp (92°C)",
      },
      {
        stepNumber: 2,
        title: "Bloom Phase",
        instruction: "Pour 50g of 92°C water in gentle concentric circles. Swirl lightly once. Let coffee bloom for 45 seconds to release CO2.",
        durationSeconds: 45,
        heatLevel: "Brew Temp (92°C)",
      },
      {
        stepNumber: 3,
        title: "Main Pour (Continuous Stream)",
        instruction: "Pour steadily in clockwise spiral to 180g by 1:30, then finish pouring up to 285g by 2:15. Keep stream smooth without touching filter walls.",
        durationSeconds: 90,
        heatLevel: "Brew Temp (92°C)",
      },
      {
        stepNumber: 4,
        title: "Drawdown & Swirl",
        instruction: "Let water draw down fully (total brew time should be 2:45 to 3:00). Swirl carafe gently to oxygenate before serving.",
        durationSeconds: 30,
        heatLevel: "Off",
      },
    ],
    proTips: [
      "Water temperature must be between 91°C–93°C. Cooler water yields sour under-extraction; hotter yields bitterness.",
      "If drawdown takes longer than 3:20, grinder setting is too fine. Move to setting 18.",
    ],
    substitutions: ["Attikan Estate beans can be substituted if Ratnagiri stock is exhausted."],
    allergens: ["None (Caffeine)"],
  },
  item_sourdough_toast: {
    itemId: "item_sourdough_toast",
    dishName: "Triple Decker Sourdough",
    station: "Hot Kitchen & Grill",
    prepTimeMinutes: 5,
    cookTimeMinutes: 6,
    difficulty: "Intermediate",
    servingWare: "10-inch Artisan Stoneware Plate with knife & fork",
    idealTemperature: "Hot & Melting (70°C)",
    ingredients: [
      { name: "Smol House Sourdough Slices", quantity: "2 thick slices (18mm)", notes: "Country blonde loaf" },
      { name: "Salted French Butter", quantity: "25g", notes: "Room temp for spreading" },
      { name: "Smoked Gouda & Mozzarella Blend", quantity: "60g shredded", notes: "50/50 blend" },
      { name: "Caramelized Balsamic Onions", quantity: "30g", notes: "Pre-prepped in prep fridge" },
      { name: "Pickled Jalapeño Slices", quantity: "8-10 slices", notes: "Drained" },
      { name: "Dijon Wholegrain Mustard", quantity: "1 tsp (5g)", notes: "Spread thin" },
    ],
    steps: [
      {
        stepNumber: 1,
        title: "Bread Prep & Layering",
        instruction: "Spread thin layer of butter on outside of sourdough slices. On inside, spread Dijon mustard, layer 30g cheese, caramelized onions, jalapeños, and remaining 30g cheese.",
        durationSeconds: 90,
        heatLevel: "Off",
      },
      {
        stepNumber: 2,
        title: "Skillet Sauté / Toasting",
        instruction: "Place on pre-heated cast iron flat top at medium flame. Press gently with grill press. Sauté for 3 mins until base is dark golden with blistered crust.",
        durationSeconds: 180,
        heatLevel: "Medium Flame",
      },
      {
        stepNumber: 3,
        title: "Flip & Melt Cheese",
        instruction: "Flip carefully. Cover with cloche/lid and add 3 drops of water around pan edge to create steam that melts the cheese completely. Toast 2.5 mins.",
        durationSeconds: 150,
        heatLevel: "Low Heat",
      },
      {
        stepNumber: 4,
        title: "Diagonal Slice & Plate",
        instruction: "Rest on cutting board for 30 seconds (prevents cheese spill). Slice cleanly at a sharp 45° diagonal. Stack slightly overlapping on stoneware plate.",
        durationSeconds: 30,
        heatLevel: "Off",
      },
    ],
    proTips: [
      "Always put cheese both below and above the onions/jalapeños so it acts as glue to hold the sandwich together.",
      "The 3-drop water steam trick under the cloche gives 100% cheese pull without burning the sourdough crust.",
    ],
    substitutions: ["Vegan Mozzarella available for vegan guests with coconut oil spread instead of butter."],
    allergens: ["Gluten", "Dairy"],
  },
  item_masala_chai: {
    itemId: "item_masala_chai",
    dishName: "Himalayan Kulhad Masala Chai",
    station: "Brew Bar & Beverages",
    prepTimeMinutes: 2,
    cookTimeMinutes: 5,
    difficulty: "Beginner (Easy)",
    servingWare: "Raw Baked Terracotta Kulhad (Smoky Pre-warmed)",
    idealTemperature: "Piping Hot (85°C)",
    ingredients: [
      { name: "Assam CTC Black Tea Blend", quantity: "2 heaping tsp (8g)", notes: "Smol house blend" },
      { name: "Crushed Fresh Ginger", quantity: "15g", notes: "Pounded in mortar" },
      { name: "Fresh Green Cardamom Pods", quantity: "3 pods", notes: "Cracked open" },
      { name: "Whole Cloves & Black Peppercorn", quantity: "2 cloves, 2 peppercorns", notes: "Crushed" },
      { name: "Filtered Water", quantity: "120ml", notes: "Boiling base" },
      { name: "Full Cream Milk (A2 / Whole)", quantity: "150ml", notes: "Creamy texture" },
      { name: "Organic Jaggery / Raw Sugar", quantity: "1.5 tsp (10g)", notes: "Adjust to guest note" },
    ],
    steps: [
      {
        stepNumber: 1,
        title: "Aromatics Extraction Boil",
        instruction: "Add water, crushed ginger, cardamom, cloves, and peppercorn in brass saucepan. Bring to rolling boil for 90 seconds to extract deep herbal oils.",
        durationSeconds: 90,
        heatLevel: "High Flame",
      },
      {
        stepNumber: 2,
        title: "Add Tea Leaves & Steep",
        instruction: "Add 8g CTC tea leaves and raw sugar. Lower heat slightly and let decoction simmer for 60 seconds until dark amber red.",
        durationSeconds: 60,
        heatLevel: "Medium Flame",
      },
      {
        stepNumber: 3,
        title: "Milk Addition & 3 Rolling Boils",
        instruction: "Pour 150ml fresh milk. Increase flame. Let chai rise to rim, pull off heat for 5s, return to heat. Repeat 3 times (the 'Oobāl' technique for micro-froth).",
        durationSeconds: 120,
        heatLevel: "High Flame",
      },
      {
        stepNumber: 4,
        title: "Double Strain into Hot Kulhad",
        instruction: "Pre-warm terracotta kulhad with hot water. Double strain chai from a high 8-inch pour to build aromatic foam head. Serve immediately.",
        durationSeconds: 30,
        heatLevel: "Off",
      },
    ],
    proTips: [
      "Always crush ginger FRESH per order — never use pre-minced ginger paste, which creates a bitter sour taste.",
      "The 3-boil aeration creates the velvety creamy mouthfeel guests love.",
    ],
    substitutions: ["Oat milk version: Add oat milk at the very end and do NOT boil aggressively to prevent curdling."],
    allergens: ["Dairy"],
  },
};

export const KitchenCookbookView: React.FC = () => {
  const [menuItems, setMenuItems] = useState<KitchenMenuItem[]>([]);
  const [recipes, setRecipes] = useState<Record<string, RecipeDetail>>(DEFAULT_RECIPES);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>("");
  const [selectedStation, setSelectedStation] = useState<string>("All Stations");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedRecipe, setEditedRecipe] = useState<RecipeDetail | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);

  // Active cooking timer
  const [activeTimerSeconds, setActiveTimerSeconds] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [timerLabel, setTimerLabel] = useState<string>("");

  // Interactive Checklist & Step Expansion
  const [showChecklist, setShowChecklist] = useState<boolean>(false);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});

  // Load recipes from localStorage on client
  useEffect(() => {
    try {
      const saved = localStorage.getItem("smol_chef_cookbook_v1");
      if (saved) {
        setRecipes({ ...DEFAULT_RECIPES, ...JSON.parse(saved) });
      }
    } catch {
      // safe fallback
    }

    const fetchMenu = async () => {
      try {
        const res = await fetchKitchenMenuCatalogAction();
        if (res.success && res.items.length > 0) {
          setMenuItems(res.items);
          setSelectedRecipeId((prev) => {
            const hasPrev = res.items.some((i) => i.id === prev);
            return hasPrev ? prev : res.items[0].id;
          });
        }
      } catch {
        // safe
      }
    };
    fetchMenu();
  }, []);

  // Timer countdown loop
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerRunning && activeTimerSeconds !== null && activeTimerSeconds > 0) {
      interval = setInterval(() => {
        setActiveTimerSeconds((prev) => {
          if (prev === null || prev <= 1) {
            setTimerRunning(false);
            if (typeof navigator !== "undefined" && navigator.vibrate) {
              navigator.vibrate([200, 100, 200]);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning, activeTimerSeconds]);

  const activeRecipe = useMemo(() => {
    // 1. Direct match by recipe ID
    if (recipes[selectedRecipeId]) return recipes[selectedRecipeId];

    // 2. Match with selected menu item
    const fallbackItem = menuItems.find((i) => i.id === selectedRecipeId) || menuItems[0];
    if (fallbackItem) {
      // Check if any predefined recipe matches by dishName
      const matchByName = Object.values(recipes).find(
        (r) => r.dishName.trim().toLowerCase() === fallbackItem.name.trim().toLowerCase()
      );
      if (matchByName) {
        return { ...matchByName, itemId: fallbackItem.id };
      }

      // Generate intelligent recipe template for the live menu item
      return {
        itemId: fallbackItem.id,
        dishName: fallbackItem.name,
        station: fallbackItem.station,
        prepTimeMinutes: 3,
        cookTimeMinutes: 5,
        difficulty: "Beginner (Easy)" as const,
        servingWare: "Smol Café Ceramic Ware with Garnish",
        idealTemperature: "Warm / Fresh",
        ingredients: [
          { name: fallbackItem.coreIngredients || "Fresh Artisanal Ingredients", quantity: "Standard batch", notes: "Fresh prep" },
          { name: "House Seasoning / Butter", quantity: "1 portion", notes: "To taste" },
        ],
        steps: [
          {
            stepNumber: 1,
            title: "Preparation & Station Setup",
            instruction: `Inspect ingredients for ${fallbackItem.name}. Ensure station equipment is pre-heated and sanitised.`,
            durationSeconds: 60,
            heatLevel: "Low Heat" as const,
          },
          {
            stepNumber: 2,
            title: "Cooking / Brew Phase",
            instruction: "Prepare according to station standard guidelines until aromatic, properly textured, and golden.",
            durationSeconds: 180,
            heatLevel: "Medium Flame" as const,
          },
          {
            stepNumber: 3,
            title: "Plating & Presentation",
            instruction: "Plate neatly with house garnish and verify ticket modifier notes before dispatching to pickup shelf.",
            durationSeconds: 30,
            heatLevel: "Off" as const,
          },
        ],
        proTips: ["Always taste-test a micro batch if opening the kitchen fresh."],
        substitutions: ["Check pantry shelf for dairy-free or gluten-free alternatives."],
        allergens: [fallbackItem.dietary || "Standard"],
      };
    }

    return Object.values(recipes)[0] || DEFAULT_RECIPES.item_croissant_butter;
  }, [recipes, selectedRecipeId, menuItems]);

  const stations = useMemo(() => {
    return [
      "All Stations",
      "Brew Bar & Beverages",
      "Hot Kitchen & Grill",
      "Bakery & Bakes",
      "Cold Prep & Bowls",
    ];
  }, []);

  const allAvailableItems = useMemo(() => {
    // Strictly driven by the live café menu catalog!
    if (menuItems.length === 0) return [];

    return menuItems
      .map((m) => {
        const hasDetailedRecipe = Boolean(
          recipes[m.id] ||
          Object.values(recipes).some(
            (r) => r.dishName.trim().toLowerCase() === m.name.trim().toLowerCase()
          )
        );
        return {
          id: m.id,
          name: m.name,
          station: m.station,
          hasDetailedRecipe,
        };
      })
      .filter((item) => {
        const matchStation = selectedStation === "All Stations" || item.station === selectedStation;
        const matchSearch =
          !searchQuery.trim() || item.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchStation && matchSearch;
      });
  }, [recipes, menuItems, selectedStation, searchQuery]);

  const handleStartTimer = (seconds: number, title: string) => {
    setActiveTimerSeconds(seconds);
    setTimerLabel(title);
    setTimerRunning(true);
  };

  const handleSaveEditedRecipe = () => {
    if (!editedRecipe) return;
    const updated = {
      ...recipes,
      [editedRecipe.itemId]: editedRecipe,
    };
    setRecipes(updated);
    try {
      localStorage.setItem("smol_chef_cookbook_v1", JSON.stringify(updated));
    } catch {
      // safe
    }
    setIsEditing(false);
    setEditedRecipe(null);
  };

  const handleAddIngredient = () => {
    if (!editedRecipe) return;
    setEditedRecipe({
      ...editedRecipe,
      ingredients: [
        ...editedRecipe.ingredients,
        { name: "New Ingredient", quantity: "1 portion", notes: "" },
      ],
    });
  };

  const handleRemoveIngredient = (index: number) => {
    if (!editedRecipe) return;
    setEditedRecipe({
      ...editedRecipe,
      ingredients: editedRecipe.ingredients.filter((_, i) => i !== index),
    });
  };

  const handleAddStep = () => {
    if (!editedRecipe) return;
    const newStepNum = editedRecipe.steps.length + 1;
    setEditedRecipe({
      ...editedRecipe,
      steps: [
        ...editedRecipe.steps,
        {
          stepNumber: newStepNum,
          title: `Step ${newStepNum}: New Action`,
          instruction: "Describe step details, exact heat level, and cook time.",
          durationSeconds: 120,
          heatLevel: "Medium Flame",
        },
      ],
    });
  };

  const handleRemoveStep = (index: number) => {
    if (!editedRecipe) return;
    const updatedSteps = editedRecipe.steps
      .filter((_, i) => i !== index)
      .map((step, idx) => ({ ...step, stepNumber: idx + 1 }));
    setEditedRecipe({
      ...editedRecipe,
      steps: updatedSteps,
    });
  };

  return (
    <div className="flex-1 flex flex-col xl:flex-row gap-4 p-3 sm:p-5 max-w-[1560px] mx-auto w-full">
      {/* LEFT SIDEBAR: Search, Station Filters, Recipe List */}
      <div className="w-full xl:w-[360px] shrink-0 flex flex-col gap-3">
        {/* Header Title Card */}
        <div className="relative overflow-hidden rounded-[26px] border border-[#E7DAC8] dark:border-stone-800 bg-[#FFFDF9] dark:bg-[#1C1715] p-5 shadow-[0_2px_12px_rgba(74,46,27,0.03)] space-y-2.5">
          {/* Subtle Decorative Chef Watermark */}
          <div className="pointer-events-none absolute -right-3 -bottom-3 text-[#725039]/5 dark:text-white/5 select-none">
            <ChefHat className="h-28 w-28 -rotate-12" />
          </div>

          <div className="flex items-start justify-between gap-2.5 relative">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200/70 dark:border-red-900/40 text-[#B72E35]">
                <ChefHat className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <h2 className="font-serif text-lg font-bold text-[#241F1C] dark:text-white">
                  Chef&apos;s
                </h2>
                <h2 className="font-serif text-lg font-bold text-[#241F1C] dark:text-white">
                  Cookbook &amp; SOP
                </h2>
              </div>
            </div>

            <span className="shrink-0 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 px-2.5 py-1 font-mono text-[10px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1 shadow-2xs">
              <BookOpen className="h-3 w-3 text-emerald-700 dark:text-emerald-300" />
              <span>Staff Backup Manual</span>
            </span>
          </div>

          <p className="font-serif italic text-xs text-[#7A583E] dark:text-[#C9AE8B] leading-relaxed relative">
            Exact gram measurements, heat levels, sauté timings, and emergency substitution guides so any team member can step in and cook.
          </p>
        </div>

        {/* Search & Station Pills Card */}
        <div className="rounded-[22px] border border-[#E7DAC8] dark:border-stone-800 bg-[#FFFDF9] dark:bg-[#1C1715] p-3.5 space-y-3 shadow-[0_2px_12px_rgba(74,46,27,0.03)]">
          {/* Search Input with ⌘ K */}
          <div className="relative flex items-center rounded-xl border border-[#E4D7C5] dark:border-stone-700 bg-[#FAF6F0] dark:bg-stone-900/80 px-3 py-2">
            <Search className="h-4 w-4 text-[#8C7E72] dark:text-stone-400 shrink-0 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dish or beverage recipe..."
              className="w-full bg-transparent pl-2.5 pr-8 text-xs font-medium text-[#241F1C] dark:text-stone-200 placeholder-[#8C7E72] dark:placeholder-stone-500 focus:outline-none"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-0.5"
                title="Clear"
              >
                ✕
              </button>
            ) : (
              <span className="shrink-0 rounded bg-[#EFE5D7] dark:bg-stone-800 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#7A583E] dark:text-stone-400">
                ⌘ K
              </span>
            )}
          </div>

          {/* Station Filter Pills */}
          <div className="flex flex-wrap gap-2 pt-0.5">
            {stations.map((st) => {
              const isSelected = selectedStation === st;
              let Icon = LayoutGrid;
              if (st === "Brew Bar & Beverages") Icon = Coffee;
              else if (st === "Hot Kitchen & Grill") Icon = Flame;
              else if (st === "Bakery & Bakes") Icon = UtensilsCrossed;
              else if (st === "Cold Prep & Bowls") Icon = Leaf;

              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSelectedStation(st)}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-xs font-semibold transition cursor-pointer ${
                    isSelected
                      ? "bg-[#B72E35] text-white shadow-xs"
                      : "bg-[#FAF6F0] dark:bg-stone-900/80 border border-[#EADCC9] dark:border-stone-800 text-[#6B4B35] dark:text-stone-300 hover:bg-[#F3EADB] dark:hover:bg-stone-800"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{st}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recipes Directory List */}
        <div className="flex-1 rounded-[26px] border border-[#E7DAC8] dark:border-stone-800 bg-[#FFFDF9] dark:bg-[#1C1715] p-2.5 overflow-y-auto max-h-[500px] xl:max-h-[640px] space-y-2 shadow-[0_2px_12px_rgba(74,46,27,0.03)]">
          {allAvailableItems.length === 0 ? (
            <p className="p-8 text-center font-serif italic text-xs text-[#8C7E72]">
              No dishes found matching search
            </p>
          ) : (
            allAvailableItems.map((item) => {
              const isSelected = selectedRecipeId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedRecipeId(item.id);
                    setIsEditing(false);
                    setEditedRecipe(null);
                  }}
                  className={`w-full text-left p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between group ${
                    isSelected
                      ? "bg-[#FDF2F0] dark:bg-purple-950/20 border-2 border-[#B72E35] dark:border-purple-500 shadow-sm"
                      : "bg-white dark:bg-stone-900/60 border border-[#EBDCC9] dark:border-stone-800 hover:bg-[#FAF6F0] dark:hover:bg-stone-800/80"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition ${
                        isSelected
                          ? "bg-white dark:bg-stone-900 border-[#B72E35]/30 text-[#B72E35] dark:text-purple-400 shadow-2xs"
                          : "bg-[#FAF6F0] dark:bg-stone-800 border-[#E7DAC8] dark:border-stone-700 text-[#725039] dark:text-stone-400"
                      }`}
                    >
                      <ChefHat className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="block font-serif text-sm font-bold text-[#241F1C] dark:text-white truncate">
                        {item.name}
                      </span>
                      <span className="font-mono text-[10.5px] text-[#7A583E] dark:text-[#C9AE8B]">
                        {item.station}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {item.hasDetailedRecipe ? (
                      <span className="rounded-lg bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 font-mono text-[9px] font-bold">
                        SOP Ready
                      </span>
                    ) : (
                      <span className="rounded-lg bg-[#FEF3C7] dark:bg-amber-950/80 border border-amber-300 text-[#92400E] dark:text-amber-300 px-2 py-0.5 font-mono text-[9px] font-bold">
                        Auto Guide
                      </span>
                    )}
                    <ChevronRight
                      className={`h-4 w-4 transition ${
                        isSelected ? "text-[#B72E35] dark:text-purple-400 translate-x-0.5" : "text-[#A8988B] group-hover:translate-x-0.5"
                      }`}
                    />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT MAIN PANEL: Active Recipe Manual & Interactive Sauté/Brew Guide */}
      <div className="flex-1 flex flex-col rounded-[28px] border border-[#E7DAC8] dark:border-stone-800 bg-[#FFFDF9] dark:bg-[#1C1715] p-5 sm:p-7 shadow-[0_4px_20px_rgba(74,46,27,0.03)] overflow-y-auto relative space-y-6">
        {/* Subtle Decorative Chef Watermark on Right Header */}
        <div className="pointer-events-none absolute right-8 top-4 text-[#725039]/5 dark:text-white/5 select-none hidden sm:block">
          <ChefHat className="h-44 w-44 -rotate-6" />
        </div>

        {/* Floating Active Timer Widget */}
        {activeTimerSeconds !== null && (
          <div className="flex items-center justify-between rounded-2xl bg-[#B72E35] text-white p-3.5 shadow-md animate-fade-in relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                <Clock className="h-5 w-5 animate-spin" style={{ animationDuration: "4s" }} />
              </div>
              <div>
                <span className="block font-mono text-xs uppercase font-bold text-white/80">
                  Active Step Timer: {timerLabel}
                </span>
                <span className="font-mono text-xl font-black">
                  {Math.floor(activeTimerSeconds / 60)}:{(activeTimerSeconds % 60).toString().padStart(2, "0")}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTimerRunning(!timerRunning)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition cursor-pointer"
              >
                {timerRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTimerSeconds(null);
                  setTimerRunning(false);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Recipe Top Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[#E7DAC8]/70 dark:border-stone-800 pb-5 relative z-10">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-full bg-[#B72E35] text-white px-3 py-1 font-mono text-xs font-bold shadow-2xs">
                {activeRecipe.station}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-[#9E8B7A]" />
              <span className="rounded-full bg-[#EFE5D7] dark:bg-stone-800 px-3 py-1 font-mono text-xs font-semibold text-[#6E4F39] dark:text-stone-300">
                {activeRecipe.difficulty}
              </span>
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-extrabold tracking-tight text-[#241F1C] dark:text-white mt-2">
              {activeRecipe.dishName}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Three Dots Menu Button */}
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5D7C5] dark:border-stone-700 bg-white dark:bg-stone-800 text-[#725039] dark:text-stone-300 hover:bg-[#FAF6F0] dark:hover:bg-stone-700 transition cursor-pointer shadow-2xs"
              title="More options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {!isEditing ? (
              <button
                type="button"
                onClick={() => {
                  setEditedRecipe(JSON.parse(JSON.stringify(activeRecipe)));
                  setIsEditing(true);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-[#B72E35]/50 dark:border-stone-700 bg-white dark:bg-stone-800 px-4 py-2 text-xs font-serif font-bold text-[#241F1C] dark:text-stone-200 shadow-2xs hover:bg-[#FAF6F0] hover:border-[#B72E35] transition active:scale-95 cursor-pointer"
              >
                <Edit3 className="h-3.5 w-3.5 text-[#B72E35]" />
                <span>Edit Recipe SOP</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveEditedRecipe}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 font-serif text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Save SOP</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditedRecipe(null);
                  }}
                  className="flex items-center gap-1 rounded-xl bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 px-3 py-2 text-xs font-medium hover:bg-stone-300 transition cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Cancel</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Essential Metrics: Prep, Cook, Serving Ware, Ideal Temp */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 py-1">
          <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-[#E8DCCB] dark:border-stone-800 flex items-center gap-3 shadow-[0_2px_8px_rgba(74,46,27,0.03)]">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/30 text-[#B72E35]">
              <Clock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="block font-mono text-[10.5px] uppercase font-bold text-[#8C7662] dark:text-stone-400">
                Prep Time
              </span>
              <p className="font-serif text-xl font-extrabold text-[#241F1C] dark:text-white leading-tight mt-0.5">
                {activeRecipe.prepTimeMinutes} mins
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-[#E8DCCB] dark:border-stone-800 flex items-center gap-3 shadow-[0_2px_8px_rgba(74,46,27,0.03)]">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/30 text-amber-600">
              <Flame className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="block font-mono text-[10.5px] uppercase font-bold text-[#8C7662] dark:text-stone-400">
                Cook / Sauté
              </span>
              <p className="font-serif text-xl font-extrabold text-[#241F1C] dark:text-white leading-tight mt-0.5">
                {activeRecipe.cookTimeMinutes} mins
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-[#E8DCCB] dark:border-stone-800 flex items-center gap-3 shadow-[0_2px_8px_rgba(74,46,27,0.03)]">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/30 text-emerald-600">
              <Thermometer className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="block font-mono text-[10.5px] uppercase font-bold text-[#8C7662] dark:text-stone-400">
                Target Temp
              </span>
              <p className="font-serif text-base font-extrabold text-[#241F1C] dark:text-white leading-tight mt-0.5 truncate">
                {activeRecipe.idealTemperature}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-[#E8DCCB] dark:border-stone-800 flex items-center gap-3 shadow-[0_2px_8px_rgba(74,46,27,0.03)]">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/30 text-purple-600">
              <Utensils className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block font-mono text-[10.5px] uppercase font-bold text-[#8C7662] dark:text-stone-400">
                Serving Ware
              </span>
              <p className="font-serif text-xs font-bold text-[#241F1C] dark:text-white leading-tight mt-0.5 truncate" title={activeRecipe.servingWare}>
                {activeRecipe.servingWare}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-[#A8988B] shrink-0" />
          </div>
        </div>

        {/* INGREDIENTS SECTION (Exact Gram Ratios) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-[#B72E35]" />
              <h3 className="font-serif text-base sm:text-lg font-bold text-[#241F1C] dark:text-white">
                Exact Ingredient Ratios &amp; Portions
              </h3>
            </div>
            <div className="flex items-center gap-1.5 text-[#8C7E72] dark:text-stone-400 font-mono text-xs">
              <Info className="h-3.5 w-3.5" />
              <span>Use standard measurements for consistency</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!isEditing
              ? activeRecipe.ingredients.map((ing, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl border border-[#E8DCCB] dark:border-stone-800 bg-[#FAF7F2] dark:bg-stone-900 flex items-center justify-between shadow-[0_1px_4px_rgba(74,46,27,0.03)]"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-stone-800 border border-[#E7DAC8] dark:border-stone-700 text-[#725039]">
                        {idx === 0 ? <Leaf className="h-4 w-4 text-[#B72E35]" /> : <Sparkles className="h-4 w-4 text-amber-600" />}
                      </div>
                      <div className="min-w-0">
                        <span className="block font-serif text-sm font-bold text-[#241F1C] dark:text-stone-100 truncate">
                          {ing.name}
                        </span>
                        {ing.notes && (
                          <span className="block font-mono text-xs text-[#8C7E72] dark:text-stone-400 mt-0.5 truncate">
                            • {ing.notes}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="rounded-lg bg-red-100/70 dark:bg-red-950/60 border border-red-200 dark:border-red-900/50 text-[#B72E35] dark:text-red-300 font-mono text-xs font-black px-3 py-1 shrink-0">
                      {ing.quantity}
                    </span>
                  </div>
                ))
              : editedRecipe?.ingredients.map((ing, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900"
                  >
                    <input
                      type="text"
                      value={ing.name}
                      onChange={(e) => {
                        const next = [...editedRecipe.ingredients];
                        next[idx].name = e.target.value;
                        setEditedRecipe({ ...editedRecipe, ingredients: next });
                      }}
                      placeholder="Ingredient Name"
                      className="flex-1 p-1 text-xs border rounded bg-white dark:bg-stone-800 font-medium"
                    />
                    <input
                      type="text"
                      value={ing.quantity}
                      onChange={(e) => {
                        const next = [...editedRecipe.ingredients];
                        next[idx].quantity = e.target.value;
                        setEditedRecipe({ ...editedRecipe, ingredients: next });
                      }}
                      placeholder="Qty (e.g. 18g)"
                      className="w-24 p-1 text-xs border rounded bg-white dark:bg-stone-800 font-mono font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveIngredient(idx)}
                      className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
          </div>

          {isEditing && (
            <button
              type="button"
              onClick={handleAddIngredient}
              className="flex items-center gap-1 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 px-3 py-1.5 text-xs font-mono font-bold cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Ingredient</span>
            </button>
          )}
        </div>

        {/* STEP-BY-STEP COOKING / SAUTÉ PROCEDURE */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-[#B72E35]" />
              <h3 className="font-serif text-base sm:text-lg font-bold text-[#241F1C] dark:text-white">
                Step-by-Step Cooking &amp; Sauté SOP Guide
              </h3>
            </div>

            <div className="flex items-center gap-3">
              {isEditing && (
                <button
                  type="button"
                  onClick={handleAddStep}
                  className="flex items-center gap-1 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 px-3 py-1.5 text-xs font-mono font-bold cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Step</span>
                </button>
              )}
              <label className="flex items-center gap-2 font-mono text-xs text-[#725039] dark:text-stone-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showChecklist}
                  onChange={(e) => setShowChecklist(e.target.checked)}
                  className="rounded border-[#C9AE8B] text-[#B72E35] focus:ring-[#B72E35] h-3.5 w-3.5 cursor-pointer"
                />
                <span>Show checklist</span>
              </label>
            </div>
          </div>

          <div className="space-y-3">
            {!isEditing
              ? activeRecipe.steps.map((step) => {
                  const isChecked = Boolean(completedSteps[step.stepNumber]);
                  const isExpanded = expandedSteps[step.stepNumber] !== false; // default open
                  return (
                    <div
                      key={step.stepNumber}
                      className="p-4 rounded-2xl border border-[#E8DCCB] dark:border-stone-800 bg-white dark:bg-stone-900 space-y-2.5 shadow-[0_2px_8px_rgba(74,46,27,0.03)] hover:border-[#B72E35]/40 transition"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#B72E35] text-white font-mono text-xs font-black shrink-0">
                            {step.stepNumber}
                          </span>
                          <h4 className="font-serif text-sm sm:text-base font-bold text-[#241F1C] dark:text-white">
                            {step.title}
                          </h4>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {step.heatLevel && (
                            <span className="rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 text-amber-800 dark:text-amber-300 px-3 py-1 font-mono text-[11px] font-bold flex items-center gap-1">
                              🔥 {step.heatLevel}
                            </span>
                          )}

                          {step.durationSeconds && (
                            <button
                              type="button"
                              onClick={() => handleStartTimer(step.durationSeconds || 60, step.title)}
                              className="flex items-center gap-1.5 rounded-full bg-red-50 hover:bg-red-100 dark:bg-red-950/60 border border-red-200 text-[#B72E35] dark:text-red-300 px-3 py-1 font-mono text-[11px] font-bold cursor-pointer transition active:scale-95 shadow-2xs"
                              title="Start step timer"
                            >
                              <Play className="h-3 w-3 fill-current" />
                              <span>
                                {Math.floor(step.durationSeconds / 60)}:{(step.durationSeconds % 60).toString().padStart(2, "0")} min
                              </span>
                            </button>
                          )}

                          {showChecklist && (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                setCompletedSteps((prev) => ({
                                  ...prev,
                                  [step.stepNumber]: e.target.checked,
                                }));
                              }}
                              className="rounded border-[#C9AE8B] text-[#B72E35] focus:ring-[#B72E35] h-4 w-4 cursor-pointer ml-1"
                            />
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setExpandedSteps((prev) => ({
                                ...prev,
                                [step.stepNumber]: !isExpanded,
                              }));
                            }}
                            className="p-1 text-[#8C7E72] hover:text-[#241F1C] transition cursor-pointer"
                          >
                            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <p className="font-serif text-xs leading-relaxed text-[#574436] dark:text-stone-300 pl-9">
                          {step.instruction}
                        </p>
                      )}
                    </div>
                  );
                })
              : editedRecipe?.steps.map((step, idx) => (
                  <div
                    key={step.stepNumber}
                    className="p-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-stone-500">#{step.stepNumber}</span>
                      <input
                        type="text"
                        value={step.title}
                        onChange={(e) => {
                          const next = [...editedRecipe.steps];
                          next[idx].title = e.target.value;
                          setEditedRecipe({ ...editedRecipe, steps: next });
                        }}
                        placeholder="Step Title"
                        className="flex-1 p-1 text-xs border rounded bg-white dark:bg-stone-800 font-bold"
                      />
                      <input
                        type="number"
                        value={step.durationSeconds}
                        onChange={(e) => {
                          const next = [...editedRecipe.steps];
                          next[idx].durationSeconds = Number(e.target.value);
                          setEditedRecipe({ ...editedRecipe, steps: next });
                        }}
                        placeholder="Seconds"
                        className="w-20 p-1 text-xs border rounded bg-white dark:bg-stone-800 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveStep(idx)}
                        className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <textarea
                      value={step.instruction}
                      onChange={(e) => {
                        const next = [...editedRecipe.steps];
                        next[idx].instruction = e.target.value;
                        setEditedRecipe({ ...editedRecipe, steps: next });
                      }}
                      rows={2}
                      className="w-full p-1.5 text-xs border rounded bg-white dark:bg-stone-800 font-serif leading-relaxed"
                    />
                  </div>
                ))}
          </div>
        </div>

        {/* BOTTOM CARDS: Chef's Pro Tip & Quality Checkpoints */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
          {/* Chef's Pro Tip */}
          <div className="p-4 rounded-2xl border border-amber-200/90 dark:border-amber-900/40 bg-[#FFFBEB] dark:bg-amber-950/20 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-600">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <h4 className="font-serif text-xs font-bold text-amber-900 dark:text-amber-300">
                Chef&apos;s Pro Tip
              </h4>
              <p className="font-serif text-xs text-amber-800/90 dark:text-stone-300 leading-relaxed">
                {activeRecipe.proTips[0] || "Maintain consistency in texture and warmth for best customer experience."}
              </p>
            </div>
          </div>

          {/* Quality Checkpoints */}
          <div className="p-4 rounded-2xl border border-emerald-200/90 dark:border-emerald-900/40 bg-[#F0FDF4] dark:bg-emerald-950/20 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <h4 className="font-serif text-xs font-bold text-emerald-900 dark:text-emerald-300">
                Quality Checkpoints
              </h4>
              <p className="font-serif text-xs text-emerald-800/90 dark:text-stone-300 leading-relaxed">
                Taste, texture, temperature and presentation before dispatch.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
