"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import type { SongRequestStatus } from "@smol-cafe/db";
import {
  fetchStaffJukeboxAction,
  updateSongStatusAction,
  toggleMusicSessionAction,
  type StaffJukeboxData,
} from "@/app/music/actions";
import { Music, Check, SkipForward, Play, Flame } from "lucide-react";

interface StaffJukeboxDjProps {
  initialData: StaffJukeboxData;
}

export const StaffJukeboxDj: React.FC<StaffJukeboxDjProps> = ({ initialData }) => {
  const [data, setData] = useState<StaffJukeboxData>(initialData);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Poll staff DJ queue every 3s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const fresh = await fetchStaffJukeboxAction();
        if (fresh.success) {
          setData(fresh);
        }
      } catch (err) {
        console.error("DJ poll error:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleStatusUpdate = async (requestId: string, status: SongRequestStatus) => {
    setFeedback(null);
    try {
      const res = await updateSongStatusAction(requestId, status);
      if (res.success) {
        setFeedback(res.message || `Status updated to ${status}`);
        const fresh = await fetchStaffJukeboxAction();
        if (fresh.success) setData(fresh);
      }
    } catch {
      setFeedback("Failed to update status.");
    }
  };

  const handleToggleSession = async () => {
    if (!data.session) return;
    const isCurrentlyOpen = data.session.status === "OPEN";

    try {
      const res = await toggleMusicSessionAction(data.session.id, !isCurrentlyOpen);
      if (res.success) {
        setFeedback(res.message || "Session toggled.");
        const fresh = await fetchStaffJukeboxAction();
        if (fresh.success) setData(fresh);
      }
    } catch {
      setFeedback("Failed to toggle session.");
    }
  };

  const isOpen = data.session?.status === "OPEN";

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1C1917] pb-24 dark:bg-[#141211] dark:text-[#FDFBF7]">
      {/* Top Bar */}
      <header className="border-b border-stone-200/80 bg-white/70 px-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-4 backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-full border border-stone-200 bg-stone-50 p-2 text-stone-600 transition hover:bg-stone-100 dark:border-stone-800 dark:bg-stone-800 dark:text-stone-300"
            >
              ← Back
            </Link>
            <div>
              <h1 className="text-lg font-black tracking-tight text-[#9B2C2C] dark:text-[#F6AD55] flex items-center gap-2">
                <Music className="h-5 w-5" />
                Café Jukebox DJ Panel
              </h1>
              <p className="text-xs text-stone-500 font-medium">
                Live Song Moderation & Queue Controller
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleSession}
              className={`rounded-full px-3.5 py-1 text-xs font-bold transition shadow-sm flex items-center gap-1.5 ${
                isOpen
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-stone-300 text-stone-700 hover:bg-stone-400 dark:bg-stone-800 dark:text-stone-300"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${isOpen ? "bg-emerald-300 animate-pulse" : "bg-stone-500"}`} />
              {isOpen ? "Jukebox OPEN" : "Jukebox CLOSED"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-6 space-y-6">
        {feedback && (
          <div className="rounded-2xl border border-stone-200 bg-white p-3 text-xs font-bold text-stone-800 shadow-sm dark:border-stone-800 dark:bg-stone-900 dark:text-stone-200">
            {feedback}
          </div>
        )}

        {/* Currently Playing Card */}
        <section className="rounded-3xl border-2 border-stone-800 bg-[#1C1917] p-5 text-white shadow-xl">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#F6AD55]">
            Currently Playing on Sound System
          </span>
          {data.playingTrack ? (
            <div className="mt-2 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black">{data.playingTrack.track_name}</h2>
                <p className="text-xs text-stone-400">{data.playingTrack.artist}</p>
                <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-mono text-amber-300">
                  <Flame className="h-3 w-3" /> {data.playingTrack.vote_count} Upvotes
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleStatusUpdate(data.playingTrack!.id, "PLAYED")}
                  className="rounded-xl bg-stone-800 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-stone-700 flex items-center gap-1"
                >
                  <Check className="h-3.5 w-3.5" /> Finished
                </button>
                <button
                  onClick={() => handleStatusUpdate(data.playingTrack!.id, "SKIPPED")}
                  className="rounded-xl bg-stone-800 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-stone-700 flex items-center gap-1"
                >
                  Skip <SkipForward className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-xs text-stone-400">No track currently set to Playing.</p>
          )}
        </section>

        {/* 2-Column Grid: Pending Approvals & Live Queue */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Col 1: Pending Approvals */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Pending Approval ({data.pendingRequests.length})
              </h3>
            </div>

            {data.pendingRequests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 p-6 text-center text-xs text-stone-400 dark:border-stone-800">
                No pending song requests.
              </div>
            ) : (
              <div className="space-y-2">
                {data.pendingRequests.map((track) => (
                  <div
                    key={track.id}
                    className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20 space-y-2"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                        {track.track_name}
                      </h4>
                      <p className="text-[11px] text-stone-600 dark:text-stone-400 font-mono">
                        {track.artist}
                      </p>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleStatusUpdate(track.id, "QUEUED")}
                        className="flex-1 rounded-xl bg-emerald-600 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 flex items-center justify-center gap-1"
                      >
                        <Check className="h-3.5 w-3.5" /> Approve & Queue
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(track.id, "REJECTED")}
                        className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-stone-900 dark:text-red-300"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Col 2: Live Queued & Upvoted Tracks */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Queued by Upvotes ({data.queuedTracks.length})
              </h3>
            </div>

            {data.queuedTracks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 p-6 text-center text-xs text-stone-400 dark:border-stone-800">
                Queue is empty.
              </div>
            ) : (
              <div className="space-y-2">
                {data.queuedTracks.map((track, idx) => (
                  <div
                    key={track.id}
                    className="rounded-2xl border border-stone-200 bg-white p-3.5 shadow-sm dark:border-stone-800 dark:bg-stone-900 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <span className="font-mono text-xs font-black text-stone-400 w-4 text-center">
                        #{idx + 1}
                      </span>
                      <div className="overflow-hidden">
                        <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                          {track.track_name}
                        </h4>
                        <p className="text-[11px] text-stone-500 truncate">{track.artist}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-mono font-bold text-amber-900 dark:bg-amber-950/40 dark:text-amber-300 flex items-center gap-0.5">
                        <Flame className="h-3 w-3" /> {track.vote_count}
                      </span>
                      <button
                        onClick={() => handleStatusUpdate(track.id, "PLAYING")}
                        className="rounded-xl bg-[#9B2C2C] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#822424] dark:bg-[#C53030] flex items-center gap-1"
                      >
                        Play <Play className="h-3 w-3 fill-current" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};
