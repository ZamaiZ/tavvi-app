import { z } from "zod"

export const PANEL_THEME_PRESET_IDS = [
  "brasa",
  "forno",
  "grao",
  "sal",
  "horta",
  "neon",
  "nori",
  "confeito",
] as const

export const PANEL_MENU_PRESENTATIONS = [
  "immersive",
  "catalog-list",
  "catalog-grid",
] as const

export const PANEL_DENSITIES = ["confortavel", "compacto"] as const

const optionalText = (max: number) => z.string().trim().max(max)
const phoneSchema = z
  .string()
  .trim()
  .max(30)
  .refine((value) => value === "" || /^\+?[\d\s().-]{8,24}$/.test(value), {
    error: "Informe um telefone válido.",
  })
const instagramSchema = z
  .string()
  .trim()
  .max(60)
  .regex(/^(?:@?[A-Za-z0-9._]{1,60})?$/, "Use apenas letras, números, ponto e sublinhado.")
const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor no formato #RRGGBB.")
const googleReviewUrlSchema = z.string().trim().max(400).refine((value) => {
  if (!value) return true
  try {
    const url = new URL(value)
    if (url.protocol !== "https:") return false
    if (url.hostname === "g.page") return /^\/r\/[A-Za-z0-9_-]+\/review$/.test(url.pathname)
    return url.hostname === "search.google.com"
      && url.pathname === "/local/writereview"
      && /^[A-Za-z0-9_-]{10,300}$/.test(url.searchParams.get("placeid") ?? "")
  } catch {
    return false
  }
}, "Informe um link direto para avaliar no Google.")

export const panelThemeSchema = z.object({
  preset: z.enum(PANEL_THEME_PRESET_IDS),
  base: hexColorSchema.nullable(),
  accent: hexColorSchema.nullable(),
  density: z.enum(PANEL_DENSITIES),
})

export const panelAddressDraftSchema = z.object({
  cep: optionalText(9),
  street: optionalText(120),
  number: optionalText(10),
  complement: optionalText(60),
  district: optionalText(80),
  city: optionalText(80),
  state: optionalText(2).transform((value) => value.toUpperCase()),
})

export const panelContactDraftSchema = z.object({
  phone: optionalText(30),
  whatsapp: optionalText(30),
  instagram: optionalText(60),
  address: panelAddressDraftSchema,
  mapsUrl: optionalText(500),
  googleReviewUrl: optionalText(400),
})

export const panelOnboardingStepSchema = z.enum(["identity", "contact"])

export const panelRestaurantDraftProfileSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do restaurante.").max(120),
  description: optionalText(500),
  segment: z.string().trim().min(2).max(60).nullable(),
  theme: panelThemeSchema,
  menuPresentation: z.enum(PANEL_MENU_PRESENTATIONS),
  logoPath: z.string().max(500).nullable(),
  coverPath: z.string().max(500).nullable(),
  contact: panelContactDraftSchema,
})

const completeAddressSchema = z.object({
  cep: z.string().regex(/^\d{5}-?\d{3}$/, "Informe um CEP válido."),
  street: z.string().trim().min(2).max(120),
  number: z.string().trim().min(1).max(10),
  complement: optionalText(60),
  district: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().toUpperCase().regex(/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/),
})

const validMapsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    if (!value) return true
    try {
      const url = new URL(value)
      const host = url.hostname.toLowerCase()
      const hosts: Record<string, "any" | "maps-path"> = {
        "maps.app.goo.gl": "any",
        "g.page": "any",
        "maps.google.com": "any",
        "maps.google.com.br": "any",
        "goo.gl": "maps-path",
        "google.com": "maps-path",
        "www.google.com": "maps-path",
        "google.com.br": "maps-path",
        "www.google.com.br": "maps-path",
      }
      const rule = hosts[host]
      return url.protocol === "https:" && Boolean(rule) && (rule === "any" || url.pathname === "/maps" || url.pathname.startsWith("/maps/"))
    } catch {
      return false
    }
  }, "Cole um link do Google Maps (maps.app.goo.gl, google.com/maps ou g.page).")

export const completePanelRestaurantProfileSchema = panelRestaurantDraftProfileSchema.superRefine(
  (profile, context) => {
    for (const field of ["phone", "whatsapp"] as const) {
      if (!phoneSchema.safeParse(profile.contact[field]).success) {
        context.addIssue({
          code: "custom",
          path: ["contact", field],
          message: "Informe um telefone válido ou deixe o campo em branco.",
        })
      }
    }
    if (!instagramSchema.safeParse(profile.contact.instagram).success) {
      context.addIssue({ code: "custom", path: ["contact", "instagram"], message: "Use apenas letras, números, ponto e sublinhado." })
    }
    const address = profile.contact.address
    const hasAddressValue = Object.values(address).some((value) => value !== "")

    if (hasAddressValue) {
      const parsedAddress = completeAddressSchema.safeParse(address)
      if (!parsedAddress.success) {
        context.addIssue({
          code: "custom",
          path: ["contact", "address"],
          message: "Complete o endereço ou deixe todos os campos em branco.",
        })
      }
    }

    if (!validMapsUrl.safeParse(profile.contact.mapsUrl).success) {
      context.addIssue({
        code: "custom",
        path: ["contact", "mapsUrl"],
        message: "Cole um link válido do Google Maps.",
      })
    }
    if (!googleReviewUrlSchema.safeParse(profile.contact.googleReviewUrl).success) {
      context.addIssue({ code: "custom", path: ["contact", "googleReviewUrl"], message: "Informe um link direto para avaliar no Google." })
    }
  },
)

export const savePanelRestaurantDraftSchema = z.object({
  restaurantId: z.string().uuid(),
  expectedRestaurantId: z.string().uuid(),
  step: panelOnboardingStepSchema,
  profile: panelRestaurantDraftProfileSchema,
})

export const completePanelRestaurantOnboardingSchema = z.object({
  restaurantId: z.string().uuid(),
  expectedRestaurantId: z.string().uuid(),
  profile: completePanelRestaurantProfileSchema,
})

export type PanelTheme = z.infer<typeof panelThemeSchema>
export type PanelContactDraft = z.infer<typeof panelContactDraftSchema>
export type PanelRestaurantDraftProfile = z.infer<typeof panelRestaurantDraftProfileSchema>
export type PanelOnboardingStep = z.infer<typeof panelOnboardingStepSchema>
export type SavePanelRestaurantDraftInput = z.infer<typeof savePanelRestaurantDraftSchema>
export type CompletePanelRestaurantOnboardingInput = z.infer<
  typeof completePanelRestaurantOnboardingSchema
>
