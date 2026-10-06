import { redirect } from "next/navigation";
import { requireStaffAuth } from "@/lib/auth/rbac";
import { fetchProcurementDataAction } from "./actions";
import { ProcurementManager } from "@/components/admin/ProcurementManager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Procurement & GRN — smol café",
  description: "Manage purchase orders, goods receipt notes, and vendor directories.",
};

export default async function AdminProcurementPage() {
  const auth = await requireStaffAuth(["admin", "super_admin"]);

  if (!auth.authorized) {
    redirect("/smol-backdoor");
  }

  const initialData = await fetchProcurementDataAction();

  return <ProcurementManager initialData={initialData} />;
}
