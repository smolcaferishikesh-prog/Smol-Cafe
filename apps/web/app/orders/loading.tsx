import React from "react";

export default function OrdersLoading() {
  return (
    <div className="min-h-screen bg-[#F3E7D3] dark:bg-[#151110] text-[#241F1C] dark:text-[#FAF4EB] pb-32 animate-fade-in transition-colors">
      <header className="sticky top-0 z-30 bg-[#F3E7D3]/90 dark:bg-[#151110]/90 backdrop-blur-md border-b border-[#C9AE8B]/30 dark:border-white/10 px-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="h-6 w-32 rounded bg-[#E5D7C3] dark:bg-stone-800 animate-pulse" />
          <div className="h-7 w-20 rounded-full bg-[#E5D7C3] dark:bg-stone-800 animate-pulse" />
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-4 space-y-4">
        {/* Order Status Timeline Skeleton */}
        <div className="rounded-3xl border border-[#E2D7C7] dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1C1715] p-5 space-y-4 animate-pulse">
          <div className="flex justify-between items-center">
            <div className="h-5 w-24 rounded bg-[#E5D7C3] dark:bg-stone-800" />
            <div className="h-5 w-16 rounded-full bg-[#E5D7C3] dark:bg-stone-800" />
          </div>
          <div className="h-10 w-full rounded-2xl bg-[#EAE0D2] dark:bg-[#251E1B]" />
        </div>

        {/* Items List Skeleton */}
        <div className="space-y-3 pt-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="p-4 rounded-2xl border border-[#E2D7C7] dark:border-stone-800 bg-[#FAF4EB] dark:bg-[#1C1715] space-y-2 animate-pulse"
            >
              <div className="h-4 w-3/4 rounded bg-[#E5D7C3] dark:bg-stone-800" />
              <div className="h-3 w-1/2 rounded bg-[#E5D7C3]/60 dark:bg-stone-800/60" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
