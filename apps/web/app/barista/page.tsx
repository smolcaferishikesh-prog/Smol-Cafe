import { redirect } from "next/navigation";
import { requireStaffAuth } from "@/lib/auth/rbac";
import { fetchBaristaOrdersAction } from "@/app/barista/actions";
import { BaristaBoardView } from "@/components/barista/BaristaBoardView";

export const metadata = {
  title: "Barista Desk & Brew Bar — smol café",
  description: "Live specialty coffee and beverage queue for smol café baristas.",
};

export default async function BaristaPage() {
  const auth = await requireStaffAuth(["barista", "kitchen", "chef", "admin", "super_admin"]);

  if (!auth.authorized) {
    redirect("/smol-backdoor");
  }

  const res = await fetchBaristaOrdersAction();
  const initialOrders = res.success ? res.orders : [];

  return <BaristaBoardView initialOrders={initialOrders} />;
}

