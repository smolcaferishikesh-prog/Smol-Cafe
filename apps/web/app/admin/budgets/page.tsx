import { fetchBudgetVsActualAction } from "./actions";
import { BudgetAnalyticsManager } from "@/components/admin/BudgetAnalyticsManager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Procurement Budgets & Spend Analytics — smol café",
  description: "Budget vs actual procurement spend, line-item drill-downs, and supplier audit.",
};

export default async function AdminBudgetsPage() {
  const initialData = await fetchBudgetVsActualAction("2026-08");

  return <BudgetAnalyticsManager initialData={initialData} />;
}
