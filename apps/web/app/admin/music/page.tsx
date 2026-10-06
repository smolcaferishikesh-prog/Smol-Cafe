import { redirect } from "next/navigation";
import { requireStaffAuth } from "@/lib/auth/rbac";
import { fetchStaffJukeboxAction } from "@/app/music/actions";
import { StaffJukeboxDj } from "@/components/admin/StaffJukeboxDj";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Jukebox DJ — smol café",
  description: "Manage song requests, upvote queues, and currently playing tracks.",
};

export default async function AdminMusicPage() {
  const auth = await requireStaffAuth(["admin", "super_admin"]);

  if (!auth.authorized) {
    redirect("/smol-backdoor");
  }

  const initialData = await fetchStaffJukeboxAction();

  return <StaffJukeboxDj initialData={initialData} />;
}
