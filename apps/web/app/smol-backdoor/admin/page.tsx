import { redirect } from "next/navigation";
import { requireStaffAuth } from "@/lib/auth/rbac";
import { AdminClientWrapper } from "@/components/admin/AdminClientWrapper";
import { fetchAdminOverviewAction } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Command Tower — smol café",
  description: "Master operations dashboard for smol café staff, managers, and owners.",
};

export default async function SmolBackdoorAdminPage() {
  const auth = await requireStaffAuth(["admin", "super_admin"]);

  if (!auth.authorized) {
    redirect("/smol-backdoor");
  }

  const result = await fetchAdminOverviewAction();

  return (
    <AdminClientWrapper
      initialOverviewData={result.data || undefined}
    />
  );
}
