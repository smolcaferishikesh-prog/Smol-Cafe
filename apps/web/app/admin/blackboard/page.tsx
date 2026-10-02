import { fetchAllBlackboardPostsAction } from "./actions";
import { BlackboardManager } from "@/components/admin/BlackboardManager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Blackboard Specials — smol café",
  description: "Create, schedule, and edit daily specials and chalkboard announcements.",
};

export default async function AdminBlackboardPage() {
  const { posts } = await fetchAllBlackboardPostsAction();

  return <BlackboardManager initialPosts={posts} />;
}
