"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CafeEvent, EventRsvp } from "@smol-cafe/db";
import { broadcastSyncEvent } from "@/lib/sync-events";

export interface CustomerEventView {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  capacity: number;
  rsvpCount: number;
  joinUrlOrNote: string | null;
  isRegistered: boolean;
  isFull: boolean;
}

export interface AdminEventWithRsvps extends CafeEvent {
  rsvps: EventRsvp[];
}

export interface CreateEventInput {
  title: string;
  description: string;
  startsAt: string;
  endsAt?: string;
  capacity: number;
  joinUrlOrNote?: string;
  active?: boolean;
}

/**
 * Public Server Action: Fetches upcoming community events for customer cards
 */
export async function fetchUpcomingEventsAction(): Promise<{
  events: CustomerEventView[];
  success: boolean;
}> {
  const supabase = await createClient();
  const admin = createAdminClient();
  const nowIso = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // Include events started in last 2h

  try {
    const { data: authUser } = await supabase.auth.getUser();
    const currentUserId = authUser?.user?.id;

    // 1. Fetch active upcoming events
    const { data: events, error: eventsErr } = await admin
      .from("cafe_events")
      .select("*")
      .eq("active", true)
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(10);

    if (eventsErr || !events) {
      return { events: [], success: false };
    }

    // 2. Fetch RSVPs for these events
    const eventIds = events.map((e) => e.id);
    const { data: rsvps } = await admin.from("event_rsvps").select("*").in("event_id", eventIds);

    const rsvpsByEvent = new Map<string, EventRsvp[]>();
    for (const r of (rsvps as EventRsvp[]) || []) {
      const list = rsvpsByEvent.get(r.event_id) || [];
      list.push(r);
      rsvpsByEvent.set(r.event_id, list);
    }

    const customerEvents: CustomerEventView[] = events.map((e) => {
      const eventRsvps = rsvpsByEvent.get(e.id) || [];
      const rsvpCount = eventRsvps.length;
      const isRegistered = currentUserId
        ? eventRsvps.some((r) => r.profile_id === currentUserId)
        : false;

      return {
        id: e.id,
        title: e.title,
        description: e.description,
        startsAt: e.starts_at,
        endsAt: e.ends_at,
        capacity: e.capacity,
        rsvpCount,
        joinUrlOrNote: e.join_url_or_note,
        isRegistered,
        isFull: rsvpCount >= e.capacity,
      };
    });

    return { events: customerEvents, success: true };
  } catch (err) {
    console.error("Error fetching upcoming events:", err);
    return { events: [], success: false };
  }
}

/**
 * Public Server Action: Registers interest (RSVP) for an event
 */
export async function registerEventRsvpAction(
  eventId: string,
  guestName?: string,
  guestContact?: string
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient();
  const admin = createAdminClient();

  try {
    const { data: authUser } = await supabase.auth.getUser();
    const userId = authUser?.user?.id || null;

    // 1. Verify Event exists & capacity
    const { data: event, error: eventErr } = await admin
      .from("cafe_events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (eventErr || !event) {
      return { success: false, message: "Event could not be found." };
    }

    // 2. Count current RSVPs
    const { count } = await admin
      .from("event_rsvps")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId);

    if (count !== null && count >= event.capacity) {
      return { success: false, message: "Sorry, this event is fully booked!" };
    }

    // 3. Prevent duplicate RSVP
    if (userId) {
      const { data: existing } = await admin
        .from("event_rsvps")
        .select("id")
        .eq("event_id", eventId)
        .eq("profile_id", userId)
        .maybeSingle();

      if (existing) {
        return { success: true, message: "You're already registered for this event!" };
      }
    }

    // 4. Insert RSVP
    const { error: insertErr } = await admin.from("event_rsvps").insert({
      event_id: eventId,
      profile_id: userId,
      guest_name: guestName?.trim() || (userId ? "Member" : "Guest"),
      guest_contact: guestContact?.trim() || null,
      registered_at: new Date().toISOString(),
    });

    if (insertErr) {
      console.error("Failed to register RSVP:", insertErr);
      return { success: false, message: "Could not complete registration." };
    }

    broadcastSyncEvent({
      type: "SETTINGS_UPDATED",
      metadata: { entity: "event_rsvp", eventId },
      timestamp: Date.now(),
    });

    return {
      success: true,
      message: `✓ You're registered for ${event.title}! See you at smol café.`,
    };
  } catch (err) {
    console.error("Error in registerEventRsvpAction:", err);
    return { success: false, message: "An unexpected error occurred." };
  }
}

/**
 * Admin Server Action: Fetches all events with attendee lists
 */
export async function fetchAllAdminEventsAction(): Promise<{
  events: AdminEventWithRsvps[];
  success: boolean;
}> {
  const admin = createAdminClient();

  try {
    const { data: events, error: eventsErr } = await admin
      .from("cafe_events")
      .select("*")
      .order("starts_at", { ascending: false });

    if (eventsErr || !events) {
      return { events: [], success: false };
    }

    const { data: rsvps } = await admin.from("event_rsvps").select("*");

    const rsvpsByEvent = new Map<string, EventRsvp[]>();
    for (const r of (rsvps as EventRsvp[]) || []) {
      const list = rsvpsByEvent.get(r.event_id) || [];
      list.push(r);
      rsvpsByEvent.set(r.event_id, list);
    }

    const result: AdminEventWithRsvps[] = events.map((e) => ({
      ...(e as CafeEvent),
      rsvps: rsvpsByEvent.get(e.id) || [],
    }));

    return { events: result, success: true };
  } catch (err) {
    console.error("Error in fetchAllAdminEventsAction:", err);
    return { events: [], success: false };
  }
}

import { requireStaffAuth } from "@/lib/auth/rbac";

/**
 * Admin Server Action: Creates a new cafe event
 */
export async function createCafeEventAction(
  input: CreateEventInput
): Promise<{ success: boolean; event?: CafeEvent; message?: string }> {
  const auth = await requireStaffAuth(["admin", "super_admin"]);
  if (!auth.authorized) {
    return { success: false, message: auth.message || "Unauthorized." };
  }

  const admin = createAdminClient();

  if (!input.title.trim() || !input.startsAt) {
    return { success: false, message: "Title and start date/time are required." };
  }

  try {
    const { data: event, error } = await admin
      .from("cafe_events")
      .insert({
        title: input.title.trim(),
        description: input.description.trim(),
        starts_at: input.startsAt,
        ends_at: input.endsAt || null,
        capacity: input.capacity || 20,
        join_url_or_note: input.joinUrlOrNote?.trim() || null,
        active: input.active !== undefined ? input.active : true,
      })
      .select("*")
      .single();

    if (error || !event) {
      return { success: false, message: "Failed to create event." };
    }

    broadcastSyncEvent({
      type: "SETTINGS_UPDATED",
      metadata: { entity: "event", action: "create", eventId: event.id },
      timestamp: Date.now(),
    });

    return {
      success: true,
      event: event as CafeEvent,
      message: `Event "${input.title}" published!`,
    };
  } catch (err) {
    console.error("Error creating event:", err);
    return { success: false, message: "An unexpected error occurred." };
  }
}

/**
 * Admin Server Action: Toggles event active status
 */
export async function toggleCafeEventActiveAction(
  id: string,
  active: boolean
): Promise<{ success: boolean; event?: CafeEvent; message?: string }> {
  const auth = await requireStaffAuth(["admin", "super_admin"]);
  if (!auth.authorized) {
    return { success: false, message: auth.message || "Unauthorized." };
  }

  const admin = createAdminClient();

  try {
    const { data: event, error } = await admin
      .from("cafe_events")
      .update({ active, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();

    if (error || !event) {
      return { success: false, message: "Failed to toggle event." };
    }

    broadcastSyncEvent({
      type: "SETTINGS_UPDATED",
      metadata: { entity: "event", action: "toggle", eventId: id, active },
      timestamp: Date.now(),
    });

    return {
      success: true,
      event: event as CafeEvent,
      message: `Event is now ${active ? "live" : "hidden"}.`,
    };
  } catch {
    return { success: false, message: "Failed to update event." };
  }
}

/**
 * Admin Server Action: Deletes an event
 */
export async function deleteCafeEventAction(
  id: string
): Promise<{ success: boolean; message?: string }> {
  const auth = await requireStaffAuth(["admin", "super_admin"]);
  if (!auth.authorized) {
    return { success: false, message: auth.message || "Unauthorized." };
  }

  const admin = createAdminClient();

  try {
    const { error } = await admin.from("cafe_events").delete().eq("id", id);
    if (error) return { success: false, message: "Failed to delete event." };

    broadcastSyncEvent({
      type: "SETTINGS_UPDATED",
      metadata: { entity: "event", action: "delete", eventId: id },
      timestamp: Date.now(),
    });

    return { success: true, message: "Event deleted." };
  } catch {
    return { success: false, message: "An unexpected error occurred." };
  }
}
