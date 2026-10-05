"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BlackboardPost } from "@smol-cafe/db";
import {
  createBlackboardPostAction,
  toggleBlackboardActiveAction,
  deleteBlackboardPostAction,
  fetchAllBlackboardPostsAction,
  type CreateBlackboardInput,
} from "@/app/admin/blackboard/actions";
import { broadcastSyncEvent, subscribeToSyncEvents } from "@/lib/sync-events";

interface BlackboardManagerProps {
  initialPosts: BlackboardPost[];
}

export const BlackboardManager: React.FC<BlackboardManagerProps> = ({ initialPosts }) => {
  const router = useRouter();
  const [posts, setPosts] = useState<BlackboardPost[]>(initialPosts);
  const [isCreating, setIsCreating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const togglingIdsRef = React.useRef<Set<string>>(new Set());

  const refreshPosts = useCallback(async () => {
    try {
      const res = await fetchAllBlackboardPostsAction();
      if (res.success && res.posts) {
        setPosts(res.posts);
      } else {
        router.refresh();
      }
    } catch {
      router.refresh();
    }
  }, [router]);

  useEffect(() => {
    const unsub = subscribeToSyncEvents((event) => {
      if (event.type === "SETTINGS_UPDATED") {
        refreshPosts();
      }
    });

    const handleFocus = () => {
      refreshPosts();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleFocus);

    return () => {
      unsub();
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleFocus);
    };
  }, [refreshPosts]);

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!title.trim() || !body.trim()) {
      setFeedback({ type: "error", text: "Please provide both title and body text." });
      return;
    }

    const payload: CreateBlackboardInput = {
      title,
      body,
      imageUrl: imageUrl.trim() || undefined,
      startsAt: startsAt ? new Date(startsAt).toISOString() : new Date().toISOString(),
      endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
      active: true,
    };

    setIsCreating(true);
    try {
      const res = await createBlackboardPostAction(payload);
      if (res.success && res.post) {
        setPosts((prev) => [res.post!, ...prev]);
        setTitle("");
        setBody("");
        setImageUrl("");
        setStartsAt("");
        setEndsAt("");
        setFeedback({
          type: "success",
          text: res.message || "Announcement published to blackboard!",
        });
        broadcastSyncEvent({ type: "SETTINGS_UPDATED", timestamp: Date.now() });
      } else {
        setFeedback({ type: "error", text: res.message || "Failed to create announcement." });
      }
    } catch {
      setFeedback({ type: "error", text: "An error occurred." });
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggle = async (post: BlackboardPost) => {
    if (togglingIdsRef.current.has(post.id)) return;
    togglingIdsRef.current.add(post.id);

    const targetActive = !post.active;
    const prevPosts = posts;

    // Instant 0ms Optimistic UI Update
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, active: targetActive } : p))
    );

    try {
      const res = await toggleBlackboardActiveAction(post.id, targetActive);
      if (res.success && res.post) {
        setPosts((prev) => prev.map((p) => (p.id === post.id ? res.post! : p)));
        broadcastSyncEvent({ type: "SETTINGS_UPDATED", timestamp: Date.now() });
      } else {
        setPosts(prevPosts); // Rollback
        setFeedback({ type: "error", text: res.message || "Failed to toggle status." });
      }
    } catch {
      setPosts(prevPosts); // Rollback
      setFeedback({ type: "error", text: "Failed to toggle status." });
    } finally {
      togglingIdsRef.current.delete(post.id);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this blackboard post?")) return;

    try {
      const res = await deleteBlackboardPostAction(id);
      if (res.success) {
        setPosts((prev) => prev.filter((p) => p.id !== id));
        broadcastSyncEvent({ type: "SETTINGS_UPDATED", timestamp: Date.now() });
      }
    } catch {
      setFeedback({ type: "error", text: "Failed to delete post." });
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
                Blackboard Specials & Chits
              </h1>
              <p className="text-xs text-stone-500 font-medium">
                Admin Panel • Daily Specials & Announcements
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/rewards"
              className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-bold text-stone-600 transition hover:bg-stone-100 dark:border-stone-800 dark:bg-stone-800 dark:text-stone-300"
            >
              Rewards
            </Link>
            <Link
              href="/kitchen"
              className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-bold text-stone-600 transition hover:bg-stone-100 dark:border-stone-800 dark:bg-stone-800 dark:text-stone-300"
            >
              Kitchen
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Col: Create Post */}
        <div className="md:col-span-1">
          <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-stone-900 dark:text-stone-100">
              New Blackboard Chit
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
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Afternoon Fresh Bakes"
                  required
                  className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:border-[#9B2C2C] focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                  Chalk Note / Body
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write the message that appears on the customer home screen..."
                  rows={4}
                  required
                  className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:border-[#9B2C2C] focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                  Image URL (Optional)
                </label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:border-[#9B2C2C] focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                    Starts (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-stone-50 px-2 py-1.5 text-[11px] text-stone-900 focus:border-[#9B2C2C] focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                    Ends (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-stone-50 px-2 py-1.5 text-[11px] text-stone-900 focus:border-[#9B2C2C] focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreating || !title.trim()}
                className="w-full rounded-2xl bg-[#9B2C2C] py-3 text-xs font-bold text-white shadow-md transition hover:bg-[#822424] active:scale-95 disabled:opacity-50 dark:bg-[#C53030]"
              >
                {isCreating ? "Pinning..." : "Pin to Blackboard"}
              </button>
            </form>
          </div>
        </div>

        {/* Right Col: Posts List */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-stone-500">
              All Announcements ({posts.length})
            </h2>
          </div>

          <div className="space-y-3">
            {posts.map((post) => (
              <div
                key={post.id}
                className={`rounded-2xl border p-4 shadow-sm transition space-y-3 ${
                  post.active
                    ? "border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900"
                    : "border-stone-200 bg-stone-100/60 opacity-60 dark:border-stone-800 dark:bg-stone-900/40"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                      {post.title}
                    </h3>
                    <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 whitespace-pre-line">
                      {post.body}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                      post.active
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-400"
                    }`}
                  >
                    {post.active ? "Live" : "Inactive"}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-stone-100 pt-3 dark:border-stone-800 text-[11px] text-stone-400 font-mono">
                  <span>
                    Posted:{" "}
                    {new Date(post.created_at).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(post)}
                      className={`rounded-xl px-2.5 py-1 text-[11px] font-bold transition ${
                        post.active
                          ? "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300"
                          : "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      }`}
                    >
                      {post.active ? "Hide" : "Show"}
                    </button>
                    <button
                      onClick={() => handleDelete(post.id)}
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
