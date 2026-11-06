import type { PanelRestaurantDTO } from "@/features/panel/onboarding/model"
import {
  panelAddressDraftSchema,
  panelRestaurantDraftProfileSchema,
  panelThemeSchema,
  type PanelRestaurantDraftProfile,
} from "@/features/panel/onboarding/schema"

const emptyContact = {
  phone: "",
  whatsapp: "",
  instagram: "",
  address: { cep: "", street: "", number: "", complement: "", district: "", city: "", state: "" },
  mapsUrl: "",
  googleReviewUrl: "",
}

function stringValue(source: Record<string, unknown>, key: string) {
  return typeof source[key] === "string" ? source[key] as string : ""
}

export function profileFromPanelRestaurant(restaurant: PanelRestaurantDTO): PanelRestaurantDraftProfile {
  const rawContact = restaurant.contact && typeof restaurant.contact === "object" && !Array.isArray(restaurant.contact)
    ? restaurant.contact as Record<string, unknown>
    : {}
  const rawAddress = rawContact.address && typeof rawContact.address === "object" && !Array.isArray(rawContact.address)
    ? rawContact.address
    : {}
  const parsedAddress = panelAddressDraftSchema.safeParse({
    cep: stringValue(rawAddress as Record<string, unknown>, "cep"),
    street: stringValue(rawAddress as Record<string, unknown>, "street"),
    number: stringValue(rawAddress as Record<string, unknown>, "number"),
    complement: stringValue(rawAddress as Record<string, unknown>, "complement"),
    district: stringValue(rawAddress as Record<string, unknown>, "district"),
    city: stringValue(rawAddress as Record<string, unknown>, "city"),
    state: stringValue(rawAddress as Record<string, unknown>, "state"),
  })
  const parsedTheme = panelThemeSchema.safeParse(restaurant.theme)
  const theme = parsedTheme.success
    ? parsedTheme.data
    : { preset: "grao" as const, base: null, accent: null, density: "confortavel" as const }

  return panelRestaurantDraftProfileSchema.parse({
    name: restaurant.name,
    description: restaurant.description ?? "",
    segment: restaurant.segment,
    theme,
    menuPresentation: restaurant.menuPresentation,
    logoPath: restaurant.logoPath,
    coverPath: restaurant.coverPath,
    contact: {
      ...emptyContact,
      phone: stringValue(rawContact, "phone"),
      whatsapp: stringValue(rawContact, "whatsapp"),
      instagram: stringValue(rawContact, "instagram").replace(/^@+/, ""),
      address: parsedAddress.success ? parsedAddress.data : emptyContact.address,
      mapsUrl: stringValue(rawContact, "mapsUrl"),
      googleReviewUrl: stringValue(rawContact, "googleReviewUrl"),
    },
  })
}
