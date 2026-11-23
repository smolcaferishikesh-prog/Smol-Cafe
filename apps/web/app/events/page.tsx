import React from "react";
import { fetchUpcomingEventsAction } from "./actions";
import { EventsClientView } from "@/components/events/EventsClientView";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Café Events & Sessions — smol café",
  description: "Join upcoming community acoustic sessions, workshops, and board game nights at smol café.",
};

export default async function EventsPage() {
  const { events } = await fetchUpcomingEventsAction();

  return <EventsClientView initialEvents={events} />;
}
