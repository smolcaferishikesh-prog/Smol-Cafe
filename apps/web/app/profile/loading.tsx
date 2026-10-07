import React from "react";

export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-[#F3E7D3] dark:bg-[#151110] text-[#241F1C] dark:text-[#FAF4EB] pb-32 animate-fade-in transition-colors">
      {/* Top Header Bar Skeleton */}
      <header className="sticky top-0 z-30 bg-[#F3E7D3]/90 dark:bg-[#151110]/90 backdrop-blur-md border-b border-[#C9AE8B]/30 dark:border-white/10 px-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="h-6 w-32 rounded bg-[#E5D7C3] dark:bg-stone-800 animate-pulse" />
          <div className="h-7 w-20 rounded-full bg-[#E5D7C3] dark:bg-stone-800 animate-pulse" />
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-4 space-y-4">
        {/* User Card Skeleton */}
        <div className="rounded-3xl border border-[#E2D7C7] dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1C1715] p-5 space-y-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-[#E5D7C3] dark:bg-stone-800 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-36 rounded bg-[#E5D7C3] dark:bg-stone-800" />
              <div className="h-3.5 w-24 rounded bg-[#E5D7C3]/70 dark:bg-stone-800/70" />
            </div>
          </div>
        </div>

        {/* Loyalty / Stamp Card Skeleton */}
        <div className="rounded-3xl border border-[#E2D7C7] dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1C1715] p-5 space-y-4 animate-pulse">
          <div className="flex justify-between items-center">
            <div className="h-5 w-28 rounded bg-[#E5D7C3] dark:bg-stone-800" />
            <div className="h-5 w-16 rounded-full bg-[#E5D7C3] dark:bg-stone-800" />
          </div>
          <div className="grid grid-cols-5 gap-2 pt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="aspect-square rounded-2xl bg-[#EAE0D2] dark:bg-[#251E1B]" />
            ))}
          </div>
        </div>

        {/* Past Orders List Skeleton */}
        <div className="space-y-3 pt-2">
          <div className="h-5 w-32 rounded bg-[#E5D7C3] dark:bg-stone-800 animate-pulse" />
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 rounded-2xl border border-[#E2D7C7] dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1C1715] space-y-2 animate-pulse"
            >
              <div className="flex justify-between">
                <div className="h-4 w-1/2 rounded bg-[#E5D7C3] dark:bg-stone-800" />
                <div className="h-4 w-16 rounded bg-[#E5D7C3] dark:bg-stone-800" />
              </div>
              <div className="h-3 w-1/3 rounded bg-[#E5D7C3]/60 dark:bg-stone-800/60" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
