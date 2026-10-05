"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Reward, RewardType } from "@smol-cafe/db";
import { broadcastSyncEvent } from "@/lib/sync-events";

export interface CreateRewardInput {
  name: string;
  description?: string;
  type: RewardType;
  discountValue: number; // paise for FIXED_VALUE, percentage for PERCENTAGE
  pointsCost: number;
  expiryDays?: number;
  active?: boolean;
}

export interface RewardMutationResult {
  success: boolean;
  reward?: Reward;
  message?: string;
  error?: string;
}

/**
 * Server Action: Fetches all active and inactive rewards
 */
export async function fetchRewardsAction(): Promise<{
  rewards: Reward[];
  success: boolean;
}> {
  const supabase = createAdminClient();

  try {
    const { data: rewards, error } = await supabase
      .from("rewards")
      .select("*")
      .order("points_cost", { ascending: true });

    if (error) {
      console.error("Error fetching rewards:", error);
      return { rewards: [], success: false };
    }

    return {
      rewards: (rewards as Reward[]) || [],
      success: true,
    };
  } catch (err) {
    console.error("Error in fetchRewardsAction:", err);
    return { rewards: [], success: false };
  }
}

import { requireStaffAuth } from "@/lib/auth/rbac";

/**
 * Server Action: Admin creates a new reward
 */
export async function createRewardAction(input: CreateRewardInput): Promise<RewardMutationResult> {
  const auth = await requireStaffAuth(["admin", "super_admin"]);
  if (!auth.authorized) {
    return { success: false, error: auth.error, message: auth.message || "Unauthorized." };
  }

  const supabase = createAdminClient();

  if (!input.name.trim()) {
    return { success: false, message: "Reward name is required." };
  }

  if (input.pointsCost <= 0) {
    return { success: false, message: "Points cost must be greater than 0." };
  }

  try {
    const { data: reward, error } = await supabase
      .from("rewards")
      .insert({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        type: input.type,
        discount_value: input.discountValue,
        points_cost: input.pointsCost,
        expiry_days: input.expiryDays || 30,
        active: input.active !== undefined ? input.active : true,
      })
      .select("*")
      .single();

    if (error || !reward) {
      console.error("Error creating reward:", error);
      return { success: false, message: "Failed to create reward." };
    }

    broadcastSyncEvent({
      type: "LOYALTY_UPDATED",
      metadata: { entity: "reward", action: "create", id: reward.id },
      timestamp: Date.now(),
    });

    return {
      success: true,
      reward: reward as Reward,
      message: `Reward "${input.name}" created successfully.`,
    };
  } catch (err) {
    console.error("Error in createRewardAction:", err);
    return { success: false, message: "An unexpected error occurred." };
  }
}

/**
 * Server Action: Admin toggles reward active status
 */
export async function toggleRewardActiveAction(
  id: string,
  active: boolean
): Promise<RewardMutationResult> {
  const auth = await requireStaffAuth(["admin", "super_admin"]);
  if (!auth.authorized) {
    return { success: false, error: auth.error, message: auth.message || "Unauthorized." };
  }

  const supabase = createAdminClient();

  try {
    const { data: reward, error } = await supabase
      .from("rewards")
      .update({ active, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();

    if (error || !reward) {
      return { success: false, message: "Failed to update reward status." };
    }

    broadcastSyncEvent({
      type: "LOYALTY_UPDATED",
      metadata: { entity: "reward", action: "toggle", id, active },
      timestamp: Date.now(),
    });

    return {
      success: true,
      reward: reward as Reward,
      message: `Reward is now ${active ? "active" : "inactive"}.`,
    };
  } catch (err) {
    console.error("Error in toggleRewardActiveAction:", err);
    return { success: false, message: "Failed to toggle reward." };
  }
}
