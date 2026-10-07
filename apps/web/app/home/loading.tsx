import React from "react";

export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-[#F3E7D3] dark:bg-[#151110] text-[#241F1C] dark:text-[#FAF4EB] pb-32 animate-fade-in transition-colors">
      {/* Header Skeleton */}
      <header className="sticky top-0 z-30 bg-[#F3E7D3]/90 dark:bg-[#151110]/90 backdrop-blur-md border-b border-[#C9AE8B]/30 dark:border-white/10 px-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-[#E5D7C3] dark:bg-stone-800 animate-pulse" />
            <div className="h-6 w-24 rounded bg-[#E5D7C3] dark:bg-stone-800 animate-pulse" />
          </div>
          <div className="h-7 w-20 rounded-full bg-[#E5D7C3] dark:bg-stone-800 animate-pulse" />
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-4 space-y-4">
        {/* Hero Card Skeleton */}
        <div className="h-44 w-full rounded-3xl bg-[#FAF4EB] dark:bg-[#1C1715] border border-[#E2D7C7] dark:border-stone-800 p-5 space-y-3 animate-pulse">
          <div className="h-4 w-32 rounded bg-[#E5D7C3] dark:bg-stone-800" />
          <div className="h-8 w-48 rounded-lg bg-[#E5D7C3] dark:bg-stone-800" />
          <div className="h-3.5 w-60 rounded bg-[#E5D7C3]/70 dark:bg-stone-800/70" />
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="h-28 rounded-2xl bg-[#FAF4EB] dark:bg-[#1C1715] border border-[#E2D7C7] dark:border-stone-800 animate-pulse" />
          <div className="h-28 rounded-2xl bg-[#FAF4EB] dark:bg-[#1C1715] border border-[#E2D7C7] dark:border-stone-800 animate-pulse" />
        </div>

        {/* Specials Carousel */}
        <div className="space-y-2 pt-2">
          <div className="h-5 w-36 rounded bg-[#E5D7C3] dark:bg-stone-800 animate-pulse" />
          <div className="flex gap-3 overflow-hidden">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-36 w-48 shrink-0 rounded-2xl bg-[#FAF4EB] dark:bg-[#1C1715] border border-[#E2D7C7] dark:border-stone-800 animate-pulse"
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
