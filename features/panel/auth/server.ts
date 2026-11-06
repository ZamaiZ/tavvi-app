import "server-only"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import {
  clearActivePanelRestaurantId,
  getActivePanelRestaurantId,
  isUuid,
  setActivePanelRestaurantId,
} from "@/features/panel/workspace/server/active-restaurant-cookie"
import { getPanelEntryPath, getPanelRestaurantsPath } from "./navigation"
import { panelLoginDestinationSchema, type PanelLoginInput } from "./schema"
import type { PanelAuthFeedbackCode } from "./state"

type PanelSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

function mapAuthError(error: { code?: string; message: string }): PanelAuthFeedbackCode {
  const code = error.code?.toLowerCase() ?? ""
  const message = error.message.toLowerCase()
  if (code.includes("rate") || message.includes("rate limit") || message.includes("too many")) {
    return "rate_limited"
  }
  if (code.includes("invalid_credentials") || message.includes("invalid login credentials") || message.includes("email not confirmed")) {
    return "invalid_credentials"
  }
  if (message.includes("network") || message.includes("fetch failed") || message.includes("timeout")) {
    return "service_unavailable"
  }
  return "invalid_credentials"
}

async function getAccessibleRestaurants(supabase: PanelSupabaseClient, userId: string) {
  const { data: membershipRows, error: membershipError } = await supabase
    .from("memberships")
    .select("restaurant_id")
    .eq("user_id", userId)
    .eq("status", "active")

  if (membershipError || !membershipRows) throw new Error("panel_memberships_unavailable")
  const ids = [...new Set(membershipRows.map((row) => row.restaurant_id).filter(isUuid))]
  if (!ids.length) return []

  const { data: restaurantRows, error: restaurantsError } = await supabase
    .from("restaurants")
    .select("id,name,slug,status,onboarding_step")
    .in("id", ids)

  if (restaurantsError || !restaurantRows) throw new Error("panel_restaurants_unavailable")

  return restaurantRows.map((row) => panelLoginDestinationSchema.parse({
    restaurantId: row.id,
    restaurantName: row.name,
    restaurantSlug: row.slug,
    status: row.status,
    onboardingStep: row.onboarding_step === "contact" ? "contact" : "identity",
  }))
}

export async function getPanelEntryDestination(
  supabase: PanelSupabaseClient,
  publicBasePath: "" | "/painel",
) {
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (claimsError || typeof userId !== "string" || !isUuid(userId)) return null

  const restaurants = await getAccessibleRestaurants(supabase, userId)
  if (restaurants.length === 0) {
    await clearActivePanelRestaurantId()
    return null
  }

  const activeId = await getActivePanelRestaurantId()
  const selected = activeId ? restaurants.find((item) => item.restaurantId === activeId) : undefined
  if (selected) {
    return getPanelEntryPath(selected.status, selected.onboardingStep, publicBasePath)
  }

  await clearActivePanelRestaurantId()
  if (restaurants.length > 1) return getPanelRestaurantsPath(publicBasePath)

  const restaurant = restaurants[0]
  await setActivePanelRestaurantId(restaurant.restaurantId)
  return getPanelEntryPath(restaurant.status, restaurant.onboardingStep, publicBasePath)
}

export async function signInPanel(
  input: PanelLoginInput,
  publicBasePath: "" | "/painel",
): Promise<{ ok: true; destination: string } | { ok: false; code: PanelAuthFeedbackCode }> {
  try {
    const supabase = await createSupabaseServerClient("panel")
    const { error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    })
    if (error) return { ok: false, code: mapAuthError(error) }

    const destination = await getPanelEntryDestination(supabase, publicBasePath)
    if (!destination) {
      await supabase.auth.signOut({ scope: "local" })
      return { ok: false, code: "membership_required" }
    }

    return { ok: true, destination }
  } catch {
    return { ok: false, code: "service_unavailable" }
  }
}
