"use server"

import type { FeedbackActionResult, StartedFeedback } from "./model"
import { publishFeedbackSchema } from "./schema"
import { publishPublicFeedback, startPublicFeedbackActionInput } from "./server/public-write"

export async function startFeedbackAction(rawInput: unknown): Promise<FeedbackActionResult<StartedFeedback>> {
  return startPublicFeedbackActionInput(rawInput)
}

export async function publishFeedbackAction(rawInput: unknown): Promise<FeedbackActionResult<null>> {
  const parsed = publishFeedbackSchema.safeParse(rawInput)
  if (!parsed.success) return { ok: false, code: "invalid_input" }
  return publishPublicFeedback(parsed.data.feedbackId)
}
