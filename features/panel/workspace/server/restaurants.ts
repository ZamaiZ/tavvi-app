import "server-only"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { panelRestaurantSchema, type PanelRestaurantDTO } from "@/features/panel/onboarding/model"
import { getActivePanelRestaurantId, isUuid } from "./active-restaurant-cookie"

export type PanelRestaurantListItem = {
  id: string
  name: string
  slug: string
  status: "draft" | "active" | "suspended"
  onboardingStep: "identity" | "contact"
}

export async function getPanelRestaurantsForCurrentUser(): Promise<PanelRestaurantListItem[]> {
  const supabase = await createSupabaseServerClient("panel")
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (claimsError || typeof userId !== "string" || !isUuid(userId)) return []

  const { data: memberships, error: membershipError } = await supabase
    .from("memberships")
    .select("restaurant_id")
    .eq("user_id", userId)
    .eq("status", "active")

  if (membershipError || !memberships) throw new Error("panel_memberships_unavailable")
  const ids = [...new Set(memberships.map((row) => row.restaurant_id).filter(isUuid))]
  if (!ids.length) return []

  const { data: restaurants, error: restaurantsError } = await supabase
    .from("restaurants")
    .select("id,name,slug,status,onboarding_step")
    .in("id", ids)

  if (restaurantsError || !restaurants) throw new Error("panel_restaurants_unavailable")

  return restaurants.map((restaurant) => ({
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    status: restaurant.status as PanelRestaurantListItem["status"],
    onboardingStep: restaurant.onboarding_step === "contact" ? "contact" : "identity",
  }))
}

export async function getActivePanelRestaurant(
  expectedRestaurantId?: string,
): Promise<PanelRestaurantDTO | null> {
  const activeId = await getActivePanelRestaurantId()
  if (!activeId) return null
  if (expectedRestaurantId && activeId !== expectedRestaurantId) {
    throw new Error("panel_restaurant_context_changed")
  }

  const supabase = await createSupabaseServerClient("panel")
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (claimsError || typeof userId !== "string" || !isUuid(userId)) {
    if (claimsError) console.error("[panel-onboarding]", JSON.stringify({ stage: "restaurant_auth", code: claimsError.code, status: claimsError.status }))
    throw new Error("panel_auth_required")
  }

  const { data, error } = await supabase
    .from("restaurants")
    .select("id,name,slug,status,description,segment,theme,menu_presentation,logo_path,cover_path,contact,onboarding_step")
    .eq("id", activeId)
    .maybeSingle()

  if (error) {
    console.error("[panel-onboarding]", JSON.stringify({ stage: "restaurant_query", code: error.code }))
    throw new Error("panel_restaurant_unavailable")
  }
  if (!data) throw new Error("panel_restaurant_not_found")

  return panelRestaurantSchema.parse({
    id: data.id,
    name: data.name,
    slug: data.slug,
    status: data.status,
    description: data.description,
    segment: data.segment,
    theme: data.theme,
    menuPresentation: data.menu_presentation,
    logoPath: data.logo_path,
    coverPath: data.cover_path,
    contact: data.contact,
    onboardingStep: data.onboarding_step === "contact" ? "contact" : "identity",
  })
}
