import React from "react";

export default function MenuLoading() {
  return (
    <div className="min-h-screen bg-[#F3E7D3] dark:bg-[#151110] text-[#241F1C] dark:text-[#FAF4EB] pb-32 animate-fade-in transition-colors">
      {/* Top Header Bar Skeleton */}
      <header className="sticky top-0 z-30 bg-[#F3E7D3]/90 dark:bg-[#151110]/90 backdrop-blur-md border-b border-[#C9AE8B]/30 dark:border-white/10 px-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-24 rounded-lg bg-[#E5D7C3] dark:bg-stone-800 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-20 rounded-full bg-[#E5D7C3] dark:bg-stone-800 animate-pulse" />
            <div className="h-8 w-8 rounded-full bg-[#E5D7C3] dark:bg-stone-800 animate-pulse" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-4 space-y-4">
        {/* Search Bar Skeleton */}
        <div className="h-11 w-full rounded-2xl bg-[#EAE0D2] dark:bg-[#201A18] border border-[#C9AE8B]/20 dark:border-white/5 animate-pulse" />

        {/* Category Pills Strip */}
        <div className="flex gap-2 overflow-x-hidden py-1">
          {["All Items", "☕ All-Day Brews", "🥐 Bakery & Treats", "🍳 Breakfast", "🥪 Sandwiches"].map((_, i) => (
            <div
              key={i}
              className="h-8 w-28 shrink-0 rounded-full bg-[#E5D7C3] dark:bg-[#221C1A] animate-pulse"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>

        {/* Category Section Header */}
        <div className="pt-2 flex items-center justify-between">
          <div className="h-6 w-36 rounded-md bg-[#E5D7C3] dark:bg-stone-800 animate-pulse" />
          <div className="h-4 w-12 rounded-md bg-[#E5D7C3]/60 dark:bg-stone-800/60 animate-pulse" />
        </div>

        {/* Menu Item Cards Skeleton (Matching Horizontal MenuItemCard) */}
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div
              key={idx}
              className="flex items-start justify-between gap-3.5 rounded-2xl border border-[#C9AE8B]/40 dark:border-white/10 bg-[#FAF4EB] dark:bg-[#201A17] p-3.5 animate-pulse shadow-xs"
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              {/* Details column */}
              <div className="flex-1 min-w-0 pr-2 space-y-2">
                {/* Title and dietary dot */}
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#75AFA7]/60 shrink-0" />
                  <div className="h-4 w-40 rounded bg-[#E5D7C3] dark:bg-stone-800" />
                </div>
                {/* Description lines */}
                <div className="space-y-1.5 pt-1">
                  <div className="h-3 w-full rounded bg-[#E5D7C3]/70 dark:bg-stone-800/70" />
                  <div className="h-3 w-3/4 rounded bg-[#E5D7C3]/50 dark:bg-stone-800/50" />
                </div>
              </div>

              {/* Price on right */}
              <div className="shrink-0 pt-0.5">
                <div className="h-4 w-12 rounded bg-[#E5D7C3] dark:bg-stone-800" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
