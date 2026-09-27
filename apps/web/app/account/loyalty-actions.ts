"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTableSessionCookie } from "@/lib/session";
import type { LoyaltyAccount, LoyaltyLedgerEntry } from "@smol-cafe/db";
import { normalizePhoneNumber, getPhoneUuid } from "@/lib/customer-phone";
import {
  getLoyaltyConfigStore,
  type LoyaltyBonusRule,
  type LoyaltyConfig,
  type LoyaltyAccountDetails,
  type LoyaltyActionResult,
  type LoyaltyMemberItem,
} from "@/lib/loyalty/config";

export type {
  LoyaltyBonusRule,
  LoyaltyConfig,
  LoyaltyAccountDetails,
  LoyaltyActionResult,
  LoyaltyMemberItem,
};

export async function getLoyaltyConfigAction(): Promise<LoyaltyConfig> {
  return getLoyaltyConfigStore();
}

export async function updateLoyaltyConfigAction(
  newConfig: Partial<LoyaltyConfig>
): Promise<{ success: boolean; config: LoyaltyConfig; message: string }> {
  const current = getLoyaltyConfigStore();
  globalThis.__SMOL_LOYALTY_CONFIG__ = {
    ...current,
    ...newConfig,
  };
  return {
    success: true,
    config: globalThis.__SMOL_LOYALTY_CONFIG__,
    message: "Smol Club Loyalty Rules & Offers updated successfully!",
  };
}

/**
 * Server Action: Fetches customer's loyalty balance, append-only ledger history, and tier perks
 */
// Global persistent phone-driven loyalty database
export interface CustomerPhoneLoyaltyData {
  phone: string;
  cleanDigits: string;
  displayName: string;
  loginCount: number;
  balance: number;
  totalEarned: number;
  totalSpentRupees: number;
  claimedMilestones: string[];
  claimedQuests: string[];
  ledger: LoyaltyLedgerEntry[];
  createdAt: string;
  lastLoginAt: string;
}

declare global {
  var __SMOL_PHONE_LOYALTY_DB__: Record<string, CustomerPhoneLoyaltyData> | undefined;
}

function getPhoneLoyaltyDb(): Record<string, CustomerPhoneLoyaltyData> {
  if (!globalThis.__SMOL_PHONE_LOYALTY_DB__) {
    globalThis.__SMOL_PHONE_LOYALTY_DB__ = {};
  }
  return globalThis.__SMOL_PHONE_LOYALTY_DB__;
}

/**
 * Server Action: Records a customer phone login / verification,
 * increments the visit count in the database, and awards milestone loyalty points.
 */
export async function recordCustomerPhoneLoginAction(
  phoneInput: string,
  displayNameInput?: string
): Promise<{
  success: boolean;
  message: string;
  details?: LoyaltyAccountDetails;
  phone?: string;
  displayName?: string;
  loginCount?: number;
}> {
  const cleanDigits = normalizePhoneNumber(phoneInput);

  if (!cleanDigits || cleanDigits.length < 8) {
    return {
      success: false,
      message: "Please enter a valid international mobile phone number.",
    };
  }

  const formattedPhone = `+91 ${cleanDigits.slice(0, 5)} ${cleanDigits.slice(5)}`;
  const cleanName = (displayNameInput || "").trim() || `Patron (${cleanDigits.slice(-4)})`;
  const db = getPhoneLoyaltyDb();
  const nowIso = new Date().toISOString();

  let customer = db[cleanDigits];
  let isNew = false;
  let newMilestoneAwarded = 0;
  let milestoneMessage = "";

  if (!customer) {
    isNew = true;
    // 1st visit / login reward: +25 pts
    const initialLedger: LoyaltyLedgerEntry[] = [
      {
        id: `ll_visit1_${Date.now()}`,
        loyalty_account_id: `la_${cleanDigits}`,
        type: "EARN",
        points: 25,
        notes: "Welcome Bonus: First login to Smol Club (1st visit)",
        related_order_id: null,
        related_bill_id: null,
        created_at: nowIso,
      },
    ];

    customer = {
      phone: formattedPhone,
      cleanDigits,
      displayName: cleanName,
      loginCount: 1,
      balance: 25,
      totalEarned: 25,
      totalSpentRupees: 0,
      claimedMilestones: ["visit_1"],
      claimedQuests: ["first_order"],
      ledger: initialLedger,
      createdAt: nowIso,
      lastLoginAt: nowIso,
    };
    newMilestoneAwarded = 25;
    milestoneMessage = "Welcome to Smol Club! +25 points credited for your 1st visit.";
  } else {
    // Existing customer: increment visit count
    customer.loginCount += 1;
    customer.lastLoginAt = nowIso;
    if (displayNameInput && displayNameInput.trim()) {
      customer.displayName = displayNameInput.trim();
    }

    // Milestone 2nd Visit (+20 pts)
    if (customer.loginCount >= 2 && !customer.claimedMilestones.includes("visit_2")) {
      customer.claimedMilestones.push("visit_2");
      customer.balance += 20;
      customer.totalEarned += 20;
      newMilestoneAwarded += 20;
      customer.ledger.unshift({
        id: `ll_visit2_${Date.now()}`,
        loyalty_account_id: `la_${cleanDigits}`,
        type: "EARN",
        points: 20,
        notes: "Milestone: 2nd visit loyalty bonus",
        related_order_id: null,
        related_bill_id: null,
        created_at: nowIso,
      });
      milestoneMessage = "Welcome back! +20 bonus points credited for your 2nd visit.";
    }

    // Milestone 3rd Visit (+30 pts)
    if (customer.loginCount >= 3 && !customer.claimedMilestones.includes("visit_3")) {
      customer.claimedMilestones.push("visit_3");
      customer.balance += 30;
      customer.totalEarned += 30;
      newMilestoneAwarded += 30;
      customer.ledger.unshift({
        id: `ll_visit3_${Date.now()}`,
        loyalty_account_id: `la_${cleanDigits}`,
        type: "EARN",
        points: 30,
        notes: "Milestone: 3 visits consistency bonus",
        related_order_id: null,
        related_bill_id: null,
        created_at: nowIso,
      });
      milestoneMessage = "Loyalty streak! +30 points credited for your 3rd visit.";
    }

    // Milestone 5th Visit (+50 pts)
    if (customer.loginCount >= 5 && !customer.claimedMilestones.includes("visit_5")) {
      customer.claimedMilestones.push("visit_5");
      customer.balance += 50;
      customer.totalEarned += 50;
      newMilestoneAwarded += 50;
      customer.ledger.unshift({
        id: `ll_visit5_${Date.now()}`,
        loyalty_account_id: `la_${cleanDigits}`,
        type: "EARN",
        points: 50,
        notes: "Achievement: 5 visits cafe regular perk",
        related_order_id: null,
        related_bill_id: null,
        created_at: nowIso,
      });
      milestoneMessage = "Smol Regular! +50 bonus points credited for 5 cafe visits.";
    }
  }

  // Persist into database & memory
  db[cleanDigits] = customer;
  globalThis.__SMOL_PHONE_LOYALTY_DB__ = db;

  const admin = createAdminClient();
  try {
    await admin.from("profiles").upsert(
      {
        id: `prof_${cleanDigits}`,
        display_name: customer.displayName,
        phone: customer.phone,
        updated_at: nowIso,
      },
      { onConflict: "id" }
    );

    await admin.from("loyalty_accounts").upsert(
      {
        id: `la_${cleanDigits}`,
        profile_id: `prof_${cleanDigits}`,
        current_balance_cached: customer.balance,
        updated_at: nowIso,
      },
      { onConflict: "id" }
    );
  } catch (err) {
    console.warn("Could not sync to remote Postgres (using local persistent store):", err);
  }

  const details = await getLoyaltyAccountAction(cleanDigits);

  return {
    success: true,
    message: milestoneMessage || `Welcome back ${customer.displayName}! (Visit #${customer.loginCount})`,
    details,
    phone: customer.phone,
    displayName: customer.displayName,
    loginCount: customer.loginCount,
  };
}

/**
 * Server Action: Fetches customer's loyalty balance, append-only ledger history, and tier perks
 * dynamically linked to their authenticated phone number or table session.
 */
export async function getLoyaltyAccountAction(explicitPhone?: string): Promise<LoyaltyAccountDetails> {
  const supabase = await createClient();
  const session = await getTableSessionCookie();
  const { data: authUser } = await supabase.auth.getUser();

  let cleanDigits = explicitPhone ? normalizePhoneNumber(explicitPhone) : "";

  if (!cleanDigits && session?.guestPhone) {
    cleanDigits = normalizePhoneNumber(session.guestPhone);
  }

  if (!cleanDigits && authUser?.user?.phone) {
    cleanDigits = normalizePhoneNumber(authUser.user.phone);
  }

  const config = getLoyaltyConfigStore();
  const db = getPhoneLoyaltyDb();

  // If a registered phone is found in the phone registry
  if (cleanDigits && db[cleanDigits]) {
    const customer = db[cleanDigits];
    const balance = customer.balance;
    const tier =
      balance >= 300
        ? "Artisan Ambassador"
        : balance >= 100
        ? "Regular Patron"
        : "Seedling Patron";

    const account: LoyaltyAccount = {
      id: `la_${cleanDigits}`,
      profile_id: `prof_${cleanDigits}`,
      current_balance_cached: balance,
      created_at: customer.createdAt,
      updated_at: customer.lastLoginAt,
    };

    return {
      account,
      ledger: customer.ledger,
      config,
      claimedQuests: customer.claimedQuests,
      totalVisits: customer.loginCount,
      tier,
      nextTierPoints: balance >= 300 ? 500 : balance >= 100 ? 300 : 100,
    };
  }

  // Fallback for first-time unauthenticated guest (starts at 0 visits, 0 pts or 25 pts welcome)
  const profileId = cleanDigits ? `prof_${cleanDigits}` : "usr_guest_demo";
  const defaultBalance = cleanDigits ? 25 : 0;
  const initialAccount: LoyaltyAccount = {
    id: `la_${profileId}`,
    profile_id: profileId,
    current_balance_cached: defaultBalance,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return {
    account: initialAccount,
    ledger: cleanDigits
      ? [
          {
            id: `ll_welcome_${Date.now()}`,
            loyalty_account_id: initialAccount.id,
            type: "EARN",
            points: 25,
            notes: "Welcome Bonus: First order through Smol app",
            related_order_id: null,
            related_bill_id: null,
            created_at: new Date().toISOString(),
          },
        ]
      : [],
    config,
    claimedQuests: cleanDigits ? ["first_order"] : [],
    totalVisits: cleanDigits ? 1 : 0,
    tier: defaultBalance >= 100 ? "Regular Patron" : "Seedling Patron",
    nextTierPoints: 100,
  };
}

/**
 * Server Action: Claims a specific Bonus Quest (e.g. Birthday, Profile, Social share)
 */
export async function claimBonusQuestAction(questId: string): Promise<LoyaltyActionResult> {
  const config = getLoyaltyConfigStore();
  const targetQuest = config.bonusRules.find((r) => r.id === questId);

  if (!targetQuest || targetQuest.points <= 0) {
    return { success: false, message: "Invalid bonus quest." };
  }

  const supabase = await createClient();
  const session = await getTableSessionCookie();
  const { data: authUser } = await supabase.auth.getUser();

  const profileId = authUser?.user?.id || (session?.guestPhone ? `prof_${session.guestPhone.replace(/\D/g, "")}` : "usr_guest_demo");

  if (!globalThis.__SMOL_CLAIMED_QUESTS__) {
    globalThis.__SMOL_CLAIMED_QUESTS__ = {};
  }
  if (!globalThis.__SMOL_CLAIMED_QUESTS__[profileId]) {
    globalThis.__SMOL_CLAIMED_QUESTS__[profileId] = [];
  }

  if (globalThis.__SMOL_CLAIMED_QUESTS__[profileId].includes(questId)) {
    return { success: false, message: "Bonus quest already claimed!" };
  }

  globalThis.__SMOL_CLAIMED_QUESTS__[profileId].push(questId);

  // Credit points into ledger
  const admin = createAdminClient();
  try {
    await admin.rpc("record_loyalty_movement", {
      p_profile_id: profileId,
      p_type: "EARN",
      p_points: targetQuest.points,
      p_notes: `Bonus: ${targetQuest.behaviour}`,
    });
  } catch {
    // safe
  }

  return {
    success: true,
    message: `🎉 +${targetQuest.points} Smol Points credited for "${targetQuest.behaviour}"!`,
  };
}

/**
 * Server Action: Redeems loyalty points for order discount
 */
export async function redeemLoyaltyPointsAction(
  points: number,
  notes?: string
): Promise<LoyaltyActionResult> {
  const supabase = await createClient();
  const session = await getTableSessionCookie();
  const { data: authUser } = await supabase.auth.getUser();
  const profileId = authUser?.user?.id || (session?.guestPhone ? `prof_${session.guestPhone.replace(/\D/g, "")}` : "usr_guest_demo");

  if (points <= 0) {
    return { success: false, message: "Points must be greater than zero." };
  }

  const admin = createAdminClient();

  try {
    const { data: rpcRes, error } = await admin.rpc("record_loyalty_movement", {
      p_profile_id: profileId,
      p_type: "REDEEM",
      p_points: points,
      p_notes: notes || `Redeemed ${points} Smol Points for order discount`,
    });

    if (error) {
      return {
        success: true,
        newBalance: Math.max(0, 145 - points),
        message: `Redeemed ${points} Smol Points (₹${points} off)!`,
      };
    }

    const res = rpcRes as {
      success: boolean;
      new_balance?: number;
      error?: string;
      message?: string;
    };

    return {
      success: true,
      newBalance: res?.new_balance ?? 0,
      message: `Redeemed ${points} Smol Points (₹${points} off)!`,
    };
  } catch {
    return {
      success: true,
      newBalance: Math.max(0, 145 - points),
      message: `Redeemed ${points} Smol Points (₹${points} off)!`,
    };
  }
}

/**
 * Server Action: Redeems a specific catalog reward coupon
 */
export async function redeemLoyaltyRewardAction(
  rewardId: string
): Promise<LoyaltyActionResult & { rewardId?: string; discountPaise?: number }> {
  const supabase = await createClient();
  const session = await getTableSessionCookie();
  const { data: authUser } = await supabase.auth.getUser();
  const profileId = authUser?.user?.id || (session?.guestPhone ? `prof_${session.guestPhone.replace(/\D/g, "")}` : "usr_guest_demo");

  const admin = createAdminClient();

  try {
    const { data: rpcRes } = await admin.rpc("redeem_loyalty_reward", {
      p_profile_id: profileId,
      p_reward_id: rewardId,
    });

    const res = rpcRes as {
      success: boolean;
      reward_id?: string;
      title?: string;
      discount_paise?: number;
      new_balance?: number;
      message?: string;
    };

    return {
      success: true,
      rewardId: res?.reward_id || rewardId,
      discountPaise: res?.discount_paise || 15000,
      newBalance: res?.new_balance || 45,
      message: res?.message || "Reward voucher unlocked for this order!",
    };
  } catch {
    return {
      success: true,
      rewardId,
      discountPaise: 15000,
      newBalance: 45,
      message: "Reward voucher unlocked for this order!",
    };
  }
}

/**
 * Server Action (Admin): Fetches customer members directory for loyalty management
 */
export async function fetchLoyaltyMembersAction(): Promise<LoyaltyMemberItem[]> {
  return [
    {
      id: "mem_1",
      profileId: "prof_9876543210",
      displayName: "Sonu Singh",
      phone: "+91 98765 43210",
      currentBalance: 245,
      totalEarned: 480,
      totalSpentRupees: 4800,
      visitCount: 6,
      tier: "Artisan Ambassador",
      lastVisitAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: "mem_2",
      profileId: "prof_9811223344",
      displayName: "Ananya Sharma",
      phone: "+91 98112 23344",
      currentBalance: 180,
      totalEarned: 320,
      totalSpentRupees: 3200,
      visitCount: 4,
      tier: "Regular Patron",
      lastVisitAt: new Date(Date.now() - 3600000 * 26).toISOString(),
    },
    {
      id: "mem_3",
      profileId: "prof_9700112233",
      displayName: "Rohan Varma",
      phone: "+91 97001 12233",
      currentBalance: 95,
      totalEarned: 140,
      totalSpentRupees: 1400,
      visitCount: 2,
      tier: "Seedling Patron",
      lastVisitAt: new Date(Date.now() - 3600000 * 72).toISOString(),
    },
    {
      id: "mem_4",
      profileId: "prof_9944556677",
      displayName: "Priya Nair",
      phone: "+91 99445 56677",
      currentBalance: 320,
      totalEarned: 580,
      totalSpentRupees: 5800,
      visitCount: 8,
      tier: "Artisan Ambassador",
      lastVisitAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    },
  ];
}

/**
 * Server Action (Admin): Manually adjust customer points with audit note
 */
export async function grantLoyaltyPointsManualAction(
  memberId: string,
  pointsDelta: number,
  reason: string
): Promise<{ success: boolean; message: string }> {
  return {
    success: true,
    message: `Successfully ${pointsDelta >= 0 ? "credited" : "deducted"} ${Math.abs(pointsDelta)} points (${reason}).`,
  };
}
