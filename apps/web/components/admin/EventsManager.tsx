"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { AdminEventWithRsvps, CreateEventInput } from "@/app/events/actions";
import {
  createCafeEventAction,
  toggleCafeEventActiveAction,
  deleteCafeEventAction,
} from "@/app/events/actions";
import { broadcastSyncEvent } from "@/lib/sync-events";

interface EventsManagerProps {
  initialEvents: AdminEventWithRsvps[];
}

export const EventsManager: React.FC<EventsManagerProps> = ({ initialEvents }) => {
  const [events, setEvents] = useState<AdminEventWithRsvps[]>(initialEvents);
  const [isCreating, setIsCreating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const togglingIdsRef = React.useRef<Set<string>>(new Set());

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [capacity, setCapacity] = useState("20");
  const [joinUrlOrNote, setJoinUrlOrNote] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const numericCap = parseInt(capacity, 10);
    if (isNaN(numericCap) || numericCap <= 0) {
      setFeedback({ type: "error", text: "Please provide a valid capacity." });
      return;
    }

    if (!startsAt) {
      setFeedback({ type: "error", text: "Please specify start date and time." });
      return;
    }

    const payload: CreateEventInput = {
      title,
      description,
      startsAt: new Date(startsAt).toISOString(),
      capacity: numericCap,
      joinUrlOrNote: joinUrlOrNote.trim() || undefined,
      active: true,
    };

    setIsCreating(true);
    try {
      const res = await createCafeEventAction(payload);
      if (res.success && res.event) {
        setEvents((prev) => [{ ...res.event!, rsvps: [] }, ...prev]);
        setTitle("");
        setDescription("");
        setStartsAt("");
        setCapacity("20");
        setJoinUrlOrNote("");
        setFeedback({ type: "success", text: res.message || "Event created!" });
        broadcastSyncEvent({ type: "SETTINGS_UPDATED", timestamp: Date.now() });
      } else {
        setFeedback({ type: "error", text: res.message || "Failed to create event." });
      }
    } catch {
      setFeedback({ type: "error", text: "An error occurred." });
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggle = async (event: AdminEventWithRsvps) => {
    if (togglingIdsRef.current.has(event.id)) return;
    togglingIdsRef.current.add(event.id);

    const targetActive = !event.active;
    const prevEvents = events;

    // Instant 0ms Optimistic UI Update
    setEvents((prev) =>
      prev.map((e) => (e.id === event.id ? { ...e, active: targetActive } : e))
    );

    try {
      const res = await toggleCafeEventActiveAction(event.id, targetActive);
      if (res.success && res.event) {
        setEvents((prev) =>
          prev.map((e) => (e.id === event.id ? { ...e, active: res.event!.active } : e))
        );
        broadcastSyncEvent({ type: "SETTINGS_UPDATED", timestamp: Date.now() });
      } else {
        setEvents(prevEvents); // Rollback
        setFeedback({ type: "error", text: res.message || "Failed to toggle event status." });
      }
    } catch {
      setEvents(prevEvents); // Rollback
      setFeedback({ type: "error", text: "Failed to toggle event status." });
    } finally {
      togglingIdsRef.current.delete(event.id);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this event?")) return;

    try {
      const res = await deleteCafeEventAction(id);
      if (res.success) {
        setEvents((prev) => prev.filter((e) => e.id !== id));
      }
    } catch {
      setFeedback({ type: "error", text: "Failed to delete event." });
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1C1917] pb-24 dark:bg-[#141211] dark:text-[#FDFBF7]">
      {/* Top Bar */}
      <header className="border-b border-stone-200/80 bg-white/70 px-4 py-4 backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-full border border-stone-200 bg-stone-50 p-2 text-stone-600 transition hover:bg-stone-100 dark:border-stone-800 dark:bg-stone-800 dark:text-stone-300"
            >
              ← Back
            </Link>
            <div>
              <h1 className="text-lg font-black tracking-tight text-[#9B2C2C] dark:text-[#F6AD55]">
                Community Events Manager
              </h1>
              <p className="text-xs text-stone-500 font-medium">
                Admin Panel • Workshops, Jam Nights & RSVPs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/blackboard"
              className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-bold text-stone-600 transition hover:bg-stone-100 dark:border-stone-800 dark:bg-stone-800 dark:text-stone-300"
            >
              Blackboard
            </Link>
            <Link
              href="/admin/rewards"
              className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-bold text-stone-600 transition hover:bg-stone-100 dark:border-stone-800 dark:bg-stone-800 dark:text-stone-300"
            >
              Rewards
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Col: Create Event */}
        <div className="md:col-span-1">
          <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-stone-900 dark:text-stone-100">
              Publish New Event
            </h2>

            {feedback && (
              <p
                className={`rounded-xl p-2.5 text-xs font-semibold ${
                  feedback.type === "error"
                    ? "border border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
                    : "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                }`}
              >
                {feedback.text}
              </p>
            )}

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                  Event Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Filter Coffee Cupping Workshop"
                  required
                  className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:border-[#9B2C2C] focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Details, schedule, what's included..."
                  rows={3}
                  required
                  className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:border-[#9B2C2C] focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                    Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    required
                    className="w-full rounded-xl border border-stone-300 bg-stone-50 px-2 py-1.5 text-[11px] text-stone-900 focus:border-[#9B2C2C] focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                    Capacity (Seats)
                  </label>
                  <input
                    type="number"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    min="1"
                    required
                    className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs text-stone-900 focus:border-[#9B2C2C] focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                  Join Note (Pricing / Walk-in Policy)
                </label>
                <input
                  type="text"
                  value={joinUrlOrNote}
                  onChange={(e) => setJoinUrlOrNote(e.target.value)}
                  placeholder="e.g. Free entry for members • ₹100 cover"
                  className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:border-[#9B2C2C] focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
              </div>

              <button
                type="submit"
                disabled={isCreating || !title.trim() || !startsAt}
                className="w-full rounded-2xl bg-[#9B2C2C] py-3 text-xs font-bold text-white shadow-md transition hover:bg-[#822424] active:scale-95 disabled:opacity-50 dark:bg-[#C53030]"
              >
                {isCreating ? "Publishing..." : "Publish Event"}
              </button>
            </form>
          </div>
        </div>

        {/* Right Col: Events List */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-stone-500">
              All Café Events ({events.length})
            </h2>
          </div>

          <div className="space-y-4">
            {events.map((event) => (
              <div
                key={event.id}
                className={`rounded-3xl border p-5 shadow-sm transition space-y-3 ${
                  event.active
                    ? "border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900"
                    : "border-stone-200 bg-stone-100/60 opacity-60 dark:border-stone-800 dark:bg-stone-900/40"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-mono font-bold text-[#9B2C2C] dark:text-[#F6AD55]">
                      {new Date(event.starts_at).toLocaleString("en-IN", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                      {event.title}
                    </h3>
                    <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                      {event.description}
                    </p>
                  </div>

                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-mono font-bold text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
                    {event.rsvps.length} / {event.capacity} RSVPs
                  </span>
                </div>

                {/* Attendees list (if any) */}
                {event.rsvps.length > 0 && (
                  <div className="rounded-2xl border border-stone-100 bg-stone-50 p-3 dark:border-stone-800 dark:bg-stone-800/40 text-xs">
                    <span className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                      Registered Guests:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {event.rsvps.map((r) => (
                        <span
                          key={r.id}
                          className="rounded-lg bg-white px-2 py-0.5 border border-stone-200 text-[11px] text-stone-700 dark:bg-stone-800 dark:border-stone-700 dark:text-stone-300 font-mono"
                        >
                          {r.guest_name || "Member"} {r.guest_contact ? `(${r.guest_contact})` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-stone-100 pt-3 dark:border-stone-800 text-xs">
                  <span className="font-medium text-stone-500">
                    {event.join_url_or_note || "Standard Entry"}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(event)}
                      className={`rounded-xl px-2.5 py-1 text-[11px] font-bold transition ${
                        event.active
                          ? "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300"
                          : "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      }`}
                    >
                      {event.active ? "Hide" : "Show"}
                    </button>
                    <button
                      onClick={() => handleDelete(event.id)}
                      className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};
