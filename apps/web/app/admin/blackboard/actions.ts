"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { BlackboardPost } from "@smol-cafe/db";
import { broadcastSyncEvent } from "@/lib/sync-events";

export interface CreateBlackboardInput {
  title: string;
  body: string;
  imageUrl?: string;
  active?: boolean;
  startsAt?: string;
  endsAt?: string;
}

export interface BlackboardMutationResult {
  success: boolean;
  post?: BlackboardPost;
  message?: string;
  error?: string;
}

/**
 * Public Server Action: Fetches the single currently active & scheduled blackboard announcement.
 * Falls back gracefully to null if none is active.
 */
export async function fetchActiveBlackboardPostAction(): Promise<BlackboardPost | null> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  try {
    const { data: post, error } = await supabase
      .from("blackboard_posts")
      .select("*")
      .eq("active", true)
      .lte("starts_at", nowIso)
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !post) {
      return null;
    }

    return post as BlackboardPost;
  } catch (err) {
    console.error("Error fetching active blackboard post:", err);
    return null;
  }
}

/**
 * Admin Server Action: Fetches all blackboard posts for management
 */
export async function fetchAllBlackboardPostsAction(): Promise<{
  posts: BlackboardPost[];
  success: boolean;
}> {
  const supabase = createAdminClient();

  try {
    const { data: posts, error } = await supabase
      .from("blackboard_posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching all blackboard posts:", error);
      return { posts: [], success: false };
    }

    return { posts: (posts as BlackboardPost[]) || [], success: true };
  } catch (err) {
    console.error("Error in fetchAllBlackboardPostsAction:", err);
    return { posts: [], success: false };
  }
}

import { requireStaffAuth } from "@/lib/auth/rbac";

/**
 * Admin Server Action: Creates a new blackboard announcement
 */
export async function createBlackboardPostAction(
  input: CreateBlackboardInput
): Promise<BlackboardMutationResult> {
  const auth = await requireStaffAuth(["admin", "super_admin"]);
  if (!auth.authorized) {
    return { success: false, error: auth.error, message: auth.message || "Unauthorized." };
  }

  const supabase = createAdminClient();

  if (!input.title.trim() || !input.body.trim()) {
    return { success: false, message: "Title and body text are required." };
  }

  try {
    const { data: post, error } = await supabase
      .from("blackboard_posts")
      .insert({
        title: input.title.trim(),
        body: input.body.trim(),
        image_url: input.imageUrl?.trim() || null,
        active: input.active !== undefined ? input.active : true,
        starts_at: input.startsAt || new Date().toISOString(),
        ends_at: input.endsAt || null,
      })
      .select("*")
      .single();

    if (error || !post) {
      console.error("Error creating blackboard post:", error);
      return { success: false, message: "Failed to create blackboard post." };
    }

    broadcastSyncEvent({
      type: "SETTINGS_UPDATED",
      metadata: { entity: "blackboard", action: "create", id: post.id },
      timestamp: Date.now(),
    });

    return {
      success: true,
      post: post as BlackboardPost,
      message: "Blackboard announcement created!",
    };
  } catch (err) {
    console.error("Error in createBlackboardPostAction:", err);
    return { success: false, message: "An unexpected error occurred." };
  }
}

/**
 * Admin Server Action: Toggles blackboard post active status
 */
export async function toggleBlackboardActiveAction(
  id: string,
  active: boolean
): Promise<BlackboardMutationResult> {
  const auth = await requireStaffAuth(["admin", "super_admin"]);
  if (!auth.authorized) {
    return { success: false, error: auth.error, message: auth.message || "Unauthorized." };
  }

  const supabase = createAdminClient();

  try {
    const { data: post, error } = await supabase
      .from("blackboard_posts")
      .update({ active, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();

    if (error || !post) {
      return { success: false, message: "Failed to update blackboard status." };
    }

    broadcastSyncEvent({
      type: "SETTINGS_UPDATED",
      metadata: { entity: "blackboard", action: "toggle", id, active },
      timestamp: Date.now(),
    });

    return {
      success: true,
      post: post as BlackboardPost,
      message: `Announcement is now ${active ? "live" : "hidden"}.`,
    };
  } catch (err) {
    console.error("Error in toggleBlackboardActiveAction:", err);
    return { success: false, message: "Failed to toggle status." };
  }
}

/**
 * Admin Server Action: Deletes a blackboard post
 */
export async function deleteBlackboardPostAction(
  id: string
): Promise<{ success: boolean; message?: string }> {
  const auth = await requireStaffAuth(["admin", "super_admin"]);
  if (!auth.authorized) {
    return { success: false, message: auth.message || "Unauthorized." };
  }

  const supabase = createAdminClient();

  try {
    const { error } = await supabase.from("blackboard_posts").delete().eq("id", id);
    if (error) {
      return { success: false, message: "Failed to delete post." };
    }

    broadcastSyncEvent({
      type: "SETTINGS_UPDATED",
      metadata: { entity: "blackboard", action: "delete", id },
      timestamp: Date.now(),
    });

    return { success: true, message: "Post deleted successfully." };
  } catch {
    return { success: false, message: "An unexpected error occurred." };
  }
}
