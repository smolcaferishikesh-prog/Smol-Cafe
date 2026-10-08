import { redirect } from "next/navigation";
import { requireStaffAuth } from "@/lib/auth/rbac";
import { fetchBaristaOrdersAction } from "@/app/barista/actions";
import { BaristaBoardView } from "@/components/barista/BaristaBoardView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Barista Desk & Brew Bar — smol café",
  description: "Live specialty coffee and beverage queue for smol café baristas.",
};

export default async function SmolBackdoorBaristaPage() {
  const auth = await requireStaffAuth(["barista", "kitchen", "chef", "admin"]);

  if (!auth.authorized) {
    redirect("/smol-backdoor");
  }

  const res = await fetchBaristaOrdersAction();
  const initialOrders = res.success ? res.orders : [];

  return <BaristaBoardView initialOrders={initialOrders} />;
}
