import { z } from "zod"

import { panelOnboardingStepSchema, panelRestaurantDraftProfileSchema } from "./schema"
import { PANEL_ONBOARDING_ERROR_CODES } from "./errors"

export const panelRestaurantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(120),
  slug: z.string().min(3).max(89),
  status: z.enum(["draft", "active", "suspended"]),
  menuStatus: z.enum(["draft", "published"]),
  description: z.string().nullable(),
  segment: z.string().nullable(),
  theme: z.unknown(),
  menuPresentation: z.enum(["immersive", "catalog-list", "catalog-grid"]),
  logoPath: z.string().nullable(),
  coverPath: z.string().nullable(),
  contact: z.unknown(),
  onboardingStep: panelOnboardingStepSchema,
})

export type PanelRestaurantDTO = z.infer<typeof panelRestaurantSchema>

export const panelRestaurantDraftResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), restaurantId: z.string().uuid(), status: z.literal("draft") }),
  z.object({ ok: z.literal(false), code: z.enum(["unauthorized", "not_found", "invalid_input", "unavailable"]) }),
])

export const panelRestaurantCompletionResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), restaurantId: z.string().uuid(), status: z.literal("active") }),
  z.object({ ok: z.literal(false), code: z.enum(["unauthorized", "not_found", "invalid_input", "unavailable"]) }),
])

export const panelOnboardingSaveResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    restaurantId: z.string().uuid(),
    status: z.enum(["draft", "active"]),
    savedPaths: z.object({ logoPath: z.string().max(500).nullable(), coverPath: z.string().max(500).nullable() }),
  }),
  z.object({
    ok: z.literal(false),
    code: z.enum(PANEL_ONBOARDING_ERROR_CODES),
  }),
])

export const panelDraftProfileSchema = panelRestaurantDraftProfileSchema
