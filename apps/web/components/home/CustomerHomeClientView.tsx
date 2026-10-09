"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TodayBlackboardCard } from "@/components/home/TodayBlackboardCard";
import { ThemeToggle } from "@/components/common/ThemeToggle";

interface CustomerHomeClientProps {
  tableLabel?: string;
  locationName?: string;
  guestName?: string;
  guestPhone?: string;
}

export const CustomerHomeClientView: React.FC<CustomerHomeClientProps> = ({
  tableLabel,
  locationName = "Rishikesh",
  guestName = "",
  guestPhone = "",
}) => {
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [currentGuestName, setCurrentGuestName] = useState(guestName);
  const [currentTableLabel, setCurrentTableLabel] = useState(tableLabel || "");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("smol_guest_name");
      if (saved && !currentGuestName) {
        setCurrentGuestName(saved);
      }
      const savedTable = localStorage.getItem("smol_current_table");
      if (savedTable && !currentTableLabel) {
        setCurrentTableLabel(savedTable);
      }
    }
  }, [currentGuestName, currentTableLabel]);

  const activeTable = tableLabel || currentTableLabel;

  // Time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const moodCards = [
    {
      id: "feed-me",
      title: "FEED ME",
      subtitle: "I’m hungry",
      classes: "bg-[#FCEAE1] border-[#F4C1B9] dark:bg-[#1A1212] dark:border-[#4A2024]",
      innerBorder: "border-[#E8C2BA]/80 dark:border-[#52292E]/70",
      titleColor: "text-[#7C1A22] dark:text-[#FFAAA6]",
      subColor: "text-[#634838] dark:text-[#D5BCAD]",
      imgClass: "max-w-[155px] sm:max-w-[175px]",
      lightImage: "/sandwich-removebg-preview.png",
      darkImage: "/sandwich-removebg-preview.png",
      href: "/smol-menu?category=All-Day+Bites",
      isCustomGraphic: true,
    },
    {
      id: "coffee-first",
      title: "COFFEE FIRST",
      subtitle: "But make it strong",
      classes: "bg-[#EEF6F4] border-[#CCE3DE] dark:bg-[#131C1A] dark:border-[#1E3A34]",
      innerBorder: "border-[#B8DBD2]/80 dark:border-[#1E3A34]/70",
      titleColor: "text-[#154035] dark:text-[#A3E0D2]",
      subColor: "text-[#3E544E] dark:text-[#BCE6DC]",
      imgClass: "max-w-[138px] sm:max-w-[155px]",
      lightImage: "/coffe-removebg-preview.png",
      darkImage: "/coffe-removebg-preview.png",
      href: "/smol-menu?category=Signature+Coffees",
      isCustomGraphic: true,
    },
    {
      id: "chai-scene",
      title: "CHAI SCENE",
      subtitle: "Spiced & soothing",
      classes: "bg-[#FDF7E7] border-[#F6E2B3] dark:bg-[#1C1510] dark:border-[#3E2B1A]",
      innerBorder: "border-[#E5CCA0]/80 dark:border-[#3E2B1A]/70",
      titleColor: "text-[#522A08] dark:text-[#F6D096]",
      subColor: "text-[#5C3E28] dark:text-[#E2C79A]",
      imgClass: "max-w-[126px] sm:max-w-[142px]",
      lightImage: "/tea-removebg-preview.png",
      darkImage: "/tea-removebg-preview.png",
      href: "/smol-menu?category=Chai+%26+Comfort",
      isCustomGraphic: true,
    },
    {
      id: "something-light",
      title: "SOMETHING LIGHT",
      subtitle: "Fresh & easy",
      classes: "bg-[#F1F8F2] border-[#D3E5D4] dark:bg-[#121B14] dark:border-[#1F3324]",
      innerBorder: "border-[#C2DFC4]/80 dark:border-[#1F3324]/70",
      titleColor: "text-[#233E2B] dark:text-[#A7D9B1]",
      subColor: "text-[#3C5441] dark:text-[#C5DEC9]",
      imgClass: "max-w-[142px] sm:max-w-[160px]",
      lightImage: "/salad-removebg-preview.png",
      darkImage: "/salad-removebg-preview.png",
      href: "/smol-menu?category=Fresh+Bakes",
      isCustomGraphic: true,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F3E7D3] dark:bg-[#151110] text-[#241F1C] dark:text-[#FAF4EB] pb-28 font-serif selection:bg-[#B72E35]/20 selection:text-[#B72E35] transition-colors duration-200">
      {/* Top App Header */}
      <header className="sticky top-0 z-40 bg-[#F3E7D3]/95 dark:bg-[#181412]/95 backdrop-blur-md px-5 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-2 border-b border-[#C9AE8B]/40 dark:border-white/10 transition-colors duration-200">
        <div className="mx-auto flex max-w-md items-center justify-between">
          {/* Hamburger Menu button */}
          <button
            type="button"
            onClick={() => setIsSideMenuOpen(true)}
            aria-label="Open Navigation Drawer"
            className="p-1.5 -ml-1.5 text-[#241F1C] dark:text-[#FAF4EB] hover:text-[#B72E35] dark:hover:text-[#FF5B52] transition"
          >
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>

          {/* Center Brand Name */}
          <Link href="/home" className="text-center group">
            <h1 className="font-serif text-2xl font-bold tracking-tight text-[#241F1C] dark:text-[#FAF4EB] group-hover:text-[#B72E35] dark:group-hover:text-[#FF5B52] transition">
              smol café
            </h1>
          </Link>

          {/* Header Right: Day/Night Theme Toggle & Profile Avatar */}
          <div className="flex items-center gap-1.5">
            <ThemeToggle variant="icon" />
            <Link
              href="/profile"
              aria-label="View Profile & Rewards"
              className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-[#C9AE8B]/50 dark:border-white/10 bg-[#FAF4EB] dark:bg-[#201A17] text-[#241F1C] dark:text-[#FAF4EB] hover:text-[#B72E35] dark:hover:text-[#FF5B52] transition shadow-xs text-xs font-serif font-bold"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#B72E35] text-white text-[10px] font-mono font-bold">
                {currentGuestName ? currentGuestName.charAt(0).toUpperCase() : "S"}
              </span>
              <span className="hidden sm:inline max-w-[75px] truncate">{currentGuestName || "Pass"}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Home Container */}
      <main className="mx-auto max-w-md px-3.5 sm:px-4 pt-2 space-y-2.5 sm:space-y-3 pb-6">
        {/* Editorial Greeting */}
        <div className="text-center space-y-0.5 pt-0.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#B72E35]/10 dark:bg-[#FF5B52]/15 text-[#B72E35] dark:text-[#FF5B52] text-[10px] sm:text-[11px] font-mono font-bold tracking-wider mb-0.5">
            <span>🪑 {activeTable ? `Table ${activeTable}` : "Dine-in"}</span>
            <span className="opacity-40">•</span>
            <span>{locationName}</span>
          </div>
          <h2 className="font-serif text-lg sm:text-xl font-bold text-[#241F1C] dark:text-[#FAF4EB] tracking-tight leading-tight">
            {getGreeting()}{currentGuestName ? `, ${currentGuestName}` : ""}
          </h2>
          <p className="font-serif italic text-xs sm:text-sm text-[#725039] dark:text-[#C9AE8B]">
            What’re we feeling today?
          </p>
        </div>

        {/* 2x2 Arched Mood Cards Grid (Compact first-fold layout) */}
        <div className="grid grid-cols-2 gap-2 sm:gap-2.5 pt-0.5">
          {moodCards.map((card) => (
            <Link
              key={card.id}
              href={card.href}
              className={`group relative flex flex-col items-center justify-between overflow-hidden rounded-t-[3.75rem] sm:rounded-t-[4.5rem] rounded-b-[1.25rem] sm:rounded-b-[1.5rem] border transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] shadow-xs ${card.classes}`}
            >
              {"isCustomGraphic" in card && card.isCustomGraphic ? (
                <div className="relative w-full aspect-[1/1.24] sm:aspect-[1/1.28] max-h-[185px] sm:max-h-[210px] p-0.5 sm:p-1 select-none">
                  {/* Inner Decorative Arched Frame Border matching original design */}
                  <div className={`w-full h-full rounded-t-[3.45rem] sm:rounded-t-[4.2rem] rounded-b-[1rem] sm:rounded-b-[1.25rem] border ${card.innerBorder} flex flex-col justify-between items-center pt-2 sm:pt-2.5 pb-1 sm:pb-1.5 px-1.5 bg-transparent`}>
                    {/* Top Typography */}
                    <div className="text-center pt-0.5">
                      <h3 className={`font-serif font-bold text-[13.5px] sm:text-[15.5px] ${card.titleColor} tracking-wide uppercase leading-none`}>
                        {card.title}
                      </h3>
                      <p className={`font-serif italic text-[11px] sm:text-[12.5px] ${card.subColor} mt-0.5 font-medium leading-tight`}>
                        {card.subtitle}
                      </p>
                    </div>

                    {/* Centered Illustration (Prominently Enlarged) */}
                    <div className="relative w-full flex-1 flex items-center justify-center -mb-1 px-0.5">
                      <Image
                        src={card.lightImage}
                        alt={card.title}
                        width={240}
                        height={170}
                        className={`w-full ${card.imgClass || "max-w-[140px]"} max-h-[96px] sm:max-h-[115px] object-contain transition-transform duration-300 group-hover:scale-105 select-none pointer-events-none drop-shadow-[0_6px_12px_rgba(0,0,0,0.12)]`}
                        priority
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative w-full aspect-[1/1.24] sm:aspect-[1/1.28] max-h-[185px] sm:max-h-[210px]">
                  {/* Light Mode Card Image */}
                  <Image
                    src={card.lightImage}
                    alt={card.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-102 dark:hidden"
                    priority
                  />
                  {/* Dark Mode Card Image */}
                  <Image
                    src={card.darkImage}
                    alt={card.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-102 hidden dark:block"
                    priority
                  />
                </div>
              )}
            </Link>
          ))}
        </div>

        {/* Today's Blackboard Card (Pure Code Component) */}
        <div className="pt-1 pb-4">
          <TodayBlackboardCard
            title="Today's Blackboard"
            headline="Jaggery Sea-Salt Latte"
            subline="is our new crush."
            href="/smol-menu"
          />
        </div>
      </main>

      {/* Side Drawer for Hamburger Menu */}
      {isSideMenuOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsSideMenuOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-72 max-w-[80vw] bg-[#FBF7F0] dark:bg-[#1C1715] h-full shadow-2xl flex flex-col p-6 z-10 border-r border-[#C9AE8B]/40 dark:border-white/10 transition-colors">
            <div className="flex items-center justify-between pb-4 border-b border-[#C9AE8B]/30 dark:border-white/10">
              <div>
                <span className="font-serif text-xl font-bold text-[#241F1C] dark:text-[#FAF4EB]">
                  smol café
                </span>
                {currentGuestName && (
                  <span className="block font-serif font-bold text-xs text-[#B72E35] dark:text-[#FF5B52]">
                    Welcome, {currentGuestName}
                  </span>
                )}
                <span className="block font-serif italic text-xs text-[#725039] dark:text-[#C9AE8B]">
                  {activeTable ? `Table ${activeTable} • ` : ""}{locationName.toLowerCase()}
                </span>
              </div>
              <button
                onClick={() => setIsSideMenuOpen(false)}
                className="p-1 rounded-full text-[#725039] dark:text-[#C9AE8B] hover:bg-black/5 dark:hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            {/* Nav links */}
            <div className="py-6 space-y-4 font-serif text-base">
              <Link
                href="/home"
                onClick={() => setIsSideMenuOpen(false)}
                className="flex items-center gap-3 text-[#B72E35] dark:text-[#FF5B52] font-bold"
              >
                <span>🏠</span> Home
              </Link>
              <Link
                href="/smol-menu"
                prefetch={true}
                onClick={() => setIsSideMenuOpen(false)}
                className="flex items-center gap-3 text-[#241F1C] dark:text-[#FAF4EB] hover:text-[#B72E35] dark:hover:text-[#FF5B52]"
              >
                <span>☕</span> View Full Menu
              </Link>
              <Link
                href={activeTable ? `/t/table-${activeTable}` : "/home"}
                prefetch={true}
                onClick={() => setIsSideMenuOpen(false)}
                className="flex items-center gap-3 text-[#241F1C] dark:text-[#FAF4EB] hover:text-[#B72E35] dark:hover:text-[#FF5B52]"
              >
                <span>🪑</span> {activeTable ? `Table ${activeTable} Card` : "Select Table"}
              </Link>
              <Link
                href="/orders"
                prefetch={true}
                onClick={() => setIsSideMenuOpen(false)}
                className="flex items-center gap-3 text-[#241F1C] dark:text-[#FAF4EB] hover:text-[#B72E35] dark:hover:text-[#FF5B52]"
              >
                <span>🛍️</span> Live Order Status
              </Link>
              <Link
                href="/bill"
                prefetch={true}
                onClick={() => setIsSideMenuOpen(false)}
                className="flex items-center gap-3 text-[#241F1C] dark:text-[#FAF4EB] hover:text-[#B72E35] dark:hover:text-[#FF5B52]"
              >
                <span>🧾</span> Bill &amp; Split
              </Link>
              <Link
                href="/profile"
                prefetch={true}
                onClick={() => setIsSideMenuOpen(false)}
                className="flex items-center gap-3 text-[#241F1C] dark:text-[#FAF4EB] hover:text-[#B72E35] dark:hover:text-[#FF5B52]"
              >
                <span>👤</span> Loyalty &amp; Rewards (Coming Soon)
              </Link>
              <Link
                href="/home"
                prefetch={true}
                onClick={() => setIsSideMenuOpen(false)}
                className="flex items-center gap-3 text-[#241F1C] dark:text-[#FAF4EB] hover:text-[#B72E35] dark:hover:text-[#FF5B52]"
              >
                <span>✨</span> Welcome Screen
              </Link>
            </div>

            {/* Footer note in Drawer */}
            <div className="mt-auto pt-4 border-t border-[#C9AE8B]/30 dark:border-white/10 text-center">
              <span className="font-serif italic text-xs text-[#725039] dark:text-[#C9AE8B]">
                slow mornings &amp; handcrafted sips
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
