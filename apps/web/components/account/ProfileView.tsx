"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { Profile } from "@smol-cafe/db";
import type { CustomerHistoricalOrder } from "@/app/account/actions";
import { claimCurrentSessionOrdersAction } from "@/app/account/actions";
import {
  getLoyaltyAccountAction,
  recordCustomerPhoneLoginAction,
  redeemLoyaltyRewardAction,
  claimBonusQuestAction,
  type LoyaltyAccountDetails,
  type LoyaltyBonusRule,
} from "@/app/account/loyalty-actions";
import { subscribeToSyncEvents, broadcastSyncEvent } from "@/lib/sync-events";
import { AuthModal } from "./AuthModal";
import {
  Coffee,
  UtensilsCrossed,
  Award,
  Coins,
  Sparkles,
  CheckCircle2,
  Gift,
  Share2,
  Calendar,
  Zap,
  ArrowRight,
  Flame,
  Clock,
  Smartphone,
  Edit3,
} from "lucide-react";
import { ThemeToggle } from "@/components/common/ThemeToggle";

interface ProfileViewProps {
  initialProfile: Profile | null;
  initialOrders: CustomerHistoricalOrder[];
  initialLoyalty?: LoyaltyAccountDetails;
  activeSession: {
    sessionId: string;
    tableLabel: string;
    locationName: string;
  } | null;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  initialProfile,
  initialOrders,
  initialLoyalty,
  activeSession,
}) => {
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [orders] = useState<CustomerHistoricalOrder[]>(initialOrders);
  const [loyalty, setLoyalty] = useState<LoyaltyAccountDetails | undefined>(initialLoyalty);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);

  const [localName, setLocalName] = useState(initialProfile?.display_name || "");
  const [localPhone, setLocalPhone] = useState(initialProfile?.phone || "");
  const [birthday, setBirthday] = useState<string>("1998-08-15");
  const [showBirthdayPicker, setShowBirthdayPicker] = useState<boolean>(false);
  const [showPhoneModal, setShowPhoneModal] = useState<boolean>(false);
  const [phoneInput, setPhoneInput] = useState<string>("");
  const [nameInput, setNameInput] = useState<string>("");
  const [phoneSubmitting, setPhoneSubmitting] = useState<boolean>(false);
  const [phoneFeedback, setPhoneFeedback] = useState<string | null>(null);

  const [claimedQuests, setClaimedQuests] = useState<Set<string>>(
    new Set(initialLoyalty?.claimedQuests || ["first_order"])
  );

  const cleanDisplayName = React.useMemo(() => {
    let name = (profile?.display_name || localName || "Sonu").trim();
    if (name.includes("Aditi") && name.includes("Sonu")) {
      name = "Aditi Sharma";
    }
    return name;
  }, [profile?.display_name, localName]);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const savedName = localStorage.getItem("smol_guest_name");
      const savedPhone = localStorage.getItem("smol_guest_phone");
      const savedBday = localStorage.getItem("smol_guest_birthday");
      if (savedName && !localName) {
        setLocalName(savedName);
        setNameInput(savedName);
      }
      if (savedPhone && !localPhone) {
        const clean = savedPhone.replace(/\D/g, "");
        setLocalPhone(`+91 ${clean.slice(0, 5)} ${clean.slice(5)}`);
        setPhoneInput(clean.slice(-10));
      }
      if (savedBday) setBirthday(savedBday);
    }
  }, [localName, localPhone]);

  const handleSaveCustomerPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput.trim()) return;
    setPhoneSubmitting(true);
    setPhoneFeedback(null);

    try {
      const res = await recordCustomerPhoneLoginAction(phoneInput, nameInput || cleanDisplayName);
      if (res.success && res.details) {
        if (res.phone) {
          setLocalPhone(res.phone);
          localStorage.setItem("smol_guest_phone", res.phone);
        }
        if (res.displayName) {
          setLocalName(res.displayName);
          localStorage.setItem("smol_guest_name", res.displayName);
        }
        setLoyalty(res.details);
        if (res.details.account?.current_balance_cached !== undefined) {
          setCurrentBalance(res.details.account.current_balance_cached);
        }
        setRedeemFeedback(res.message);
        setShowPhoneModal(false);
        broadcastSyncEvent({ type: "LOYALTY_UPDATED", timestamp: Date.now() });
      } else {
        setPhoneFeedback(res.message || "Failed to link phone number.");
      }
    } catch {
      setPhoneFeedback("Network error linking phone number.");
    } finally {
      setPhoneSubmitting(false);
    }
  };

  // Real-time synchronization for Loyalty Points across open customer tabs & cart
  React.useEffect(() => {
    const unsub = subscribeToSyncEvents((event) => {
      if (
        event.type === "LOYALTY_UPDATED" ||
        event.type === "REWARD_REDEEMED" ||
        event.type === "ORDER_PLACED" ||
        event.type === "PAYMENT_COMPLETED" ||
        event.type === "BILL_SETTLED"
      ) {
        getLoyaltyAccountAction()
          .then((res) => {
            if (res) {
              setLoyalty(res);
              if (res.account?.current_balance_cached !== undefined) {
                setCurrentBalance(res.account.current_balance_cached);
              }
              if (res.claimedQuests) {
                setClaimedQuests(new Set(res.claimedQuests));
              }
            }
          })
          .catch(console.warn);
      }
    });
    return () => unsub();
  }, []);

  const handleClaimOrders = async () => {
    setIsClaiming(true);
    setClaimMessage(null);

    try {
      const res = await claimCurrentSessionOrdersAction();
      if (res.success) {
        setClaimMessage(res.message || "Orders linked successfully!");
        broadcastSyncEvent({ type: "LOYALTY_UPDATED", timestamp: Date.now() });
      } else {
        setClaimMessage(res.message || "Could not claim orders.");
      }
    } catch {
      setClaimMessage("Failed to claim orders.");
    } finally {
      setIsClaiming(false);
    }
  };

  const [currentBalance, setCurrentBalance] = useState(
    loyalty?.account?.current_balance_cached || 145
  );
  const [redeemFeedback, setRedeemFeedback] = useState<string | null>(null);

  const rewardCoupons = [
    { id: "rew_croissant", title: "Free Flaky Croissant", cost: 100, icon: UtensilsCrossed, value: "₹140 value" },
    { id: "rew_pour_over", title: "Free Ratnagiri Pour Over", cost: 150, icon: Coffee, value: "₹220 value" },
    { id: "rew_percent_20", title: "Max 20% Off Next Bill", cost: 80, icon: Award, value: "Instant discount" },
  ];

  const handleRedeemCoupon = async (rewardId: string, title: string, cost: number) => {
    if (currentBalance < cost) {
      setRedeemFeedback(`Insufficient points for ${title}. You need ${cost} points.`);
      return;
    }

    try {
      const res = await redeemLoyaltyRewardAction(rewardId);
      if (res.success) {
        setCurrentBalance(res.newBalance || Math.max(0, currentBalance - cost));
        setRedeemFeedback(`🎉 Successfully unlocked: ${title}! It will be applied at checkout.`);
        broadcastSyncEvent({ type: "REWARD_REDEEMED", timestamp: Date.now() });
      } else {
        setRedeemFeedback(res.message || "Failed to redeem reward.");
      }
    } catch {
      setRedeemFeedback("Network error redeeming reward.");
    }
  };

  const handleClaimBonusQuest = async (questId: string, pts: number) => {
    if (claimedQuests.has(questId)) return;
    try {
      const res = await claimBonusQuestAction(questId);
      if (res.success) {
        setClaimedQuests((prev) => new Set(prev).add(questId));
        setCurrentBalance((prev) => prev + pts);
        setRedeemFeedback(res.message || `+${pts} Smol Points credited!`);
        broadcastSyncEvent({ type: "LOYALTY_UPDATED", timestamp: Date.now() });
      } else {
        setRedeemFeedback(res.message || "Could not claim quest.");
      }
    } catch {
      setRedeemFeedback("Network error claiming quest.");
    }
  };

  const handleSaveBirthday = async () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("smol_guest_birthday", birthday);
    }
    setShowBirthdayPicker(false);
    await handleClaimBonusQuest("complete_profile", 10);
  };

  const tierName =
    currentBalance >= 300
      ? "Artisan Ambassador"
      : currentBalance >= 100
      ? "Regular Patron"
      : "Seedling Patron";

  const nextTierMax = currentBalance >= 300 ? 500 : currentBalance >= 100 ? 300 : 100;
  const progressPercent = Math.min(100, Math.round((currentBalance / nextTierMax) * 100));

  const bonusRulesList = loyalty?.config?.bonusRules || [
    { id: "first_order", behaviour: "First order through Smol app", points: 25, category: "ONBOARDING", description: "Welcome bonus for placing your first table order" },
    { id: "complete_profile", behaviour: "Complete profile / birthday", points: 10, category: "ONBOARDING", description: "Unlock annual birthday gifts & member status" },
    { id: "second_visit", behaviour: "Second visit", points: 20, category: "VISITS", description: "Awarded automatically on your 2nd dining visit" },
    { id: "visits_3_in_30", behaviour: "3 visits in 30 days", points: 30, category: "VISITS", description: "Consistent cafe visitor milestone" },
    { id: "visits_5_in_30", behaviour: "5 visits in 30 days", points: 50, category: "VISITS", description: "Dedicated smol regular achievement" },
    { id: "refer_friend", behaviour: "Refer a friend who actually orders", points: 50, category: "SOCIAL", description: "Share your patron code with a companion" },
    { id: "birthday_visit", behaviour: "Birthday visit", points: 50, category: "SOCIAL", description: "Celebrate your birthday with free points" },
    { id: "attend_event", behaviour: "Attend a Smol event", points: 20, category: "SOCIAL", description: "Poetry reading, live jazz, or manual brew workshop" },
    { id: "try_featured", behaviour: "Try a featured/new menu item", points: 10, category: "ONBOARDING", description: "Seasonal and chef's special explorer perk" },
    { id: "slow_period_2x", behaviour: "Order during designated slow period", points: 0, isMultiplier: true, multiplierText: "2× points", category: "TIME_BASED", description: "Earn double points between 2:00 PM – 5:00 PM daily" },
  ];

  return (
    <div className="min-h-screen bg-[#F3E7D3] dark:bg-[#151110] text-[#241F1C] dark:text-[#FAF4EB] pb-28 font-sans transition-colors duration-200">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-[#C9AE8B]/40 dark:border-white/10 bg-[#F3E7D3]/90 dark:bg-[#181412]/90 px-4 py-3.5 backdrop-blur-md transition-colors duration-200">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Link
            href="/home"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#241F1C] dark:text-[#FAF4EB] transition hover:bg-black/5 dark:hover:bg-white/10 active:scale-95"
            aria-label="Back to home"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>

          <h1 className="font-serif text-xl font-bold tracking-tight text-[#B72E35] dark:text-[#FF5B52] lowercase">
            smol club loyalty
          </h1>

          <ThemeToggle variant="icon" />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-4 space-y-5">
        {/* USER PROFILE CARD (Active & Editable: Name, Phone, Profile Avatar & Edit Option) */}
        <div className="relative overflow-hidden rounded-3xl border border-[#C9AE8B]/60 dark:border-white/10 bg-[#FAF4EB] dark:bg-[#201A17] p-5 shadow-sm transition-all space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              {/* Profile Avatar / Photo */}
              <div className="relative group">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#B72E35] to-[#7D1217] text-white font-serif font-bold text-xl shadow-md border-2 border-white dark:border-stone-800 overflow-hidden">
                  {cleanDisplayName.charAt(0).toUpperCase()}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPhoneInput((localPhone || profile?.phone || "").replace(/\D/g, "").slice(-10));
                    setNameInput(cleanDisplayName);
                    setShowPhoneModal(true);
                  }}
                  className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#241F1C] dark:bg-white text-white dark:text-[#241F1C] shadow-xs hover:scale-105 transition cursor-pointer"
                  title="Change avatar or profile details"
                >
                  <Edit3 className="h-3 w-3" />
                </button>
              </div>

              <div>
                <h2 className="font-serif text-xl font-bold text-[#241F1C] dark:text-[#FAF4EB] capitalize leading-snug">
                  {cleanDisplayName}
                </h2>
                <p className="font-mono text-xs text-[#725039] dark:text-[#C9AE8B] mt-0.5">
                  {localPhone || profile?.phone || "+91 93050 84332"}
                </p>
              </div>
            </div>

            {/* Edit Profile Button */}
            <button
              type="button"
              onClick={() => {
                setPhoneInput((localPhone || profile?.phone || "").replace(/\D/g, "").slice(-10));
                setNameInput(cleanDisplayName);
                setShowPhoneModal(true);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-[#B72E35]/40 bg-[#B72E35]/10 dark:bg-[#B72E35]/20 px-3 py-1.5 font-serif text-xs font-bold text-[#B72E35] dark:text-[#FF5B52] hover:bg-[#B72E35] hover:text-white transition active:scale-95 cursor-pointer"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Edit</span>
            </button>
          </div>
        </div>

        {/* LOWER SECTION: BLURRED WITH CENTERING "COMING SOON" OVERLAY */}
        <div className="relative rounded-3xl overflow-hidden min-h-[380px]">
          {/* Blurred Background Layer */}
          <div className="filter blur-[5px] opacity-35 pointer-events-none select-none space-y-4">
            {/* Smol Loyalty Pass Card (Blurred Teaser) */}
            <div className="rounded-3xl border border-[#C9AE8B]/50 bg-[#FAF4EB] p-5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs font-bold text-[#725039]">SMOL REWARDS PASS</span>
                <span className="font-mono text-xs font-bold text-[#B72E35]">₹10 = 1 pt</span>
              </div>
              <div className="h-4 bg-[#E8DFD3] rounded-full w-3/4" />
              <div className="h-2 bg-[#E8DFD3] rounded-full w-full" />
            </div>

            {/* Bonus Smol Points Quests (Blurred Teaser) */}
            <div className="rounded-3xl border border-[#C9AE8B]/50 bg-[#FAF4EB] p-4 space-y-2">
              <div className="h-4 bg-[#E8DFD3] rounded-full w-1/2" />
              <div className="h-3 bg-[#E8DFD3] rounded-full w-2/3" />
              <div className="h-3 bg-[#E8DFD3] rounded-full w-3/4" />
            </div>

            {/* Perk Vouchers (Blurred Teaser) */}
            <div className="grid grid-cols-3 gap-2">
              <div className="h-20 bg-[#FAF4EB] rounded-2xl border border-[#C9AE8B]/40" />
              <div className="h-20 bg-[#FAF4EB] rounded-2xl border border-[#C9AE8B]/40" />
              <div className="h-20 bg-[#FAF4EB] rounded-2xl border border-[#C9AE8B]/40" />
            </div>
          </div>

          {/* Centered High-Visibility Coming Soon Overlay */}
          <div className="absolute inset-0 flex items-center justify-center p-4 z-20">
            <div className="w-full max-w-sm rounded-3xl border border-[#B72E35]/40 dark:border-amber-500/30 bg-[#FAF4EB]/95 dark:bg-[#1E1A17]/95 p-6 shadow-2xl backdrop-blur-md text-center space-y-3 animate-fade-in">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#B72E35]/15 text-[#B72E35] dark:text-[#FF5B52]">
                <Sparkles className="h-6 w-6" />
              </div>

              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#B72E35] text-white px-3.5 py-1 font-mono text-[10px] font-black uppercase tracking-widest shadow-xs">
                <span>COMING SOON 🚀</span>
              </div>

              <h3 className="font-serif text-lg font-bold text-[#241F1C] dark:text-[#FAF4EB] leading-tight">
                Smol Patron Rewards &amp; Full Dashboard Coming Soon
              </h3>

              <p className="font-serif italic text-xs text-[#725039] dark:text-[#C9AE8B] leading-relaxed">
                We are perfecting patron rewards, digital invoices, milestone badges, and order history for smol café regulars!
              </p>
            </div>
          </div>
        </div>

        {/* Active Session Claim Card (if seated) */}
        {activeSession && (
          <div className="rounded-2xl border border-[#75AFA7]/60 dark:border-[#75AFA7]/30 bg-[#75AFA7]/20 dark:bg-[#142318] p-4 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#1C463F] dark:text-[#75C7BC]">
                  Seated Table Session
                </span>
                <p className="font-serif text-sm font-bold text-[#1C1917] dark:text-[#E2F0E7]">
                  Table {activeSession.tableLabel} • {activeSession.locationName}
                </p>
              </div>
              <button
                onClick={handleClaimOrders}
                disabled={isClaiming}
                className="rounded-full bg-[#75AFA7] hover:bg-[#5C968E] dark:bg-[#2A5235] dark:hover:bg-[#1E3B26] px-3.5 py-1.5 font-serif text-xs font-bold text-white shadow-xs active:scale-95 disabled:opacity-50 transition cursor-pointer"
              >
                {isClaiming ? "Linking..." : "Claim Orders ✓"}
              </button>
            </div>
            {claimMessage && (
              <p className="mt-2 font-serif text-xs text-[#1C463F] dark:text-[#75C7BC]">
                {claimMessage}
              </p>
            )}
          </div>
        )}

        {/* Past Visits & Digital Invoices */}
        <section className="space-y-2.5">
          <h3 className="font-serif text-xs font-bold text-[#1C1917] dark:text-[#FAF4EB] uppercase tracking-wider px-1">
            Past Invoices &amp; Receipts ({orders.length})
          </h3>

          {orders.length === 0 ? (
            <div className="rounded-2xl border border-[#E2D7C7] dark:border-white/10 bg-[#FCF8F2] dark:bg-[#201A17] p-6 text-center">
              <p className="font-serif text-xs text-[#786F66] dark:text-[#C9AE8B]">
                No past visit receipts yet. Orders placed at your table will appear here automatically.
              </p>
            </div>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                className="rounded-2xl border border-[#E8DFD3] dark:border-white/10 bg-[#FAF5ED] dark:bg-[#201A17] p-3.5 shadow-xs space-y-2 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-[#1C1917] dark:text-[#FAF4EB]">
                      Order #{order.orderNo}
                    </span>
                    <p className="font-serif italic text-[11px] text-[#786F66] dark:text-[#C9AE8B]">
                      {new Date(order.submittedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })} • Table {order.tableLabel || "01"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-serif font-bold text-sm text-[#9E2A2B] dark:text-[#FF5B52]">
                      ₹{order.totalRupees}
                    </span>
                    <span className="block font-mono text-[9px] uppercase font-bold text-emerald-700 dark:text-emerald-400">
                      {order.status}
                    </span>
                  </div>
                </div>

                <div className="border-t border-[#EADFCF] dark:border-white/10 pt-2 space-y-1">
                  {order.items.map((it, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between font-serif text-xs text-[#5C544D] dark:text-[#D4BCA0]"
                    >
                      <span>
                        <span className="font-mono">{it.qty}x</span> {it.name}
                      </span>
                      <span className="font-mono">₹{it.priceRupees * it.qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      </main>

      {/* Sign-in Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          setProfile({
            id: "user",
            display_name: "Sonu Singh",
            phone: "+91 98765 43210",
            email: null,
            avatar_url: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }}
      />
    </div>
  );
};

