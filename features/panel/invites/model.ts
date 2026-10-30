export type PanelInvitePreview =
  | { status: "available"; expiresAt: string; emailRequired: boolean }
  | { status: "unavailable" }
  | { status: "service-unavailable" }

export type AcceptedRestaurant = {
  restaurantId: string
  restaurantName: string
  restaurantSlug: string
  restaurantStatus: "draft" | "active" | "suspended"
  alreadyAccepted: boolean
}

export type RestaurantNameAvailability =
  | { status: "available"; slug: string }
  | {
      status: "unavailable"
      slug: string
      nameAvailable: boolean
      slugAvailable: boolean
    }
  | { status: "error" }

export type AcceptPanelInviteResult =
  | { ok: true; restaurant: AcceptedRestaurant }
  | {
      ok: false
      code:
        | "invalid_input"
        | "email_mismatch"
        | "account_exists"
        | "confirmation_required"
        | "rate_limited"
        | "unavailable"
        | "slug_unavailable"
        | "service_unavailable"
    }
