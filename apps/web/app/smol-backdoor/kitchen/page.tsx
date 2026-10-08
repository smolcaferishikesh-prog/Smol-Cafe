import { redirect } from "next/navigation";
import { requireStaffAuth } from "@/lib/auth/rbac";
import { fetchKitchenOrdersAction } from "@/app/kitchen/actions";
import { KitchenBoardView } from "@/components/kitchen/KitchenBoardView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Kitchen Display (KDS) — smol café",
  description: "Live confirmed order queue & kitchen preparation display for smol café.",
};

export default async function SmolBackdoorKitchenPage() {
  const auth = await requireStaffAuth(["kitchen", "chef", "admin"]);

  if (!auth.authorized) {
    redirect("/smol-backdoor");
  }

  const res = await fetchKitchenOrdersAction();
  const initialOrders = res.success ? res.orders : [];

  return <KitchenBoardView initialOrders={initialOrders} />;
}
