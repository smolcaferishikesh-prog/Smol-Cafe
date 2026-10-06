import { redirect } from "next/navigation";
import { requireStaffAuth } from "@/lib/auth/rbac";
import { fetchAllBlackboardPostsAction } from "./actions";
import { BlackboardManager } from "@/components/admin/BlackboardManager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Blackboard Specials — smol café",
  description: "Create, schedule, and edit daily specials and chalkboard announcements.",
};

export default async function AdminBlackboardPage() {
  const auth = await requireStaffAuth(["admin", "super_admin"]);

  if (!auth.authorized) {
    redirect("/smol-backdoor");
  }

  const { posts } = await fetchAllBlackboardPostsAction();

  return <BlackboardManager initialPosts={posts} />;
}
