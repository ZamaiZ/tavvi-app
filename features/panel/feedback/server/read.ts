import "server-only"

import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import type { PanelRestaurantDTO } from "@/features/panel/onboarding/model"
import type { FeedbackCursor, FeedbackDTO, FeedbackFilter, FeedbackPage } from "@/features/feedback/model"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const FEEDBACK_PAGE_SIZE = 20
const CLEANUP_BATCH_SIZE = 20

type RawFeedback = {
  id: string
  restaurant_id: string
  body: string
  published_at: string
  read_at: string | null
}

type RawFeedbackMedia = {
  id: string
  feedback_id: string
  restaurant_id: string
  kind: "image" | "video"
  width: number
  height: number
  duration_ms: number | null
  position: number
}

type FeedbackCleanupCandidate = {
  feedback_id: string
  media_kind: "image" | "video" | null
  storage_path: string | null
}

function toFeedback(row: RawFeedback, media: RawFeedbackMedia[]): FeedbackDTO {
  return {
    id: row.id,
    body: row.body,
    publishedAt: row.published_at,
    readAt: row.read_at,
    media: media.map((item) => ({
      id: item.id,
      kind: item.kind,
      url: `/painel/feedback/media/${item.id}`,
      width: item.width,
      height: item.height,
      durationMs: item.duration_ms,
      position: item.position,
    })),
  }
}

async function cleanupExpiredFeedbackDrafts(restaurant: PanelRestaurantDTO) {
  try {
    const supabase = await createSupabaseServerClient("panel")
    const { data, error } = await supabase.rpc("feedback_cleanup_candidates", {
      p_restaurant_id: restaurant.id,
    })
    if (error || !data?.length) return

    const candidates = data as unknown as FeedbackCleanupCandidate[]
    const draftIds = [...new Set(candidates.map((candidate) => candidate.feedback_id))].slice(0, CLEANUP_BATCH_SIZE)

    const pathsByBucket = new Map<string, string[]>()
    for (const row of candidates) {
      if (!row.storage_path || !row.media_kind) continue
      const bucket = row.media_kind === "image" ? "feedback-images" : "feedback-videos"
      pathsByBucket.set(bucket, [...(pathsByBucket.get(bucket) ?? []), row.storage_path])
    }
    const cleanupResults = await Promise.all([...pathsByBucket].map(async ([bucket, paths]) =>
      supabase.storage.from(bucket).remove([...new Set(paths)])))
    if (cleanupResults.some((result) => result.error)) return

    const { error: cleanupError } = await supabase.rpc("cleanup_feedback_drafts", {
      p_restaurant_id: restaurant.id,
      p_feedback_ids: draftIds,
    })
    if (cleanupError) console.warn("[panel-feedback] expired feedback cleanup failed", { code: cleanupError.code })
  } catch {
    // Expired draft cleanup is best-effort and must not block the inbox.
  }
}

export async function getFeedbackPage(
  restaurant: PanelRestaurantDTO,
  filter: FeedbackFilter,
  cursor?: FeedbackCursor,
): Promise<FeedbackPage> {
  await cleanupExpiredFeedbackDrafts(restaurant)
  const supabase = await createSupabaseServerClient("panel")
  let query = supabase
    .from("restaurant_feedback")
    .select("id,restaurant_id,body,published_at,read_at")
    .eq("restaurant_id", restaurant.id)
    .eq("status", "published")

  if (filter === "unread") query = query.is("read_at", null)
  if (cursor) {
    const publishedAt = new Date(cursor.publishedAt).toISOString()
    query = query.or(`published_at.lt.${publishedAt},and(published_at.eq.${publishedAt},id.lt.${cursor.id})`)
  }

  const { data, error } = await query
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(FEEDBACK_PAGE_SIZE + 1)
  if (error || !data) {
    console.error("[panel-feedback] list failed", { code: error?.code })
    throw new Error("panel_feedback_unavailable")
  }

  const rows = (data as unknown as RawFeedback[]).slice(0, FEEDBACK_PAGE_SIZE)
  const ids = rows.map((row) => row.id)
  let media: RawFeedbackMedia[] = []
  if (ids.length) {
    const result = await supabase
      .from("restaurant_feedback_media")
      .select("id,feedback_id,restaurant_id,kind,width,height,duration_ms,position")
      .eq("restaurant_id", restaurant.id)
      .in("feedback_id", ids)
      .order("feedback_id", { ascending: true })
      .order("position", { ascending: true })
      .order("id", { ascending: true })
    if (result.error || !result.data) {
      console.error("[panel-feedback] media list failed", { code: result.error?.code })
      throw new Error("panel_feedback_unavailable")
    }
    media = result.data as unknown as RawFeedbackMedia[]
  }

  const mediaByFeedback = new Map<string, RawFeedbackMedia[]>()
  for (const item of media) mediaByFeedback.set(item.feedback_id, [...(mediaByFeedback.get(item.feedback_id) ?? []), item])
  const items = rows.map((row) => toFeedback(row, mediaByFeedback.get(row.id) ?? []))
  const last = items.at(-1)
  return {
    items,
    nextCursor: data.length > FEEDBACK_PAGE_SIZE && last
      ? { publishedAt: last.publishedAt, id: last.id }
      : null,
  }
}

export async function getUnreadFeedbackCount(restaurantId: string) {
  try {
    const restaurant = await getActivePanelRestaurant(restaurantId)
    if (!restaurant || restaurant.status !== "active") return 0
    const supabase = await createSupabaseServerClient("panel")
    const { count, error } = await supabase
      .from("restaurant_feedback")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurant.id)
      .eq("status", "published")
      .is("read_at", null)
    if (error || count === null) return 0
    return count
  } catch {
    return 0
  }
}
