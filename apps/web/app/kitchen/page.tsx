import { redirect } from "next/navigation";
import { requireStaffAuth } from "@/lib/auth/rbac";
import { fetchKitchenOrdersAction } from "./actions";
import { KitchenBoardView } from "@/components/kitchen/KitchenBoardView";

export const metadata = {
  title: "Kitchen Display (KDS) — smol café",
  description: "Live kitchen display system for smol café chefs and baristas.",
};

export default async function KitchenPage() {
  const auth = await requireStaffAuth(["kitchen", "chef", "admin", "super_admin"]);

  if (!auth.authorized) {
    redirect("/smol-backdoor");
  }

  const initialData = await fetchKitchenOrdersAction();

  return <KitchenBoardView initialOrders={initialData.orders} />;
}
