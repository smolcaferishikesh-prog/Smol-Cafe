import { fetchJukeboxQueueAction } from "./actions";
import { JukeboxClientView } from "@/components/music/JukeboxClientView";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Smol Jukebox — smol café",
  description: "Collaborative music request and voting queue for smol café diners.",
};

export default async function MusicPage() {
  const initialData = await fetchJukeboxQueueAction();

  return <JukeboxClientView initialData={initialData} />;
}
