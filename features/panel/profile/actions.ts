"use server"

import { revalidatePath } from "next/cache"

import { profileFromPanelRestaurant } from "@/features/panel/onboarding/profile"
import { resolveGoogleReview } from "@/features/panel/onboarding/server/google-review"
import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { saveActiveContactRequestSchema, completePanelRestaurantProfileSchema, type ActiveContactFields } from "./schema"

export type ContactSaveResult =
  | { ok: true; fields: ActiveContactFields }
  | { ok: false; code: "invalid_input" | "session_expired" | "context_changed" | "review_unavailable" | "review_invalid" | "database_error" | "unavailable"; fieldErrors?: Record<string, string> }

const contactRpcResponse = {
  safeParse(value: unknown) {
    if (!value || typeof value !== "object") return { success: false as const }
    const response = value as Record<string, unknown>
    if (response.ok === true && typeof response.restaurantId === "string") return { success: true as const, data: { ok: true as const, restaurantId: response.restaurantId } }
    if (response.ok === false && ["unauthorized", "not_found", "invalid_input", "unavailable"].includes(String(response.code))) {
      return { success: true as const, data: { ok: false as const, code: response.code as "unauthorized" | "not_found" | "invalid_input" | "unavailable" } }
    }
    return { success: false as const }
  },
}

export async function saveActiveRestaurantContactAction(input: unknown): Promise<ContactSaveResult> {
  const parsed = saveActiveContactRequestSchema.safeParse(input)
  if (!parsed.success || parsed.data.restaurantId !== parsed.data.expectedRestaurantId) return { ok: false, code: "invalid_input" }

  let restaurant
  try {
    restaurant = await getActivePanelRestaurant(parsed.data.expectedRestaurantId)
  } catch (cause) {
    if (cause instanceof Error && cause.message === "panel_auth_required") return { ok: false, code: "session_expired" }
    if (cause instanceof Error && (cause.message === "panel_restaurant_context_changed" || cause.message === "panel_restaurant_not_found")) return { ok: false, code: "context_changed" }
    console.error("[panel-profile]", JSON.stringify({ stage: "contact_restaurant_lookup", name: cause instanceof Error ? cause.name : undefined }))
    return { ok: false, code: "unavailable" }
  }
  if (!restaurant || restaurant.status !== "active") return { ok: false, code: "context_changed" }

  const current = profileFromPanelRestaurant(restaurant)
  const submittedContact = { ...parsed.data.fields.contact, googleReviewUrl: current.contact.googleReviewUrl }
  const profile = completePanelRestaurantProfileSchema.safeParse({
    ...current,
    name: parsed.data.fields.name,
    description: parsed.data.fields.description,
    contact: submittedContact,
  })
  if (!profile.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of profile.error.issues) fieldErrors[issue.path.map(String).join(".")] ??= issue.message
    return { ok: false, code: "invalid_input", fieldErrors }
  }

  let googleReviewUrl = current.contact.googleReviewUrl
  const previousMapsUrl = current.contact.mapsUrl
  const nextMapsUrl = profile.data.contact.mapsUrl
  if (!nextMapsUrl) googleReviewUrl = ""
  else if (nextMapsUrl !== previousMapsUrl || !googleReviewUrl) {
    const resolution = await resolveGoogleReview(nextMapsUrl)
    if (resolution.status !== "ok") return { ok: false, code: resolution.status === "not_business" ? "review_invalid" : "review_unavailable", fieldErrors: { "contact.mapsUrl": resolution.status === "not_business" ? "Este link não abriu a página de avaliações do restaurante." : "Não foi possível confirmar o link agora. Os dados atuais continuam salvos." } }
    googleReviewUrl = resolution.url
  }

  const contactProfile = { name: profile.data.name, description: profile.data.description, contact: { ...profile.data.contact, googleReviewUrl } }
  const checked = completePanelRestaurantProfileSchema.safeParse({ ...profile.data, contact: contactProfile.contact })
  if (!checked.success) return { ok: false, code: "invalid_input" }

  try {
    const supabase = await createSupabaseServerClient("panel")
    const { data, error } = await supabase.rpc("save_active_restaurant_contact", {
      p_restaurant_id: restaurant.id,
      p_contact_profile: contactProfile,
    })
    if (error) {
      console.error("[panel-profile]", JSON.stringify({ stage: "contact_rpc", code: error.code }))
      return { ok: false, code: "database_error" }
    }
    const response = contactRpcResponse.safeParse(data)
    if (!response.success) return { ok: false, code: "database_error" }
    if (!response.data.ok) {
      if (response.data.code === "unauthorized") return { ok: false, code: "session_expired" }
      if (response.data.code === "invalid_input") return { ok: false, code: "invalid_input" }
      if (response.data.code === "unavailable") return { ok: false, code: "unavailable" }
      return { ok: false, code: "context_changed" }
    }
    if (response.data.restaurantId !== restaurant.id) return { ok: false, code: "context_changed" }
    revalidatePath(`/${restaurant.slug}`)
    return { ok: true, fields: checked.data }
  } catch (cause) {
    console.error("[panel-profile]", JSON.stringify({ stage: "contact_rpc_exception", name: cause instanceof Error ? cause.name : undefined }))
    return { ok: false, code: "unavailable" }
  }
}
