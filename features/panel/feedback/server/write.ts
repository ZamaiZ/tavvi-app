import "server-only"

import { revalidatePath } from "next/cache"

import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { FeedbackActionResult } from "@/features/feedback/model"

type FeedbackContext = {
  restaurant: NonNullable<Awaited<ReturnType<typeof getActivePanelRestaurant>>>
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
}

type FeedbackRemovalRow = {
  feedback_id: string
  media_kind: "image" | "video" | null
  storage_path: string | null
}

function contextFailure<T>(cause: unknown): FeedbackActionResult<T> {
  const message = cause instanceof Error ? cause.message : ""
  if (message === "panel_auth_required") return { ok: false, code: "unavailable" }
  if (message === "panel_restaurant_context_changed" || message === "panel_restaurant_not_found") {
    return { ok: false, code: "context_changed" }
  }
  return { ok: false, code: "unavailable" }
}

async function getFeedbackContext(expectedRestaurantId: string): Promise<FeedbackContext> {
  const restaurant = await getActivePanelRestaurant(expectedRestaurantId)
  if (!restaurant || restaurant.status !== "active") throw new Error("panel_restaurant_context_changed")
  const supabase = await createSupabaseServerClient("panel")
  return { restaurant, supabase }
}

function revalidateFeedback(slug: string) {
  revalidatePath("/painel/feedback")
  revalidatePath(`/${slug}`)
}

export async function markFeedbackRead({
  expectedRestaurantId,
  feedbackId,
  read,
}: {
  expectedRestaurantId: string
  feedbackId: string
  read: boolean
}): Promise<FeedbackActionResult<{ readAt: string | null }>> {
  try {
    const { restaurant, supabase } = await getFeedbackContext(expectedRestaurantId)
    const readAt = read ? new Date().toISOString() : null
    const { data, error } = await supabase
      .from("restaurant_feedback")
      .update({ read_at: readAt })
      .eq("id", feedbackId)
      .eq("restaurant_id", restaurant.id)
      .eq("status", "published")
      .select("id,read_at")
      .maybeSingle()
    if (error || !data) return { ok: false, code: error ? "unavailable" : "not_found" }
    revalidateFeedback(restaurant.slug)
    return { ok: true, data: { readAt: data.read_at } }
  } catch (cause) {
    return contextFailure(cause)
  }
}

export async function deleteFeedback({
  expectedRestaurantId,
  feedbackId,
}: {
  expectedRestaurantId: string
  feedbackId: string
}): Promise<FeedbackActionResult<null>> {
  try {
    const { restaurant, supabase } = await getFeedbackContext(expectedRestaurantId)
    const { data, error } = await supabase.rpc("delete_feedback", {
      p_restaurant_id: restaurant.id,
      p_feedback_id: feedbackId,
    })
    if (error) return { ok: false, code: "unavailable" }
    const mediaRows = (data ?? []) as unknown as FeedbackRemovalRow[]
    if (!mediaRows.length || mediaRows.some((row) => row.feedback_id !== feedbackId)) {
      return { ok: false, code: "not_found" }
    }

    const pathsByBucket = new Map<string, string[]>()
    for (const item of mediaRows) {
      if (!item.storage_path || !item.media_kind) continue
      const bucket = item.media_kind === "image" ? "feedback-images" : "feedback-videos"
      pathsByBucket.set(bucket, [...(pathsByBucket.get(bucket) ?? []), item.storage_path])
    }
    try {
      const removals = await Promise.all([...pathsByBucket].map(async ([bucket, paths]) =>
        supabase.storage.from(bucket).remove([...new Set(paths)])))
      if (removals.some((result) => result.error)) {
        console.warn("[panel-feedback] media cleanup deferred", { feedbackId })
      }
    } catch {
      console.warn("[panel-feedback] media cleanup deferred", { feedbackId })
    }
    revalidateFeedback(restaurant.slug)
    return { ok: true, data: null }
  } catch (cause) {
    return contextFailure(cause)
  }
}
