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

export type AcceptPanelInviteResult =
  | { ok: true; restaurant: AcceptedRestaurant }
  | {
      ok: false
      code:
        | "invalid_input"
        | "email_mismatch"
        | "invalid_credentials"
        | "account_exists"
        | "confirmation_required"
        | "rate_limited"
        | "unavailable"
        | "slug_unavailable"
        | "service_unavailable"
    }
