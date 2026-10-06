import { redirect } from "next/navigation";
import { requireStaffAuth } from "@/lib/auth/rbac";
import { fetchRewardsAction } from "./actions";
import { RewardsManager } from "@/components/admin/RewardsManager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Rewards Manager — smol café",
  description: "Create, edit, and toggle loyalty reward catalog items.",
};

export default async function AdminRewardsPage() {
  const auth = await requireStaffAuth(["admin", "super_admin"]);

  if (!auth.authorized) {
    redirect("/smol-backdoor");
  }

  const { rewards } = await fetchRewardsAction();

  return <RewardsManager initialRewards={rewards} />;
}
