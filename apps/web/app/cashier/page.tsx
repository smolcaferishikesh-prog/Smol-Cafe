import { redirect } from "next/navigation";
import { requireStaffAuth } from "@/lib/auth/rbac";
import { fetchActiveCashierTablesAction } from "@/app/bill/actions";
import {
  fetchPendingCashierOrdersAction,
  fetchPaidCashierHistoryAction,
  fetchReadyForDeliveryOrdersAction,
} from "@/app/cashier/actions";
import { CashierDashboard } from "@/components/cashier/CashierDashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cashier & Settlement — smol café",
  description: "POS cash settlement and table session closer for smol café staff.",
};

export default async function CashierPage() {
  const auth = await requireStaffAuth(["cashier", "admin", "super_admin"]);

  if (!auth.authorized) {
    redirect("/smol-backdoor");
  }

  const [tables, pendingOrdersRes, deliveryOrdersRes, paidHistoryRes] = await Promise.all([
    fetchActiveCashierTablesAction(),
    fetchPendingCashierOrdersAction(),
    fetchReadyForDeliveryOrdersAction(),
    fetchPaidCashierHistoryAction(),
  ]);

  return (
    <CashierDashboard
      initialTables={tables}
      initialPendingOrders={pendingOrdersRes.success ? pendingOrdersRes.orders : []}
      initialDeliveryOrders={deliveryOrdersRes.success ? deliveryOrdersRes.orders : []}
      initialPaidHistory={paidHistoryRes.success ? paidHistoryRes.records : []}
    />
  );
}


