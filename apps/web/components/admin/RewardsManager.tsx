"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Reward, RewardType } from "@smol-cafe/db";
import {
  createRewardAction,
  toggleRewardActiveAction,
  fetchRewardsAction,
  type CreateRewardInput,
} from "@/app/admin/rewards/actions";
import { broadcastSyncEvent, subscribeToSyncEvents } from "@/lib/sync-events";

interface RewardsManagerProps {
  initialRewards: Reward[];
}

export const RewardsManager: React.FC<RewardsManagerProps> = ({ initialRewards }) => {
  const router = useRouter();
  const [rewards, setRewards] = useState<Reward[]>(initialRewards);
  const [isCreating, setIsCreating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const refreshRewards = useCallback(async () => {
    try {
      const res = await fetchRewardsAction();
      if (res.success && res.rewards) {
        setRewards(res.rewards);
      } else {
        router.refresh();
      }
    } catch {
      router.refresh();
    }
  }, [router]);

  useEffect(() => {
    const unsub = subscribeToSyncEvents((event) => {
      if (event.type === "LOYALTY_UPDATED" || event.type === "SETTINGS_UPDATED") {
        refreshRewards();
      }
    });

    const handleFocus = () => {
      refreshRewards();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleFocus);

    return () => {
      unsub();
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleFocus);
    };
  }, [refreshRewards]);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<RewardType>("FIXED_VALUE");
  const [discountValue, setDiscountValue] = useState("50");
  const [pointsCost, setPointsCost] = useState("50");
  const [expiryDays, setExpiryDays] = useState("30");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const numericDiscount = parseFloat(discountValue);
    const numericPoints = parseInt(pointsCost, 10);
    const numericExpiry = parseInt(expiryDays, 10);

    if (isNaN(numericDiscount) || numericDiscount <= 0) {
      setFeedback({ type: "error", text: "Please enter a valid discount value." });
      return;
    }

    if (isNaN(numericPoints) || numericPoints <= 0) {
      setFeedback({ type: "error", text: "Please enter a valid points cost." });
      return;
    }

    const payload: CreateRewardInput = {
      name,
      description,
      type,
      discountValue: type === "PERCENTAGE" ? numericDiscount : Math.round(numericDiscount * 100),
      pointsCost: numericPoints,
      expiryDays: isNaN(numericExpiry) ? 30 : numericExpiry,
      active: true,
    };

    setIsCreating(true);
    try {
      const res = await createRewardAction(payload);
      if (res.success && res.reward) {
        setRewards((prev) => [...prev, res.reward!]);
        setName("");
        setDescription("");
        setDiscountValue("50");
        setPointsCost("50");
        setFeedback({ type: "success", text: res.message || "Reward created!" });
        broadcastSyncEvent({ type: "LOYALTY_UPDATED", timestamp: Date.now() });
      } else {
        setFeedback({ type: "error", text: res.message || "Failed to create reward." });
      }
    } catch {
      setFeedback({ type: "error", text: "An error occurred." });
    } finally {
      setIsCreating(false);
    }
  };

  const togglingIdsRef = React.useRef<Set<string>>(new Set());

  const handleToggle = async (reward: Reward) => {
    if (togglingIdsRef.current.has(reward.id)) return;
    togglingIdsRef.current.add(reward.id);

    const targetActive = !reward.active;
    const prevRewards = rewards;

    // Instant 0ms Optimistic UI Update
    setRewards((prev) =>
      prev.map((r) => (r.id === reward.id ? { ...r, active: targetActive } : r))
    );

    try {
      const res = await toggleRewardActiveAction(reward.id, targetActive);
      if (res.success && res.reward) {
        setRewards((prev) => prev.map((r) => (r.id === reward.id ? res.reward! : r)));
        broadcastSyncEvent({ type: "LOYALTY_UPDATED", timestamp: Date.now() });
      } else {
        setRewards(prevRewards); // Rollback
        setFeedback({ type: "error", text: res.message || "Failed to toggle reward status." });
      }
    } catch {
      setRewards(prevRewards); // Rollback
      setFeedback({ type: "error", text: "Failed to toggle reward status." });
    } finally {
      togglingIdsRef.current.delete(reward.id);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1C1917] pb-24 dark:bg-[#141211] dark:text-[#FDFBF7]">
      {/* Top Bar */}
      <header className="border-b border-stone-200/80 bg-white/70 px-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-4 backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-full border border-stone-200 bg-stone-50 p-2 text-stone-600 transition hover:bg-stone-100 dark:border-stone-800 dark:bg-stone-800 dark:text-stone-300"
            >
              ← Back
            </Link>
            <div>
              <h1 className="text-lg font-black tracking-tight text-[#9B2C2C] dark:text-[#F6AD55]">
                Rewards Catalog Manager
              </h1>
              <p className="text-xs text-stone-500 font-medium">
                Admin Panel • Loyalty & Redemption Rules
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/kitchen"
              className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-bold text-stone-600 transition hover:bg-stone-100 dark:border-stone-800 dark:bg-stone-800 dark:text-stone-300"
            >
              Kitchen KDS
            </Link>
            <Link
              href="/cashier"
              className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-bold text-stone-600 transition hover:bg-stone-100 dark:border-stone-800 dark:bg-stone-800 dark:text-stone-300"
            >
              Cashier POS
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Col: Create Reward Form */}
        <div className="md:col-span-1">
          <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-stone-900 dark:text-stone-100">
              Create New Reward
            </h2>

            {feedback && (
              <p
                className={`rounded-xl p-2.5 text-xs font-semibold ${
                  feedback.type === "error"
                    ? "border border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
                    : "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                }`}
              >
                {feedback.text}
              </p>
            )}

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                  Reward Title
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. ₹50 Off Any Order"
                  required
                  className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:border-[#9B2C2C] focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short customer description"
                  rows={2}
                  className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:border-[#9B2C2C] focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                    Discount Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as RewardType)}
                    className="w-full rounded-xl border border-stone-300 bg-stone-50 px-2 py-2 text-xs text-stone-900 focus:border-[#9B2C2C] focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                  >
                    <option value="FIXED_VALUE">Flat ₹ Off</option>
                    <option value="PERCENTAGE">% Percentage</option>
                    <option value="FIXED_ITEM">Item Treat</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                    {type === "PERCENTAGE" ? "% Discount" : "₹ Amount"}
                  </label>
                  <input
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    required
                    min="1"
                    className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:border-[#9B2C2C] focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                    Points Cost
                  </label>
                  <input
                    type="number"
                    value={pointsCost}
                    onChange={(e) => setPointsCost(e.target.value)}
                    required
                    min="1"
                    className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:border-[#9B2C2C] focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                    Expiry (Days)
                  </label>
                  <input
                    type="number"
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(e.target.value)}
                    min="1"
                    className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:border-[#9B2C2C] focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreating || !name.trim()}
                className="w-full rounded-2xl bg-[#9B2C2C] py-3 text-xs font-bold text-white shadow-md transition hover:bg-[#822424] active:scale-95 disabled:opacity-50 dark:bg-[#C53030]"
              >
                {isCreating ? "Creating..." : "+ Add to Catalog"}
              </button>
            </form>
          </div>
        </div>

        {/* Right Col: Rewards List */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-stone-500">
              Active Catalog Rewards ({rewards.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rewards.map((reward) => (
              <div
                key={reward.id}
                className={`rounded-2xl border p-4 shadow-sm transition space-y-3 ${
                  reward.active
                    ? "border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900"
                    : "border-stone-200 bg-stone-100/60 opacity-60 dark:border-stone-800 dark:bg-stone-900/40"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                      {reward.name}
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">{reward.description}</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 font-mono">
                    🪙 {reward.points_cost} pts
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-stone-100 pt-3 dark:border-stone-800 text-xs">
                  <span className="font-mono text-stone-600 dark:text-stone-400">
                    {reward.type === "PERCENTAGE"
                      ? `${reward.discount_value}% Discount`
                      : `₹${Math.round(reward.discount_value / 100)} Off`}
                  </span>

                  <button
                    onClick={() => handleToggle(reward)}
                    className={`rounded-xl px-3 py-1 text-[11px] font-bold transition ${
                      reward.active
                        ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300"
                        : "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    }`}
                  >
                    {reward.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};
