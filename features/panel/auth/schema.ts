import { z } from "zod"

export const panelLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um email válido.").max(254),
  password: z.string().min(1, "Informe sua senha.").max(128),
})

export type PanelLoginInput = z.infer<typeof panelLoginSchema>

export const panelLoginDestinationSchema = z.object({
  restaurantId: z.string().uuid(),
  restaurantName: z.string().min(2).max(120),
  restaurantSlug: z.string().min(1).max(89),
  status: z.enum(["draft", "active", "suspended"]),
  onboardingStep: z.enum(["identity", "contact"]),
})

export type PanelLoginDestination = z.infer<typeof panelLoginDestinationSchema>
