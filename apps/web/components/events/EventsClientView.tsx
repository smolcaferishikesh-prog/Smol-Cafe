"use client";

import React, { useState } from "react";
import Link from "next/link";
import { fetchUpcomingEventsAction, registerEventRsvpAction, type CustomerEventView } from "@/app/events/actions";
import { BottomNavBar } from "@/components/navigation/BottomNavBar";
import { Coffee, Calendar } from "lucide-react";

interface EventsClientViewProps {
  initialEvents: CustomerEventView[];
}

export const EventsClientView: React.FC<EventsClientViewProps> = ({ initialEvents }) => {
  const [events, setEvents] = useState<CustomerEventView[]>(initialEvents);
  const [activeModalEvent, setActiveModalEvent] = useState<CustomerEventView | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [partySize, setPartySize] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleRsvpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalEvent || !guestName.trim()) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await registerEventRsvpAction(
        activeModalEvent.id,
        guestName,
        guestPhone
      );


      if (res.success) {
        setFeedback({ type: "success", text: res.message || "RSVP confirmed! See you at Smol Café." });
        // Refresh events list
        const fresh = await fetchUpcomingEventsAction();
        if (fresh.success) setEvents(fresh.events);
        setTimeout(() => {
          setActiveModalEvent(null);
          setFeedback(null);
          setGuestName("");
          setGuestPhone("");
        }, 1800);
      } else {
        setFeedback({ type: "error", text: res.message || "Could not reserve spot." });
      }
    } catch {
      setFeedback({ type: "error", text: "Something went wrong. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3E7D3] text-[#241F1C] pb-28 font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-[#E8DFD3]/80 bg-[#F5EFEB]/90 px-4 py-3.5 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Link
            href="/home"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#1C1917] transition hover:bg-black/5 active:scale-95"
            aria-label="Back to home"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>

          <h1 className="font-serif text-xl font-bold tracking-tight text-[#1C1917]">
            Café Events
          </h1>

          <div className="w-9" />
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-md px-4 pt-4 space-y-4">
        {/* Intro Card */}
        <div className="rounded-3xl border border-[#E2D7C7] bg-[#FAF5ED] p-5 shadow-xs">
          <span className="block font-mono text-[10px] font-bold uppercase tracking-widest text-[#A62B34]">
            COMMUNITY &amp; SESSIONS
          </span>
          <h2 className="font-serif text-2xl font-bold text-[#1C1917] mt-0.5">
            Gather &amp; Celebrate
          </h2>
          <p className="font-serif italic text-xs text-[#786F66] mt-1 leading-relaxed">
            Live music sets, open mic poetry, board game evenings, and filter coffee workshops by the Ganga.
          </p>
        </div>

        {/* Events List */}
        <div className="space-y-3.5">
          {events.length === 0 ? (
            <div className="rounded-2xl border border-[#E2D7C7] bg-[#FCF8F2] p-8 text-center">
              <Coffee className="h-7 w-7 text-[#786F66] mx-auto" />
              <p className="font-serif text-sm font-bold text-[#1C1917] mt-2">
                No upcoming events this week
              </p>
              <p className="font-serif italic text-xs text-[#786F66] mt-0.5">
                Check back soon or ask our baristas for spontaneous jam sessions!
              </p>
            </div>
          ) : (
            events.map((ev) => {
              const dateStr = new Date(ev.startsAt).toLocaleDateString("en-IN", {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
              const timeStr = new Date(ev.startsAt).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              });
              const spotsLeft = Math.max(0, ev.capacity - ev.rsvpCount);

              return (
                <div
                  key={ev.id}
                  className="rounded-2xl border border-[#E8DFD3] bg-[#FAF5ED] p-4 shadow-xs transition hover:border-[#D8CEBF]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#EBF3F4] border border-[#D0E2E5] px-2.5 py-0.5 text-[10px] font-bold text-[#2A5258]">
                        <Calendar className="h-3 w-3" /> {dateStr} • {timeStr}
                      </span>
                      <h3 className="font-serif text-base font-bold text-[#1C1917] mt-1.5">
                        {ev.title}
                      </h3>
                    </div>

                    <span className="font-mono text-xs font-bold text-[#786F66] shrink-0 bg-[#FCF8F2] border border-[#E2D7C7] px-2 py-0.5 rounded-lg">
                      {spotsLeft} spots left
                    </span>
                  </div>

                  <p className="font-serif italic text-xs text-[#786F66] mt-2 leading-relaxed">
                    {ev.description}
                  </p>

                  <div className="mt-4 flex items-center justify-between pt-2 border-t border-[#EADFCF]">
                    <span className="font-serif text-xs font-semibold text-[#3D352E]">
                      Free Entry • RSVP Required
                    </span>

                    <button
                      type="button"
                      disabled={ev.isFull || ev.isRegistered}
                      onClick={() => setActiveModalEvent(ev)}
                      className={`rounded-full px-4 py-1.5 font-serif text-xs font-bold transition shadow-xs ${
                        ev.isRegistered
                          ? "bg-[#2E7D32] text-white"
                          : ev.isFull
                            ? "bg-stone-300 text-stone-600 cursor-not-allowed"
                            : "bg-[#A62B34] text-white hover:bg-[#91242C] active:scale-95"
                      }`}
                    >
                      {ev.isRegistered ? "✓ Registered" : ev.isFull ? "Full" : "RSVP Now →"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* RSVP Modal */}
      {activeModalEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs"
            onClick={() => setActiveModalEvent(null)}
          />

          <div className="relative z-10 w-full max-w-sm rounded-3xl border border-[#E2D7C7] bg-[#FAF5ED] p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="font-serif text-lg font-bold text-[#1C1917]">
              RSVP for {activeModalEvent.title}
            </h3>
            <p className="font-serif italic text-xs text-[#786F66] mt-0.5">
              Reserve your spot at Smol Café Rishikesh.
            </p>

            {feedback && (
              <div
                className={`mt-3 rounded-xl p-3 text-xs font-serif ${
                  feedback.type === "success"
                    ? "bg-emerald-100 text-emerald-900"
                    : "bg-rose-100 text-rose-900"
                }`}
              >
                {feedback.text}
              </div>
            )}

            <form onSubmit={handleRsvpSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block font-serif text-xs font-bold text-[#1C1917] mb-1">
                  Your Name *
                </label>
                <input
                  type="text"
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="e.g. Sonu Singh"
                  className="w-full rounded-xl border border-[#D8CEBF] bg-[#FCF8F2] px-3 py-2 text-xs text-[#1C1917] placeholder-[#A89D91] focus:outline-hidden focus:ring-1 focus:ring-[#A62B34]"
                />
              </div>

              <div>
                <label className="block font-serif text-xs font-bold text-[#1C1917] mb-1">
                  Phone (for reminders)
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="9876543210"
                  className="w-full rounded-xl border border-[#D8CEBF] bg-[#FCF8F2] px-3 py-2 text-xs text-[#1C1917] placeholder-[#A89D91] focus:outline-hidden focus:ring-1 focus:ring-[#A62B34]"
                />
              </div>

              <div>
                <label className="block font-serif text-xs font-bold text-[#1C1917] mb-1">
                  Guests / Party Size
                </label>
                <select
                  value={partySize}
                  onChange={(e) => setPartySize(Number(e.target.value))}
                  className="w-full rounded-xl border border-[#D8CEBF] bg-[#FCF8F2] px-3 py-2 text-xs text-[#1C1917] focus:outline-hidden focus:ring-1 focus:ring-[#A62B34]"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "Person" : "People"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModalEvent(null)}
                  className="flex-1 rounded-full border border-[#D8CEBF] bg-[#FAF5ED] py-2.5 text-xs font-serif font-bold text-[#1C1917]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-full bg-[#A62B34] py-2.5 text-xs font-serif font-bold text-white shadow-md hover:bg-[#91242C] active:scale-95 disabled:opacity-60"
                >
                  {isSubmitting ? "Confirming..." : "Confirm RSVP"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
