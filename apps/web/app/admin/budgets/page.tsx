import { redirect } from "next/navigation";
import { requireStaffAuth } from "@/lib/auth/rbac";
import { fetchBudgetVsActualAction } from "./actions";
import { BudgetAnalyticsManager } from "@/components/admin/BudgetAnalyticsManager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Procurement Budgets & Spend Analytics — smol café",
  description: "Budget vs actual procurement spend, line-item drill-downs, and supplier audit.",
};

export default async function AdminBudgetsPage() {
  const auth = await requireStaffAuth(["admin", "super_admin"]);

  if (!auth.authorized) {
    redirect("/smol-backdoor");
  }

  const initialData = await fetchBudgetVsActualAction("2026-08");

  return <BudgetAnalyticsManager initialData={initialData} />;
}
