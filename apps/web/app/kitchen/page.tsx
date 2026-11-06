import { redirect } from "next/navigation";
import { requireStaffAuth } from "@/lib/auth/rbac";

export default async function KitchenRedirectPage() {
  const auth = await requireStaffAuth(["kitchen", "chef", "admin", "super_admin"]);
  if (auth.authorized) {
    redirect("/smol-backdoor/kitchen");
  }
  redirect("/smol-backdoor");
}
