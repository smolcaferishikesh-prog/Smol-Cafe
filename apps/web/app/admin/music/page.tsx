import { fetchStaffJukeboxAction } from "@/app/music/actions";
import { StaffJukeboxDj } from "@/components/admin/StaffJukeboxDj";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Jukebox DJ — smol café",
  description: "Manage song requests, upvote queues, and currently playing tracks.",
};

export default async function AdminMusicPage() {
  const initialData = await fetchStaffJukeboxAction();

  return <StaffJukeboxDj initialData={initialData} />;
}
