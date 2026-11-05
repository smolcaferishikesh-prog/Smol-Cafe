import { redirect } from "next/navigation";
import { requireStaffAuth } from "@/lib/auth/rbac";

export default async function AdminRedirectPage() {
  const auth = await requireStaffAuth(["admin", "super_admin"]);
  if (auth.authorized) {
    redirect("/smol-backdoor/admin");
  }
  redirect("/smol-backdoor");
}
