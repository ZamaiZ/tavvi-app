import { z } from "zod"

import { PANEL_MENU_PRESENTATIONS, panelContactDraftSchema, panelThemeSchema, completePanelRestaurantProfileSchema } from "@/features/panel/onboarding/schema"

export const activeIdentitySchema = z.object({
  segment: z.string().trim().min(2).max(60).nullable(),
  theme: panelThemeSchema,
  menuPresentation: z.enum(PANEL_MENU_PRESENTATIONS),
  logoPath: z.string().max(500).nullable(),
  coverPath: z.string().max(500).nullable(),
}).strict()

export const saveActiveIdentityRequestSchema = z.object({
  restaurantId: z.string().uuid(),
  expectedRestaurantId: z.string().uuid(),
  identity: activeIdentitySchema,
}).strict()

export const activeContactFieldsSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do restaurante.").max(120),
  description: z.string().trim().max(500),
  contact: panelContactDraftSchema,
}).strict()

export const saveActiveContactRequestSchema = z.object({
  restaurantId: z.string().uuid(),
  expectedRestaurantId: z.string().uuid(),
  fields: activeContactFieldsSchema,
}).strict()

export { completePanelRestaurantProfileSchema }
export type ActiveIdentity = z.infer<typeof activeIdentitySchema>
export type ActiveContactFields = z.infer<typeof activeContactFieldsSchema>
