import { notFound } from "next/navigation";
import { getCurrentUserProfileAction, getCustomerOrderHistoryAction } from "@/app/account/actions";
import { getLoyaltyAccountAction } from "@/app/account/loyalty-actions";
import { ProfileView } from "@/components/account/ProfileView";

export const metadata = {
  title: "My Account & Receipts — smol café",
  description: "View past orders, digital bills, and claim table dining sessions.",
};

export default async function ProfilePage() {
  const { profile, activeSession } = await getCurrentUserProfileAction();

  if (!activeSession) {
    notFound();
  }

  const { orders } = await getCustomerOrderHistoryAction();
  const loyalty = await getLoyaltyAccountAction();

  return (
    <ProfileView
      initialProfile={profile}
      initialOrders={orders}
      activeSession={activeSession}
      initialLoyalty={loyalty}
    />
  );
}
