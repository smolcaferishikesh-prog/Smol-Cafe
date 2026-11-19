"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Coffee,
  Search,
  ArrowLeft,
  Download,
  MapPin,
  Sparkles,
  X,
  ExternalLink,
  Flame,
  Heart,
  Share2,
  UtensilsCrossed,
  Check,
  ArrowUp,
  AlertCircle,
  ShieldCheck,
  Scale,
  Activity,
  Wheat,
  SlidersHorizontal,
} from "lucide-react";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { SMOL_CAFE_MAPS_URL } from "@/lib/constants";
import {
  PUBLIC_MENU_SECTIONS,
  PUBLIC_ALL_ITEMS,
  type PublicMenuItem,
  type PublicMenuSection,
  type PublicMenuSubcategory,
  type DietaryType,
} from "@/lib/menu/publicMenuMaster";

interface ModifierOption {
  id: string;
  title: string;
  priceTag?: string;
  extraCost: number;
}

export const PublicMenuPageView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [dietaryFilter, setDietaryFilter] = useState<"all" | DietaryType>("all");
  const [activeSection, setActiveSection] = useState<string>("drinks");
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [showWishlistOnly, setShowWishlistOnly] = useState(false);
  const [selectedItemModal, setSelectedItemModal] = useState<PublicMenuItem | null>(null);
  const [selectedModifierId, setSelectedModifierId] = useState<string>("default");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize wishlist from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("smol_menu_wishlist");
      if (saved) {
        setWishlist(new Set(JSON.parse(saved)));
      }
    } catch {
      // safe fallback
    }
  }, []);

  // Show scroll-to-top button on scroll
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll when modal is open and handle Escape key
  useEffect(() => {
    if (selectedItemModal) {
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setSelectedItemModal(null);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = "unset";
        window.removeEventListener("keydown", handleKeyDown);
      };
    } else {
      document.body.style.overflow = "unset";
    }
  }, [selectedItemModal]);

  // Reset modifier selection when opening a new item modal
  const openItemModal = (item: PublicMenuItem) => {
    setSelectedItemModal(item);
    // Set smart default modifier based on section/subcategory
    if (item.sectionCode === "01") {
      // If it's pure black coffee or tea, default to "none", else "dairy"
      if (item.ingredients.toLowerCase().includes("milk")) {
        setSelectedModifierId("dairy");
      } else {
        setSelectedModifierId("none");
      }
    } else if (
      item.subcategory.includes("SANDWICH") ||
      item.subcategory.includes("BUN")
    ) {
      setSelectedModifierId("classic");
    } else if (item.sectionCode === "04") {
      setSelectedModifierId("medium");
    } else {
      setSelectedModifierId("standard");
    }
  };

  // Toast trigger helper
  const triggerToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Toggle wishlist item
  const toggleWishlist = (id: string, name: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setWishlist((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        triggerToast(`Removed "${name}" from your saved list`);
      } else {
        next.add(id);
        triggerToast(`❤️ Saved "${name}" to your Tapovan wishlist!`);
      }
      try {
        localStorage.setItem("smol_menu_wishlist", JSON.stringify(Array.from(next)));
      } catch {
        // safe
      }
      return next;
    });
  };

  // Filtered menu logic
  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return PUBLIC_MENU_SECTIONS.map((section) => {
      const filteredSubs = section.subcategories
        .map((sub) => {
          const matchingItems = sub.items.filter((item) => {
            const matchesQuery =
              !q ||
              item.name.toLowerCase().includes(q) ||
              item.description.toLowerCase().includes(q) ||
              item.ingredients.toLowerCase().includes(q) ||
              item.code.toLowerCase().includes(q) ||
              item.subcategory.toLowerCase().includes(q) ||
              sub.title.toLowerCase().includes(q);

            const matchesDietary =
              dietaryFilter === "all" ||
              item.dietary === dietaryFilter ||
              (dietaryFilter === "veg" && item.dietary === "vegan");

            const matchesWishlist = !showWishlistOnly || wishlist.has(item.id);

            return matchesQuery && matchesDietary && matchesWishlist;
          });

          return {
            ...sub,
            items: matchingItems,
          };
        })
        .filter((sub) => sub.items.length > 0);

      return {
        ...section,
        subcategories: filteredSubs,
      };
    }).filter((section) => section.subcategories.length > 0);
  }, [searchQuery, dietaryFilter, showWishlistOnly, wishlist]);

  const totalMatches = useMemo(() => {
    return filteredSections.reduce(
      (acc, s) => acc + s.subcategories.reduce((subAcc, sub) => subAcc + sub.items.length, 0),
      0
    );
  }, [filteredSections]);

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      const yOffset = -140;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const renderDietaryBadge = (dietary?: DietaryType, size = "sm") => {
    if (!dietary) return null;
    const boxSize = size === "md" ? "w-4 h-4" : "w-3.5 h-3.5";
    const dotSize = size === "md" ? "w-2 h-2" : "w-1.5 h-1.5";

    if (dietary === "veg") {
      return (
        <span
          title="Pure Vegetarian"
          className={`inline-flex items-center justify-center ${boxSize} border border-emerald-600 rounded-[3px] p-[1.5px] shrink-0 bg-emerald-50/50 dark:bg-emerald-950/20`}
        >
          <span className={`${dotSize} rounded-full bg-emerald-600`} />
        </span>
      );
    }
    if (dietary === "vegan") {
      return (
        <span
          title="Vegan (100% Plant-based)"
          className={`inline-flex items-center justify-center ${boxSize} border border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 rounded-[3px] p-[1.5px] shrink-0 text-[8px] font-bold text-emerald-700 dark:text-emerald-400`}
        >
          V
        </span>
      );
    }
    if (dietary === "egg") {
      return (
        <span
          title="Contains Egg"
          className={`inline-flex items-center justify-center ${boxSize} border border-amber-600 rounded-[3px] p-[1.5px] shrink-0 bg-amber-50/50 dark:bg-amber-950/20`}
        >
          <span className={`${dotSize} rounded-full bg-amber-600`} />
        </span>
      );
    }
    return null;
  };

  const renderSpiceIndicator = (spiceLevel: string) => {
    const level = spiceLevel.toLowerCase().trim();
    if (level === "none" || !level) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900/60">
          <span>🌱</span>
          <span>Mild / No Spice</span>
        </span>
      );
    }
    if (level === "mild") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-900/60">
          <Flame className="w-3 h-3 text-amber-500 fill-amber-500" />
          <span>Mild Heat</span>
        </span>
      );
    }
    if (level === "medium") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded-full border border-orange-200 dark:border-orange-900/60">
          <Flame className="w-3 h-3 text-orange-500 fill-orange-500" />
          <Flame className="w-3 h-3 text-orange-500 fill-orange-500" />
          <span>Medium Spice</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-900/60">
        <Flame className="w-3 h-3 text-rose-500 fill-rose-500" />
        <Flame className="w-3 h-3 text-rose-500 fill-rose-500" />
        <Flame className="w-3 h-3 text-rose-500 fill-rose-500" />
        <span>Spicy &amp; Peppery</span>
      </span>
    );
  };

  const renderPriceStatusLabel = (status: string) => {
    if (status.includes("CURRENT_PDF")) return "Current Menu";
    if (status.includes("OWNER_UPDATE")) return "Owner Updated";
    if (status.includes("LATEST_WORKING")) return "Café Verified";
    if (status.includes("PROPOSED")) return "House Standard";
    return status.replace(/_/g, " ");
  };

  // Build modifier group based on item category (matching user's uploaded images)
  const getModifierGroup = useCallback((item: PublicMenuItem) => {
    // 1. Drinks -> Milk Preference
    if (item.sectionCode === "01") {
      return {
        title: "Milk Preference",
        options: [
          { id: "none", title: "None", extraCost: 0 },
          { id: "dairy", title: "Dairy", extraCost: 0 },
          { id: "oat", title: "Oat", priceTag: "+₹30", extraCost: 30 },
          { id: "almond", title: "Almond", priceTag: "+₹30", extraCost: 30 },
        ],
      };
    }

    // 2. Sandwiches, Bun Makkhan, Bun Omelette -> Bread & Style
    if (
      item.subcategory.includes("SANDWICH") ||
      item.subcategory.includes("BUN")
    ) {
      return {
        title: "Bread & Style",
        options: [
          { id: "classic", title: "Classic", extraCost: 0 },
          { id: "sourdough", title: "Sourdough", priceTag: "+ ₹40", extraCost: 40 },
          { id: "cheese", title: "Extra Cheese", priceTag: "+ ₹35", extraCost: 35 },
          { id: "dip", title: "Spicy Dip", priceTag: "+₹25", extraCost: 25 },
        ],
      };
    }

    // 3. Meals, Bowls, Thalis, Parathas -> Accompaniments & Style
    if (
      item.sectionCode === "03" ||
      item.subcategory.includes("PARATHAS") ||
      item.subcategory.includes("COMBOS")
    ) {
      return {
        title: "Accompaniments & Style",
        options: [
          { id: "standard", title: "Standard", extraCost: 0 },
          { id: "dahi", title: "Fresh Curd", priceTag: "+ ₹30", extraCost: 30 },
          { id: "butter", title: "Extra Butter", priceTag: "+ ₹20", extraCost: 20 },
          { id: "dip", title: "Spicy Dip", priceTag: "+ ₹25", extraCost: 25 },
        ],
      };
    }

    // 4. Indo-Chinese -> Spice & Sauce Style
    if (item.sectionCode === "04") {
      return {
        title: "Spice & Preparation Style",
        options: [
          { id: "medium", title: "Classic Medium", extraCost: 0 },
          { id: "extra-spicy", title: "Extra Spicy 🔥", priceTag: "+ ₹10", extraCost: 10 },
          { id: "schezwan", title: "Schezwan Dip", priceTag: "+ ₹25", extraCost: 25 },
          { id: "mild", title: "Mild & Non-Spicy", extraCost: 0 },
        ],
      };
    }

    // Default: Add-on style
    return {
      title: "Preparation & Add-on",
      options: [
        { id: "standard", title: "Standard Recipe", extraCost: 0 },
        { id: "extra-spice", title: "Extra Spiced", extraCost: 0 },
        { id: "spicy-dip", title: "Spicy Dip", priceTag: "+ ₹25", extraCost: 25 },
      ],
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#F3E7D3] dark:bg-[#151110] text-[#241F1C] dark:text-[#F3E7D3] transition-colors duration-200 relative selection:bg-[#B72E35]/20 selection:text-[#B72E35]">
      {/* CSS Keyframes for Interactive Animations */}
      <style jsx global>{`
        @keyframes steamFloat {
          0% {
            transform: translateY(0px) scaleX(1);
            opacity: 0.2;
          }
          50% {
            transform: translateY(-8px) scaleX(1.15);
            opacity: 0.6;
          }
          100% {
            transform: translateY(-16px) scaleX(1.3);
            opacity: 0;
          }
        }
        @keyframes heartPulse {
          0% { transform: scale(1); }
          25% { transform: scale(1.35); }
          50% { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes modalPop {
          0% {
            opacity: 0;
            transform: scale(0.94) translateY(12px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-modal-pop {
          animation: modalPop 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-slide-up {
          animation: slideInUp 0.3s ease-out forwards;
        }
      `}</style>

      {/* ─── TOAST NOTIFICATION ─── */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#241F1C] text-[#FAF4EB] dark:bg-[#FAF4EB] dark:text-[#241F1C] px-4 py-2.5 rounded-full shadow-2xl text-xs sm:text-sm font-serif font-medium flex items-center gap-2 border border-[#C9AE8B]/40 animate-slide-up">
          <Sparkles className="w-3.5 h-3.5 text-[#F2C84B]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─── HEADER / NAVIGATION BAR ─── */}
      <header className="sticky top-0 z-40 bg-[#F3E7D3]/90 dark:bg-[#151110]/90 backdrop-blur-md border-b border-[#E2D7C7] dark:border-stone-800 transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Back button */}
          <Link
            href="/"
            className="flex items-center gap-2 text-xs sm:text-sm font-serif text-[#725039] dark:text-[#C9AE8B] hover:text-[#B72E35] dark:hover:text-purple-400 transition-colors group cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span className="hidden sm:inline">Back to</span>
            <span className="font-semibold">Home</span>
          </Link>

          {/* Logo & Subtitle */}
          <Link
            href="/"
            className="flex items-center gap-2.5 text-center group cursor-pointer"
          >
            <div className="relative w-8 h-8 rounded-full overflow-hidden bg-[#B72E35] flex items-center justify-center text-white font-serif font-bold text-sm shadow-xs transition-transform group-hover:scale-105">
              <Image
                src="/images/logo/smol-cafe-logo.png"
                alt="Smol Café"
                fill
                sizes="32px"
                className="object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
              <span>S</span>
            </div>
            <div className="text-left">
              <span className="block font-serif font-bold text-sm sm:text-base leading-none text-[#241F1C] dark:text-[#F3E7D3]">
                smol café
              </span>
              <span className="block font-mono text-[9px] sm:text-[10px] text-[#725039] dark:text-[#C9AE8B] uppercase tracking-wider">
                Upper Tapovan · Rishikesh
              </span>
            </div>
          </Link>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="/smol-cafe-menu.pdf"
              download="Smol_Cafe_Rishikesh_Menu.pdf"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-serif text-[#241F1C] dark:text-[#F3E7D3] bg-[#FAF4EB] dark:bg-[#241F1C] border border-[#C9AE8B] dark:border-stone-700 hover:border-[#B72E35] transition-all cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-[#B72E35] dark:text-purple-400" />
              <span>PDF Menu</span>
            </a>

            <ThemeToggle variant="icon" />
          </div>
        </div>
      </header>

      {/* ─── HERO HEADER BANNER ─── */}
      <section className="relative px-4 sm:px-6 pt-10 sm:pt-14 pb-8 sm:pb-12 text-center max-w-4xl mx-auto space-y-4">
        {/* Decorative badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF4EB] dark:bg-[#241F1C] border border-[#C9AE8B]/60 dark:border-stone-700 text-[#725039] dark:text-[#C9AE8B] text-xs font-mono uppercase tracking-widest shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#B72E35] dark:bg-purple-400 animate-pulse" />
          <span>The Menu · Inside Smol Door</span>
        </div>

        {/* Hero Title */}
        <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-[#241F1C] dark:text-[#F3E7D3] leading-[1.15]">
          eat something. meet someone.{" "}
          <span className="italic text-[#B72E35] dark:text-purple-400 font-normal">
            stay for a while.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-xs sm:text-sm md:text-base text-[#725039] dark:text-[#C9AE8B] max-w-2xl mx-auto leading-relaxed">
          Artisanal coffees, spiced Kanpur bun makkhan, homestyle comfort bowls, wholesome thalis &amp; Himalayan herbal infusions.
          <span className="block mt-1 font-mono text-[11px] text-[#725039]/80 dark:text-[#C9AE8B]/80">
            Tap any dish below for detailed recipe ingredients, exact gram weights, macros &amp; allergens.
          </span>
        </p>

        {/* Decorative Divider */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <span className="h-px w-12 bg-[#C9AE8B]/60 dark:bg-stone-700" />
          <Coffee className="w-3.5 h-3.5 text-[#B72E35] dark:text-purple-400" />
          <span className="h-px w-12 bg-[#C9AE8B]/60 dark:bg-stone-700" />
        </div>
      </section>

      {/* ─── STICKY SEARCH & FILTER CONTROLS ─── */}
      <div className="sticky top-16 z-30 bg-[#F3E7D3]/95 dark:bg-[#151110]/95 backdrop-blur-md border-y border-[#E2D7C7] dark:border-stone-800 py-3 shadow-xs transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-2.5">
          {/* Top Row: Search Input & Filter Chips */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#725039]/60 dark:text-[#C9AE8B]/60 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search 111 dishes, coffee, paratha, thali, macros..."
                className="w-full pl-9 pr-8 py-2 rounded-full bg-[#FAF4EB] dark:bg-[#241F1C] text-[#241F1C] dark:text-[#F3E7D3] placeholder:text-[#725039]/50 dark:placeholder:text-[#C9AE8B]/50 border border-[#C9AE8B]/70 dark:border-stone-700 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#B72E35] dark:focus:ring-purple-400 transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#725039] dark:text-[#C9AE8B] hover:text-[#B72E35] p-0.5"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Chips: Dietary & Wishlist */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {(
                [
                  { id: "all", label: "All Items" },
                  { id: "veg", label: "Pure Veg", icon: "🌱" },
                  { id: "egg", label: "Egg", icon: "🥚" },
                  { id: "vegan", label: "Vegan", icon: "🌿" },
                ] as const
              ).map((chip) => {
                const isActive = dietaryFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setDietaryFilter(chip.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-serif font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                      isActive
                        ? "bg-[#B72E35] text-white shadow-xs font-semibold scale-102"
                        : "bg-[#FAF4EB] dark:bg-[#241F1C] text-[#241F1C] dark:text-[#F3E7D3] border border-[#C9AE8B]/60 dark:border-stone-700 hover:border-[#B72E35]"
                    }`}
                  >
                    {"icon" in chip && <span>{chip.icon}</span>}
                    <span>{chip.label}</span>
                  </button>
                );
              })}

              {/* Wishlist quick toggle button */}
              {wishlist.size > 0 && (
                <button
                  type="button"
                  onClick={() => setShowWishlistOnly(!showWishlistOnly)}
                  className={`px-3 py-1.5 rounded-full text-xs font-serif font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    showWishlistOnly
                      ? "bg-[#B72E35] text-white shadow-xs font-semibold"
                      : "bg-[#FAF4EB] dark:bg-[#241F1C] text-[#B72E35] border border-[#B72E35]/40"
                  }`}
                >
                  <Heart className={`w-3 h-3 ${showWishlistOnly ? "fill-white" : "fill-current"}`} />
                  <span>My Wishlist ({wishlist.size})</span>
                </button>
              )}
            </div>
          </div>

          {/* Bottom Row: Quick Section Jump Tabs */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pt-1 pb-0.5 scrollbar-none border-t border-[#E2D7C7]/60 dark:border-stone-800/80">
            <div className="flex items-center gap-2">
              {PUBLIC_MENU_SECTIONS.map((section) => {
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => scrollToSection(section.id)}
                    className={`px-3.5 py-1 rounded-full text-xs sm:text-sm font-serif font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? "bg-[#241F1C] text-[#F3E7D3] dark:bg-[#F3E7D3] dark:text-[#241F1C] shadow-xs scale-102"
                        : "text-[#725039] dark:text-[#C9AE8B] hover:text-[#B72E35] dark:hover:text-purple-400"
                    }`}
                  >
                    <span className="font-mono text-[10px] opacity-70">
                      {section.code}
                    </span>
                    <span>{section.title}</span>
                  </button>
                );
              })}
            </div>

            {/* Live Matches Count */}
            <span className="hidden sm:inline-block font-mono text-[11px] text-[#725039]/80 dark:text-[#C9AE8B]/80 whitespace-nowrap">
              {totalMatches} dishes
            </span>
          </div>
        </div>
      </div>

      {/* ─── MAIN MENU CONTENT ─── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-14 sm:space-y-20">
        {filteredSections.length === 0 ? (
          <div className="text-center py-16 px-4 bg-[#FAF4EB]/60 dark:bg-[#241F1C]/40 rounded-3xl border border-dashed border-[#C9AE8B]/60 dark:border-stone-700 animate-slide-up">
            <Coffee className="w-10 h-10 text-[#C9AE8B] mx-auto mb-3" />
            <h3 className="font-serif text-xl font-bold text-[#241F1C] dark:text-[#F3E7D3]">
              {showWishlistOnly ? "No dishes in your wishlist yet" : "No dishes found"}
            </h3>
            <p className="text-xs sm:text-sm text-[#725039] dark:text-[#C9AE8B] mt-1 max-w-sm mx-auto">
              {showWishlistOnly
                ? "Tap the ❤️ heart icon on any dish card to build your Tapovan feast wishlist!"
                : `We couldn't find anything matching "${searchQuery}". Try searching for "coffee", "paratha", or "thali".`}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setDietaryFilter("all");
                setShowWishlistOnly(false);
              }}
              className="mt-4 px-5 py-2 bg-[#B72E35] hover:bg-[#9E242B] text-white rounded-full text-xs font-serif font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredSections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-36 sm:scroll-mt-40 space-y-8"
            >
              {/* Section Header */}
              <div className="border-b-2 border-[#241F1C] dark:border-[#F3E7D3] pb-3 flex flex-col sm:flex-row sm:items-end justify-between gap-1">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs sm:text-sm font-bold text-[#B72E35] dark:text-purple-400">
                      {section.number}
                    </span>
                    <span className="text-[#C9AE8B]">·</span>
                    <span className="font-mono text-xs uppercase tracking-wider text-[#725039] dark:text-[#C9AE8B]">
                      {section.subtitle}
                    </span>
                  </div>
                  <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-[#241F1C] dark:text-[#F3E7D3] tracking-tight mt-0.5">
                    {section.title}
                  </h2>
                </div>
              </div>

              {/* Subcategories Grid */}
              <div className="space-y-10 sm:space-y-14">
                {section.subcategories.map((sub) => (
                  <div key={sub.id} className="space-y-4">
                    {/* Subcategory Title */}
                    <div className="flex items-center justify-between gap-2 border-b border-[#E2D7C7] dark:border-stone-800 pb-2">
                      <div className="flex items-center gap-2">
                        {sub.icon && (
                          <span className="text-lg sm:text-xl select-none">
                            {sub.icon}
                          </span>
                        )}
                        <div>
                          <h3 className="font-serif text-lg sm:text-xl font-bold text-[#241F1C] dark:text-[#F3E7D3] flex items-center gap-2">
                            <span>{sub.title}</span>
                          </h3>
                          {sub.subtitle && (
                            <p className="font-sans text-xs text-[#725039] dark:text-[#C9AE8B]">
                              {sub.subtitle}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Items Grid with Interactive Cards & Micro-interactions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      {sub.items.map((item) => {
                        const isFavorited = wishlist.has(item.id);

                        return (
                          <div
                            key={item.id}
                            onClick={() => openItemModal(item)}
                            className="group relative p-3.5 sm:p-4 rounded-2xl bg-[#FAF4EB] dark:bg-[#241F1C] border border-[#E2D7C7] dark:border-stone-800/90 hover:border-[#B72E35]/60 dark:hover:border-purple-500/60 transition-all duration-300 shadow-xs hover:shadow-xl hover:-translate-y-1 cursor-pointer flex flex-col justify-between gap-2 overflow-hidden"
                          >
                            {/* Ambient Hover Glow */}
                            <div className="absolute top-0 right-0 w-24 h-24 bg-[#B72E35]/5 dark:bg-purple-600/5 rounded-full blur-2xl group-hover:bg-[#B72E35]/15 transition-all duration-500 pointer-events-none" />

                            {/* Item Header: Code, Name, Dietary Dot, Price */}
                            <div className="flex items-start justify-between gap-3 relative z-10">
                              <div className="space-y-1 flex-1 pr-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {renderDietaryBadge(item.dietary)}
                                  <span className="font-mono text-[10px] text-[#725039]/70 dark:text-[#C9AE8B]/70 bg-[#EBDDC8]/60 dark:bg-stone-800 px-1.5 py-0.2 rounded font-semibold">
                                    #{item.code}
                                  </span>
                                  <h4 className="font-serif text-base sm:text-lg font-bold text-[#241F1C] dark:text-[#F3E7D3] group-hover:text-[#B72E35] dark:group-hover:text-purple-400 transition-colors">
                                    {item.name}
                                  </h4>
                                </div>
                                {item.description && (
                                  <p className="text-xs sm:text-[13px] text-[#725039] dark:text-[#C9AE8B] leading-relaxed line-clamp-2">
                                    {item.description}
                                  </p>
                                )}
                              </div>

                              {/* Price Badge + Favorite Button */}
                              <div className="flex flex-col items-end shrink-0 gap-1.5">
                                <span className="font-mono text-sm sm:text-base font-bold text-[#241F1C] dark:text-[#F3E7D3] group-hover:text-[#B72E35] dark:group-hover:text-purple-400 transition-colors">
                                  {item.price}
                                </span>

                                <div className="flex items-center gap-1">
                                  {item.serving && (
                                    <span className="text-[10px] font-mono text-[#725039]/80 dark:text-[#C9AE8B]/80 px-1.5 py-0.5 rounded-full bg-[#FAF4EB] dark:bg-stone-800 border border-[#E2D7C7] dark:border-stone-700">
                                      {item.serving}
                                    </span>
                                  )}

                                  {/* Wishlist Heart Toggle */}
                                  <button
                                    type="button"
                                    onClick={(e) => toggleWishlist(item.id, item.name, e)}
                                    className={`p-1.5 rounded-full transition-all cursor-pointer ${
                                      isFavorited
                                        ? "text-rose-500 bg-rose-50 dark:bg-rose-950/40 scale-110"
                                        : "text-[#725039]/50 hover:text-rose-500 hover:bg-stone-200/50 dark:hover:bg-stone-800"
                                    }`}
                                    title={isFavorited ? "Remove from wishlist" : "Save to wishlist"}
                                  >
                                    <Heart
                                      className={`w-3.5 h-3.5 ${isFavorited ? "fill-rose-500" : ""}`}
                                    />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Card Footer: Spice level & Details Prompt */}
                            <div className="flex items-center justify-between text-[11px] text-[#725039]/70 dark:text-[#C9AE8B]/70 pt-1.5 border-t border-[#E2D7C7]/40 dark:border-stone-800/60 font-mono">
                              <span className="truncate max-w-[220px]">
                                {item.spiceLevel !== "none" ? (
                                  renderSpiceIndicator(item.spiceLevel)
                                ) : (
                                  <span className="text-[11px] text-[#725039]/70 dark:text-[#C9AE8B]/70">
                                    {item.nutrition.calories ? `⚡ ${item.nutrition.calories} kcal` : "Standard Recipe"}
                                  </span>
                                )}
                              </span>
                              <span className="group-hover:translate-x-1 transition-transform text-[#B72E35] dark:text-purple-400 font-bold flex items-center gap-1">
                                <span>Recipe &amp; Macros</span>
                                <span>→</span>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {/* ─── INTERACTIVE FOOD / DRINK ITEM DETAIL MODAL ─── */}
      {selectedItemModal && (() => {
        const modifierGroup = getModifierGroup(selectedItemModal);
        const currentModifier = modifierGroup.options.find(
          (opt) => opt.id === selectedModifierId
        ) || modifierGroup.options[0];

        // Parse base price number
        const baseNum = parseInt(
          selectedItemModal.price.replace(/[^\d]/g, ""),
          10
        ) || 0;
        const totalNum = baseNum + (currentModifier?.extraCost || 0);

        // Parse standard recipe ingredients list
        const ingredientsList = selectedItemModal.ingredients
          ? selectedItemModal.ingredients
              .split(";")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

        const isFavorited = wishlist.has(selectedItemModal.id);

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setSelectedItemModal(null)}
          >
            <div
              className="relative w-full max-w-xl max-h-[90vh] bg-[#FAF4EB] dark:bg-[#1E1917] rounded-3xl p-5 sm:p-7 shadow-2xl border border-[#C9AE8B]/80 dark:border-stone-700 text-[#241F1C] dark:text-[#F3E7D3] flex flex-col gap-4 overflow-y-auto scrollbar-thin animate-modal-pop"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Top Bar */}
              <div className="flex items-start justify-between gap-3 border-b border-[#E2D7C7] dark:border-stone-800 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {renderDietaryBadge(selectedItemModal.dietary, "md")}
                    <span className="font-mono text-xs uppercase text-[#B72E35] dark:text-purple-400 font-bold tracking-wider bg-[#B72E35]/10 dark:bg-purple-950/40 px-2 py-0.5 rounded-md">
                      Item #{selectedItemModal.code}
                    </span>
                    <span className="font-mono text-[10px] text-[#725039] dark:text-[#C9AE8B] uppercase bg-[#EBDDC8]/60 dark:bg-stone-800 px-2 py-0.5 rounded-full">
                      {renderPriceStatusLabel(selectedItemModal.priceStatus)}
                    </span>
                  </div>
                  <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#241F1C] dark:text-[#F3E7D3] tracking-tight">
                    {selectedItemModal.name}
                  </h3>
                  <div className="flex items-center gap-3 text-xs font-mono text-[#725039] dark:text-[#C9AE8B]">
                    <span>Serving: {selectedItemModal.serving}</span>
                    <span>·</span>
                    <span>{renderSpiceIndicator(selectedItemModal.spiceLevel)}</span>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setSelectedItemModal(null)}
                  className="p-1.5 rounded-full bg-stone-200/60 dark:bg-stone-800 text-[#725039] hover:text-[#241F1C] dark:text-stone-300 dark:hover:text-white transition-colors cursor-pointer shrink-0"
                  aria-label="Close details"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Full Description */}
              <p className="text-sm sm:text-base text-[#725039] dark:text-[#C9AE8B] leading-relaxed">
                {selectedItemModal.description}
              </p>

              {/* ─── INTERACTIVE MODIFIER SELECTOR (MATCHING USER SCREENSHOTS) ─── */}
              <div className="p-4 rounded-2xl bg-[#F3E7D3]/60 dark:bg-[#2A231E]/60 border border-[#C9AE8B]/50 dark:border-stone-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif text-base sm:text-lg font-bold text-[#241F1C] dark:text-[#F3E7D3]">
                    {modifierGroup.title}
                  </h4>
                  {currentModifier?.extraCost > 0 && (
                    <span className="font-mono text-xs font-semibold text-[#B72E35] dark:text-purple-400">
                      +{currentModifier.extraCost} selected
                    </span>
                  )}
                </div>

                {/* Interactive Pills */}
                <div className="flex flex-wrap gap-2 sm:gap-2.5">
                  {modifierGroup.options.map((option) => {
                    const isSelected = selectedModifierId === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedModifierId(option.id)}
                        className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl font-serif text-xs sm:text-sm font-medium transition-all active:scale-95 cursor-pointer text-center flex items-center justify-center gap-1 ${
                          isSelected
                            ? "bg-[#B72E35] text-white shadow-sm font-semibold scale-102"
                            : "bg-[#FAF4EB] dark:bg-[#201A18] text-[#241F1C] dark:text-[#F3E7D3] border border-[#E0D4C3] dark:border-stone-700 hover:border-[#B72E35]/50"
                        }`}
                      >
                        <span>{option.title}</span>
                        {option.priceTag && (
                          <span
                            className={`text-[11px] sm:text-xs font-sans ${
                              isSelected ? "text-white/90" : "text-[#725039] dark:text-[#C9AE8B]"
                            }`}
                          >
                            {option.priceTag}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ─── STANDARD RECIPE INGREDIENTS (GRAM & ML STANDARD) ─── */}
              {ingredientsList.length > 0 && (
                <div className="p-4 rounded-2xl bg-[#FAF4EB] dark:bg-[#201A18] border border-[#E2D7C7] dark:border-stone-800 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-serif font-bold text-[#241F1C] dark:text-[#F3E7D3]">
                    <Scale className="w-3.5 h-3.5 text-[#B72E35] dark:text-purple-400" />
                    <span>Standard Kitchen Recipe Ingredients (Gram Standard):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ingredientsList.map((ing, idx) => (
                      <span
                        key={idx}
                        className="font-mono text-xs px-2.5 py-1 rounded-xl bg-[#F3E7D3] dark:bg-stone-800/80 text-[#241F1C] dark:text-[#F3E7D3] border border-[#C9AE8B]/40 dark:border-stone-700/80"
                      >
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── NUTRITION FACTS (CALCULATED ESTIMATES) ─── */}
              {selectedItemModal.nutrition && (
                <div className="p-4 rounded-2xl bg-[#FAF4EB] dark:bg-[#201A18] border border-[#E2D7C7] dark:border-stone-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-serif text-xs font-bold text-[#241F1C] dark:text-[#F3E7D3]">
                      <Activity className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Nutrition Facts (Estimated per Serving):</span>
                    </span>
                    {selectedItemModal.nutrition.calories !== null && (
                      <span className="font-mono text-xs font-bold text-[#B72E35] dark:text-purple-400">
                        {selectedItemModal.nutrition.calories} kcal
                      </span>
                    )}
                  </div>

                  {/* 4 Macros Grid */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-[#F3E7D3]/60 dark:bg-stone-800/60 border border-[#C9AE8B]/30">
                      <span className="block font-mono text-[10px] text-[#725039] dark:text-[#C9AE8B] uppercase">
                        Energy
                      </span>
                      <span className="block font-mono text-xs sm:text-sm font-bold text-[#241F1C] dark:text-[#F3E7D3]">
                        {selectedItemModal.nutrition.calories !== null
                          ? `${selectedItemModal.nutrition.calories} kcal`
                          : "—"}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-[#F3E7D3]/60 dark:bg-stone-800/60 border border-[#C9AE8B]/30">
                      <span className="block font-mono text-[10px] text-[#725039] dark:text-[#C9AE8B] uppercase">
                        Protein
                      </span>
                      <span className="block font-mono text-xs sm:text-sm font-bold text-[#241F1C] dark:text-[#F3E7D3]">
                        {selectedItemModal.nutrition.protein || "—"}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-[#F3E7D3]/60 dark:bg-stone-800/60 border border-[#C9AE8B]/30">
                      <span className="block font-mono text-[10px] text-[#725039] dark:text-[#C9AE8B] uppercase">
                        Carbs
                      </span>
                      <span className="block font-mono text-xs sm:text-sm font-bold text-[#241F1C] dark:text-[#F3E7D3]">
                        {selectedItemModal.nutrition.carbs || "—"}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-[#F3E7D3]/60 dark:bg-stone-800/60 border border-[#C9AE8B]/30">
                      <span className="block font-mono text-[10px] text-[#725039] dark:text-[#C9AE8B] uppercase">
                        Fat
                      </span>
                      <span className="block font-mono text-xs sm:text-sm font-bold text-[#241F1C] dark:text-[#F3E7D3]">
                        {selectedItemModal.nutrition.fat || "—"}
                      </span>
                    </div>
                  </div>

                  <p className="text-[10px] font-mono text-[#725039]/80 dark:text-[#C9AE8B]/80 leading-normal">
                    *Estimated metrics from standardized pre-cooking weights (ICMR-IFCT &amp; USDA basis). Sourcing and kitchen cooking variation may apply.
                  </p>
                </div>
              )}

              {/* ─── ALLERGENS & DIETARY NOTICES ─── */}
              <div className="p-3.5 rounded-2xl bg-[#F3E7D3]/40 dark:bg-[#201A18]/40 border border-[#E2D7C7] dark:border-stone-800 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-serif font-bold text-[#725039] dark:text-[#C9AE8B]">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Allergens &amp; Dietary Notes:</span>
                </div>
                <p className="text-xs text-[#241F1C] dark:text-[#F3E7D3] font-mono leading-relaxed">
                  <span className="font-semibold text-[#B72E35] dark:text-purple-400">
                    Allergens:{" "}
                  </span>
                  {selectedItemModal.allergens}
                </p>
                {selectedItemModal.dietaryNotes && (
                  <p className="text-[11px] text-[#725039] dark:text-[#C9AE8B]">
                    {selectedItemModal.dietaryNotes}
                  </p>
                )}
              </div>

              {/* ─── MODAL FOOTER: PRICE & ACTIONS ─── */}
              <div className="pt-3 border-t border-[#E2D7C7] dark:border-stone-800 flex items-center justify-between gap-3 mt-auto">
                <div>
                  <span className="block font-mono text-[10px] uppercase text-[#725039] dark:text-[#C9AE8B]">
                    Total Estimate
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-2xl sm:text-3xl font-bold text-[#241F1C] dark:text-[#F3E7D3]">
                      ₹{totalNum}
                    </span>
                    {currentModifier?.extraCost > 0 && (
                      <span className="font-mono text-xs text-[#725039] dark:text-[#C9AE8B]">
                        (₹{baseNum} + ₹{currentModifier.extraCost})
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Wishlist Button */}
                  <button
                    type="button"
                    onClick={() =>
                      toggleWishlist(selectedItemModal.id, selectedItemModal.name)
                    }
                    className={`px-4 py-2.5 rounded-full font-serif text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isFavorited
                        ? "bg-rose-500 text-white shadow-md"
                        : "bg-[#FAF4EB] dark:bg-[#241F1C] border border-[#C9AE8B] text-[#725039] dark:text-[#C9AE8B] hover:border-rose-400"
                    }`}
                  >
                    <Heart
                      className={`w-4 h-4 ${isFavorited ? "fill-white" : ""}`}
                    />
                    <span>
                      {isFavorited ? "Saved to Wishlist" : "Save Dish"}
                    </span>
                  </button>

                  {/* Share Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(
                          `${selectedItemModal.name} (${selectedItemModal.price}) at smol café, Upper Tapovan Rishikesh! http://localhost:3000/menu`
                        );
                        triggerToast(
                          `Copied details for "${selectedItemModal.name}"!`
                        );
                      }
                    }}
                    className="p-2.5 rounded-full bg-[#FAF4EB] dark:bg-[#241F1C] border border-[#C9AE8B] text-[#725039] dark:text-[#C9AE8B] hover:text-[#B72E35] transition-colors cursor-pointer"
                    title="Copy details to share"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── FLOATING SCROLL TO TOP BUTTON ─── */}
      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-40 p-3 rounded-full bg-[#B72E35] hover:bg-[#9E242B] dark:bg-purple-600 dark:hover:bg-purple-500 text-white shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 active:translate-y-0 cursor-pointer animate-slide-up"
          aria-label="Scroll to top of menu"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}

      {/* ─── BOTTOM CTA & VISIT BANNER ─── */}
      <section className="bg-[#F3E7D3] dark:bg-[#151110] border-t border-[#E2D7C7]/80 dark:border-stone-800/80 py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold uppercase text-[#725039] dark:text-[#C9AE8B] tracking-wider">
            <MapPin className="w-4 h-4 text-[#B72E35] dark:text-purple-400" />
            <span>Visit Us in Upper Tapovan</span>
          </div>

          <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-[#241F1C] dark:text-[#F3E7D3]">
            Fresh Bakes, Coffee &amp; Quiet Conversations
          </h2>

          <p className="text-xs sm:text-sm md:text-base text-[#725039] dark:text-[#C9AE8B] max-w-lg mx-auto leading-relaxed">
            Smol Door, Upper Tapovan, Rishikesh, Uttarakhand 249192.
            <br />
            Open Every Day · 8:00 AM – 10:30 PM.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a
              href={SMOL_CAFE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#B72E35] hover:bg-[#9E242B] dark:bg-purple-600 dark:hover:bg-purple-500 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-full font-serif font-semibold text-xs sm:text-sm shadow-md transition-all hover:scale-102 active:scale-95 cursor-pointer"
            >
              <MapPin className="w-4 h-4" />
              <span>Get Directions to Smol Door</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </a>

            <a
              href="/smol-cafe-menu.pdf"
              download="Smol_Cafe_Rishikesh_Menu.pdf"
              className="inline-flex items-center gap-2 bg-[#FAF4EB] dark:bg-[#241F1C] hover:bg-white dark:hover:bg-stone-800 text-[#241F1C] dark:text-[#F3E7D3] border border-[#C9AE8B] dark:border-stone-700 px-5 sm:px-6 py-2.5 sm:py-3 rounded-full font-serif font-semibold text-xs sm:text-sm shadow-xs transition-all hover:scale-102 active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#B72E35] dark:text-purple-400" />
              <span>Download PDF Menu</span>
            </a>

            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-serif font-semibold text-[#725039] dark:text-[#C9AE8B] hover:text-[#B72E35] dark:hover:text-purple-400 px-4 py-2 transition-colors cursor-pointer"
            >
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── COMPACT FOOTER ─── */}
      <footer className="border-t border-[#E2D7C7]/60 dark:border-stone-800/80 py-6 px-4 text-center font-mono text-[11px] text-[#725039]/70 dark:text-[#C9AE8B]/70">
        <p>© {new Date().getFullYear()} smol café · Tapovan, Rishikesh · Handcrafted with love.</p>
      </footer>
    </div>
  );
};
