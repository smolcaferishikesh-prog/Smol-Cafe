import { fetchAllAdminEventsAction } from "@/app/events/actions";
import { EventsManager } from "@/components/admin/EventsManager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Events Manager — smol café",
  description: "Create and manage café workshops, community jams, and attendee RSVPs.",
};

export default async function AdminEventsPage() {
  const { events } = await fetchAllAdminEventsAction();

  return <EventsManager initialEvents={events} />;
}
