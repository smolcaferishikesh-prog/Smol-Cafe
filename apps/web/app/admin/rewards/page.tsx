import { fetchRewardsAction } from "./actions";
import { RewardsManager } from "@/components/admin/RewardsManager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Rewards Manager — smol café",
  description: "Create, edit, and toggle loyalty reward catalog items.",
};

export default async function AdminRewardsPage() {
  const { rewards } = await fetchRewardsAction();

  return <RewardsManager initialRewards={rewards} />;
}
