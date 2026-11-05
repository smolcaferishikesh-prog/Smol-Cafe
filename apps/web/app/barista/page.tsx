import { redirect } from "next/navigation";
import { requireStaffAuth } from "@/lib/auth/rbac";

export default async function BaristaRedirectPage() {
  const auth = await requireStaffAuth(["barista", "kitchen", "chef", "admin", "super_admin"]);
  if (auth.authorized) {
    redirect("/smol-backdoor/barista");
  }
  redirect("/smol-backdoor");
}
