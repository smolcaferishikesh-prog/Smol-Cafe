"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { BudgetAnalyticsOverview, CategoryBudgetVsActual } from "@/app/admin/budgets/actions";
import { fetchBudgetVsActualAction, upsertBudgetAction } from "@/app/admin/budgets/actions";
import { BarChart2, Building2, TrendingUp, TrendingDown, Pencil } from "lucide-react";

interface BudgetAnalyticsManagerProps {
  initialData: BudgetAnalyticsOverview;
}

export const BudgetAnalyticsManager: React.FC<BudgetAnalyticsManagerProps> = ({ initialData }) => {
  const [data, setData] = useState<BudgetAnalyticsOverview>(initialData);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    initialData.selectedMonth || "2026-08"
  );
  const [activeTab, setActiveTab] = useState<"budget" | "vendors" | "prices">("budget");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  // Edit Budget Modal State
  const [editingCategory, setEditingCategory] = useState<CategoryBudgetVsActual | null>(null);
  const [budgetInputRupees, setBudgetInputRupees] = useState<number>(0);
  const [budgetNotes, setBudgetNotes] = useState<string>("");
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleMonthChange = async (newMonth: string) => {
    setSelectedMonth(newMonth);
    try {
      const res = await fetchBudgetVsActualAction(newMonth);
      if (res.success) {
        setData(res);
      }
    } catch {
      setFeedback({ type: "error", text: "Failed to load month data." });
    }
  };

  const handleOpenEditBudget = (cat: CategoryBudgetVsActual) => {
    setEditingCategory(cat);
    setBudgetInputRupees(Math.round(cat.budgetedPaise / 100));
    setBudgetNotes("");
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;

    setIsSavingBudget(true);
    setFeedback(null);

    try {
      const res = await upsertBudgetAction(
        String(editingCategory.category),
        selectedMonth,
        Math.round(budgetInputRupees * 100),
        budgetNotes
      );

      if (res.success) {
        setFeedback({ type: "success", text: res.message || "Budget updated!" });
        setEditingCategory(null);
        // Refresh data
        const fresh = await fetchBudgetVsActualAction(selectedMonth);
        if (fresh.success) setData(fresh);
      } else {
        setFeedback({ type: "error", text: res.message || "Failed to update budget." });
      }
    } catch {
      setFeedback({ type: "error", text: "An error occurred." });
    } finally {
      setIsSavingBudget(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1C1917] pb-24 dark:bg-[#141211] dark:text-[#FDFBF7]">
      {/* Header */}
      <header className="border-b border-stone-200/80 bg-white/70 px-4 py-4 backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-full border border-stone-200 bg-stone-50 p-2 text-stone-600 transition hover:bg-stone-100 dark:border-stone-800 dark:bg-stone-800 dark:text-stone-300"
            >
              ← Back
            </Link>
            <div>
              <h1 className="text-lg font-black tracking-tight text-[#9B2C2C] dark:text-[#F6AD55]">
                Procurement Budget & Spend Analytics
              </h1>
              <p className="text-xs text-stone-500 font-medium">
                Admin Panel • Budget vs Actual, Line-Item Drill-Down & Vendor Audit
              </p>
            </div>
          </div>

          {/* Month Selector */}
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-mono font-bold text-stone-900 shadow-sm focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-6 space-y-6">
        {feedback && (
          <div
            className={`rounded-2xl p-3 text-xs font-bold ${
              feedback.type === "error"
                ? "border border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
                : "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Top KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Total Budget
            </span>
            <p className="text-xl font-black font-mono text-stone-900 dark:text-stone-100 mt-1">
              ₹{Math.round(data.totalBudgetedPaise / 100).toLocaleString("en-IN")}
            </p>
            <span className="text-[10px] text-stone-400 font-mono">Planned allocation</span>
          </div>

          <div className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Actual Spend
            </span>
            <p className="text-xl font-black font-mono text-[#9B2C2C] dark:text-[#F6AD55] mt-1">
              ₹{Math.round(data.totalActualSpendPaise / 100).toLocaleString("en-IN")}
            </p>
            <span className="text-[10px] text-stone-400 font-mono">From Goods Receipts (GRN)</span>
          </div>

          <div className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Net Variance
            </span>
            <p
              className={`text-xl font-black font-mono mt-1 ${
                data.totalVariancePaise >= 0
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {data.totalVariancePaise >= 0 ? "+" : "-"}₹
              {Math.abs(Math.round(data.totalVariancePaise / 100)).toLocaleString("en-IN")}
            </p>
            <span className="text-[10px] text-stone-400 font-mono">
              {data.totalVariancePaise >= 0 ? "Under budget" : "Over budget"}
            </span>
          </div>

          <div className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Budget Utilized
            </span>
            <p className="text-xl font-black font-mono text-stone-900 dark:text-stone-100 mt-1">
              {data.overallPercentageUsed}%
            </p>
            <div className="w-full bg-stone-100 h-1.5 rounded-full mt-1.5 overflow-hidden dark:bg-stone-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  data.overallPercentageUsed > 100
                    ? "bg-red-500"
                    : data.overallPercentageUsed > 80
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, data.overallPercentageUsed)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-stone-200 dark:border-stone-800">
          <button
            onClick={() => setActiveTab("budget")}
            className={`px-4 py-2 text-xs font-bold transition border-b-2 flex items-center gap-1.5 ${
              activeTab === "budget"
                ? "border-[#9B2C2C] text-[#9B2C2C] dark:border-[#F6AD55] dark:text-[#F6AD55]"
                : "border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
            }`}
          >
            <BarChart2 className="h-3.5 w-3.5" />
            Budget vs Actual ({data.categories.length} Categories)
          </button>
          <button
            onClick={() => setActiveTab("vendors")}
            className={`px-4 py-2 text-xs font-bold transition border-b-2 flex items-center gap-1.5 ${
              activeTab === "vendors"
                ? "border-[#9B2C2C] text-[#9B2C2C] dark:border-[#F6AD55] dark:text-[#F6AD55]"
                : "border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            Vendor Spend Summary ({data.vendorSpend.length})
          </button>
          <button
            onClick={() => setActiveTab("prices")}
            className={`px-4 py-2 text-xs font-bold transition border-b-2 flex items-center gap-1.5 ${
              activeTab === "prices"
                ? "border-[#9B2C2C] text-[#9B2C2C] dark:border-[#F6AD55] dark:text-[#F6AD55]"
                : "border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Price Changes & Top Ingredients ({data.priceTrends.length})
          </button>
        </div>

        {/* Tab 1: Category Budget vs Actual */}
        {activeTab === "budget" && (
          <div className="space-y-4">
            {data.categories.map((cat) => {
              const isExpanded = expandedCategory === cat.category;
              const isOver = cat.variancePaise < 0;

              return (
                <div
                  key={cat.category}
                  className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900 space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                        {cat.displayName}
                      </h3>
                      <p className="text-xs text-stone-500 font-mono mt-0.5">
                        Budget: ₹{Math.round(cat.budgetedPaise / 100).toLocaleString("en-IN")} •
                        Spent: ₹{Math.round(cat.actualSpendPaise / 100).toLocaleString("en-IN")}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-bold ${
                          isOver
                            ? "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
                            : cat.percentageUsed > 80
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        }`}
                      >
                        {cat.percentageUsed}% used
                      </span>

                      <button
                        onClick={() => handleOpenEditBudget(cat)}
                        className="rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-bold text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 flex items-center gap-1"
                      >
                        Edit Budget <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Progress Meter */}
                  <div className="space-y-1">
                    <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden dark:bg-stone-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isOver
                            ? "bg-red-500"
                            : cat.percentageUsed > 80
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(100, cat.percentageUsed)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-stone-400">
                      <span>
                        Variance: {isOver ? "-" : "+"}₹
                        {Math.abs(Math.round(cat.variancePaise / 100)).toLocaleString("en-IN")}
                      </span>
                      <span>{cat.lineItemsCount} delivery line items</span>
                    </div>
                  </div>

                  {/* Drill-down Toggle */}
                  <div>
                    <button
                      onClick={() => setExpandedCategory(isExpanded ? null : String(cat.category))}
                      className="text-xs font-bold text-[#9B2C2C] hover:underline dark:text-[#F6AD55] flex items-center gap-1"
                    >
                      {isExpanded ? "▲ Hide Delivery Line Items" : "▼ Drill Down to Line Items"}
                    </button>

                    {isExpanded && (
                      <div className="mt-3 rounded-2xl border border-stone-100 bg-stone-50/70 p-3 dark:border-stone-800 dark:bg-stone-800/40 space-y-2">
                        {cat.lineItems.length === 0 ? (
                          <p className="text-xs text-stone-400 italic">
                            No delivery line items recorded in this month.
                          </p>
                        ) : (
                          <div className="divide-y divide-stone-100 dark:divide-stone-800">
                            {cat.lineItems.map((item) => (
                              <div
                                key={item.id}
                                className="py-2 first:pt-0 last:pb-0 flex items-center justify-between text-xs font-mono"
                              >
                                <div>
                                  <span className="font-bold text-stone-900 dark:text-stone-100">
                                    {item.ingredientName}
                                  </span>
                                  <p className="text-[10px] text-stone-400">
                                    {item.vendorName} • {item.grnNumber} •{" "}
                                    {new Date(item.receivedAt).toLocaleDateString("en-IN", {
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </p>
                                </div>

                                <div className="text-right">
                                  <span className="font-bold text-stone-900 dark:text-stone-100">
                                    ₹{Math.round(item.totalPaise / 100).toLocaleString("en-IN")}
                                  </span>
                                  <p className="text-[10px] text-stone-400">
                                    {item.receivedQty} units @ ₹
                                    {Math.round(item.unitCostPaise / 100)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Vendor Spend Summary */}
        {activeTab === "vendors" && (
          <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-900 dark:text-stone-100">
              Supplier Spend Breakdown ({selectedMonth})
            </h3>

            {data.vendorSpend.length === 0 ? (
              <p className="text-xs text-stone-400 py-6 text-center">
                No vendor deliveries recorded in this month.
              </p>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-stone-800">
                {data.vendorSpend.map((v) => (
                  <div key={v.vendorId} className="py-3 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                        {v.vendorName}
                      </h4>
                      <p className="text-[11px] text-stone-400 font-mono mt-0.5">
                        {v.grnCount} deliveries • Last received{" "}
                        {new Date(v.lastDeliveryAt).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="font-mono text-sm font-black text-stone-900 dark:text-stone-100">
                        ₹{Math.round(v.totalSpendPaise / 100).toLocaleString("en-IN")}
                      </span>
                      <p className="text-[10px] text-stone-400 font-mono">
                        {data.totalActualSpendPaise > 0
                          ? `${Math.round((v.totalSpendPaise / data.totalActualSpendPaise) * 100)}% of total`
                          : "0%"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Price Changes & Top Ingredients */}
        {activeTab === "prices" && (
          <div className="space-y-6">
            {/* Top Ingredients by Spend */}
            <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-stone-900 dark:text-stone-100">
                Top Ingredients by Financial Spend
              </h3>

              {data.topIngredients.length === 0 ? (
                <p className="text-xs text-stone-400 py-4 text-center">
                  No ingredient spend data recorded yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.topIngredients.map((ing) => (
                    <div
                      key={ing.ingredientId}
                      className="rounded-2xl border border-stone-100 bg-stone-50/70 p-3.5 dark:border-stone-800 dark:bg-stone-800/40 flex items-center justify-between"
                    >
                      <div>
                        <span className="text-[10px] font-mono font-bold text-amber-800 dark:text-amber-300">
                          {ing.category}
                        </span>
                        <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                          {ing.ingredientName}
                        </h4>
                        <p className="text-[10px] text-stone-400 font-mono">
                          {ing.totalQty} units ingested
                        </p>
                      </div>

                      <span className="font-mono text-xs font-black text-[#9B2C2C] dark:text-[#F6AD55]">
                        ₹{Math.round(ing.totalSpendPaise / 100).toLocaleString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Price Change Audit Table */}
            <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-stone-900 dark:text-stone-100">
                Unit Purchase Price Trends
              </h3>

              {data.priceTrends.length === 0 ? (
                <p className="text-xs text-stone-400 py-4 text-center">
                  No price history available.
                </p>
              ) : (
                <div className="divide-y divide-stone-100 dark:divide-stone-800">
                  {data.priceTrends.map((pt) => (
                    <div key={pt.ingredientId} className="py-3 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-mono text-stone-400">{pt.category}</span>
                        <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                          {pt.ingredientName}
                        </h4>
                      </div>

                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <span className="font-mono text-xs font-bold text-stone-900 dark:text-stone-100">
                            ₹{Math.round(pt.latestCostPaise / 100)} / unit
                          </span>
                          {pt.previousCostPaise && (
                            <p className="text-[10px] font-mono text-stone-400">
                              Prev: ₹{Math.round(pt.previousCostPaise / 100)}
                            </p>
                          )}
                        </div>

                        {pt.percentageChange !== null && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-bold flex items-center gap-1 ${
                              pt.percentageChange > 0
                                ? "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
                                : pt.percentageChange < 0
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
                            }`}
                          >
                            {pt.percentageChange > 0 ? (
                              <>
                                <TrendingUp className="h-3 w-3" /> +
                              </>
                            ) : pt.percentageChange < 0 ? (
                              <TrendingDown className="h-3 w-3" />
                            ) : (
                              "— "
                            )}
                            {Math.abs(pt.percentageChange)}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Edit Budget Modal */}
      {mounted && editingCategory && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 dark:bg-black/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl dark:border-stone-800 dark:bg-stone-900 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Edit {editingCategory.displayName}
              </h3>
              <button
                onClick={() => setEditingCategory(null)}
                className="text-stone-400 hover:text-stone-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                  Budget Amount (₹) for {selectedMonth}
                </label>
                <input
                  type="number"
                  value={budgetInputRupees}
                  onChange={(e) => setBudgetInputRupees(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-sm font-mono font-bold text-stone-900 focus:border-[#9B2C2C] focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                  Notes / Rationale (Optional)
                </label>
                <input
                  type="text"
                  value={budgetNotes}
                  onChange={(e) => setBudgetNotes(e.target.value)}
                  placeholder="e.g. Higher allocation for festival season"
                  className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:border-[#9B2C2C] focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingBudget}
                  className="flex-1 rounded-2xl bg-[#9B2C2C] py-2.5 text-xs font-bold text-white shadow hover:bg-[#822424] disabled:opacity-50 dark:bg-[#C53030]"
                >
                  {isSavingBudget ? "Saving..." : "Save Budget"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="rounded-2xl border border-stone-300 px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
