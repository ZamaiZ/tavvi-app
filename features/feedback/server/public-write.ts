import "server-only"

import { randomUUID } from "node:crypto"

import { createSupabasePublicClient } from "@/lib/supabase/public"
import type { FeedbackActionResult, StartedFeedback, FeedbackUploadTicket } from "../model"
import { startFeedbackSchema, type StartFeedbackInput } from "../schema"
import { getFeedbackServerKey } from "./config"
import { checkFeedbackRateLimit } from "./rate-limit"

type BeginFeedbackRow = {
  feedback_id: string
  storage_path: string | null
  bucket_id: FeedbackUploadTicket["bucket"] | null
  media_position: number | null
}

function mapPublicFailure(cause: unknown): FeedbackActionResult<never> {
  const source = cause && typeof cause === "object" ? cause as Record<string, unknown> : {}
  const message = typeof source.message === "string" ? source.message : cause instanceof Error ? cause.message : ""
  const code = typeof source.code === "string" ? source.code : ""

  if (message.includes("feedback_invalid") || ["22023", "22P02", "23514"].includes(code)) {
    return { ok: false, code: "invalid_input" }
  }
  if (message.includes("feedback_capped")) return { ok: false, code: "rate_limited" }
  if (message.includes("feedback_expired")) return { ok: false, code: "draft_expired" }
  if (message.includes("feedback_media_missing")) return { ok: false, code: "media_missing" }
  if (message.includes("feedback_unavailable")) return { ok: false, code: "context_changed" }
  return { ok: false, code: "unavailable" }
}

function isHoneypotFilled(rawInput: unknown) {
  return Boolean(rawInput && typeof rawInput === "object" &&
    "website" in rawInput && typeof rawInput.website === "string" && rawInput.website.trim())
}

export async function startPublicFeedback(input: StartFeedbackInput): Promise<FeedbackActionResult<StartedFeedback>> {
  try {
    const key = getFeedbackServerKey()
    if (!await checkFeedbackRateLimit({
      key,
      scope: `start:${input.slug}`,
      bucket: "feedback:start",
      max: 5,
    })) return { ok: false, code: "rate_limited" }

    const supabase = createSupabasePublicClient()
    const { data, error } = await supabase.rpc("begin_feedback", {
      p_key: key,
      p_slug: input.slug,
      p_body: input.body,
      p_media: input.media.map((media) => ({
        kind: media.kind,
        mime: media.mime,
        byteSize: media.byteSize,
        width: media.width,
        height: media.height,
        durationMs: media.durationMs,
      })),
    })
    if (error) throw error

    const rows = Array.isArray(data) ? data as BeginFeedbackRow[] : []
    const first = rows[0]
    if (!first || typeof first.feedback_id !== "string") throw new Error("feedback_invalid_response")
    const mediaRows = rows.filter((row) => row.storage_path || row.bucket_id || row.media_position !== null)
    const uploads = await Promise.all(mediaRows.map(async (row): Promise<FeedbackUploadTicket> => {
      if (!row.storage_path || !row.bucket_id || typeof row.media_position !== "number") {
        throw new Error("feedback_invalid_media_reservation")
      }
      if (row.bucket_id !== "feedback-images" && row.bucket_id !== "feedback-videos") {
        throw new Error("feedback_invalid_bucket")
      }
      const { data: signed, error: signedError } = await supabase.storage
        .from(row.bucket_id)
        .createSignedUploadUrl(row.storage_path, { upsert: false })
      if (signedError || !signed?.signedUrl) throw new Error("feedback_upload_ticket_unavailable")
      return { position: row.media_position, bucket: row.bucket_id, signedUrl: signed.signedUrl }
    }))

    return { ok: true, data: { feedbackId: first.feedback_id, uploads } }
  } catch (cause) {
    return mapPublicFailure(cause)
  }
}

export async function startPublicFeedbackActionInput(rawInput: unknown): Promise<FeedbackActionResult<StartedFeedback>> {
  if (isHoneypotFilled(rawInput)) {
    return { ok: true, data: { feedbackId: randomUUID(), uploads: [], ignored: true } }
  }

  const parsed = startFeedbackSchema.safeParse(rawInput)
  if (!parsed.success) return { ok: false, code: "invalid_input" }
  return startPublicFeedback(parsed.data)
}

export async function publishPublicFeedback(feedbackId: string): Promise<FeedbackActionResult<null>> {
  try {
    const key = getFeedbackServerKey()
    if (!await checkFeedbackRateLimit({
      key,
      scope: "publish",
      bucket: "feedback:publish",
      max: 10,
    })) return { ok: false, code: "rate_limited" }

    const supabase = createSupabasePublicClient()
    const { error } = await supabase.rpc("publish_feedback", {
      p_key: key,
      p_feedback_id: feedbackId,
    })
    if (error) throw error
    return { ok: true, data: null }
  } catch (cause) {
    return mapPublicFailure(cause)
  }
}
