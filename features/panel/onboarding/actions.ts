"use server"

import {
  completePanelRestaurantOnboardingSchema,
  savePanelRestaurantDraftSchema,
} from "@/features/panel/onboarding/schema"
import {
  persistPanelRestaurantProfile,
  type PanelOnboardingPersistenceResult,
} from "@/features/panel/onboarding/server/persistence"

export type PanelOnboardingActionResult = PanelOnboardingPersistenceResult

export async function savePanelRestaurantDraftAction(rawInput: unknown): Promise<PanelOnboardingActionResult> {
  const parsed = savePanelRestaurantDraftSchema.safeParse(rawInput)
  if (!parsed.success || parsed.data.restaurantId !== parsed.data.expectedRestaurantId) {
    return { ok: false, code: "invalid_input" }
  }
  return persistPanelRestaurantProfile({ intent: "draft", input: parsed.data })
}

export async function completePanelRestaurantOnboardingAction(rawInput: unknown): Promise<PanelOnboardingActionResult> {
  const parsed = completePanelRestaurantOnboardingSchema.safeParse(rawInput)
  if (!parsed.success || parsed.data.restaurantId !== parsed.data.expectedRestaurantId) {
    return { ok: false, code: "invalid_input" }
  }
  return persistPanelRestaurantProfile({ intent: "complete", input: parsed.data })
}
