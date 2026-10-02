import { ObservabilityDashboard } from "@/components/admin/ObservabilityDashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Observability & Alert Monitoring — smol café Admin",
  description:
    "Live system health, Sentry error tracking, alert rules engine, and structured logs.",
};

export default function AdminObservabilityPage() {
  return <ObservabilityDashboard />;
}
