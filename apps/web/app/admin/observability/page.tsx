import { redirect } from "next/navigation";
import { requireStaffAuth } from "@/lib/auth/rbac";
import { ObservabilityDashboard } from "@/components/admin/ObservabilityDashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Observability & Alert Monitoring — smol café Admin",
  description:
    "Live system health, Sentry error tracking, alert rules engine, and structured logs.",
};

export default async function AdminObservabilityPage() {
  const auth = await requireStaffAuth(["admin", "super_admin"]);

  if (!auth.authorized) {
    redirect("/smol-backdoor");
  }

  return <ObservabilityDashboard />;
}
