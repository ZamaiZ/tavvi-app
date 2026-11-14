"use server"

import type { FeedbackActionResult, FeedbackPage } from "@/features/feedback/model"
import { feedbackDeleteSchema, feedbackListSchema, feedbackReadSchema } from "./schema"
import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import { getFeedbackPage } from "./server/read"
import { deleteFeedback, markFeedbackRead } from "./server/write"

function invalidInput<T>(): FeedbackActionResult<T> {
  return { ok: false, code: "invalid_input" }
}

export async function listFeedbackAction(rawInput: unknown): Promise<FeedbackActionResult<FeedbackPage>> {
  const parsed = feedbackListSchema.safeParse(rawInput)
  if (!parsed.success) return invalidInput<FeedbackPage>()
  try {
    const restaurant = await getActivePanelRestaurant(parsed.data.expectedRestaurantId)
    if (!restaurant || restaurant.status !== "active") return { ok: false, code: "context_changed" }
    return { ok: true, data: await getFeedbackPage(restaurant, parsed.data.filter, parsed.data.cursor) }
  } catch {
    return { ok: false, code: "unavailable" }
  }
}

export async function markFeedbackReadAction(rawInput: unknown) {
  const parsed = feedbackReadSchema.safeParse(rawInput)
  return parsed.success ? markFeedbackRead(parsed.data) : invalidInput<{ readAt: string | null }>()
}

export async function deleteFeedbackAction(rawInput: unknown) {
  const parsed = feedbackDeleteSchema.safeParse(rawInput)
  return parsed.success ? deleteFeedback(parsed.data) : invalidInput<null>()
}
