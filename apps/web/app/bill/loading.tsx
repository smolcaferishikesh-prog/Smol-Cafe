import React from "react";

export default function BillLoading() {
  return (
    <div className="min-h-screen bg-[#F3E7D3] dark:bg-[#151110] text-[#241F1C] dark:text-[#FAF4EB] pb-32 animate-fade-in transition-colors">
      <header className="sticky top-0 z-30 bg-[#F3E7D3]/90 dark:bg-[#151110]/90 backdrop-blur-md border-b border-[#C9AE8B]/30 dark:border-white/10 px-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="h-6 w-32 rounded bg-[#E5D7C3] dark:bg-stone-800 animate-pulse" />
          <div className="h-7 w-20 rounded-full bg-[#E5D7C3] dark:bg-stone-800 animate-pulse" />
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-4 space-y-4">
        {/* Bill Summary Card Skeleton */}
        <div className="rounded-3xl border border-[#E2D7C7] dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1C1715] p-5 space-y-4 animate-pulse">
          <div className="flex justify-between items-center">
            <div className="h-5 w-24 rounded bg-[#E5D7C3] dark:bg-stone-800" />
            <div className="h-6 w-20 rounded bg-[#E5D7C3] dark:bg-stone-800" />
          </div>
          <div className="h-px bg-[#E2D7C7] dark:bg-stone-800" />
          <div className="space-y-2">
            <div className="flex justify-between">
              <div className="h-4 w-32 rounded bg-[#E5D7C3]/80 dark:bg-stone-800/80" />
              <div className="h-4 w-16 rounded bg-[#E5D7C3]/80 dark:bg-stone-800/80" />
            </div>
            <div className="flex justify-between">
              <div className="h-4 w-28 rounded bg-[#E5D7C3]/80 dark:bg-stone-800/80" />
              <div className="h-4 w-14 rounded bg-[#E5D7C3]/80 dark:bg-stone-800/80" />
            </div>
          </div>
        </div>

        {/* Pay Button Skeleton */}
        <div className="h-14 w-full rounded-2xl bg-[#B72E35]/40 animate-pulse" />
      </main>
    </div>
  );
}
