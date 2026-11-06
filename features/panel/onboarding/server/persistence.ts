import "server-only"

import {
  panelRestaurantCompletionResponseSchema,
  panelRestaurantDraftResponseSchema,
} from "@/features/panel/onboarding/model"
import type {
  CompletePanelRestaurantOnboardingInput,
  SavePanelRestaurantDraftInput,
  PanelRestaurantDraftProfile,
} from "@/features/panel/onboarding/schema"
import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type PanelBrandSlot = "logo" | "cover"
export type PanelBrandFiles = Partial<Record<PanelBrandSlot, File>>

export type PanelOnboardingPersistenceResult =
  | {
      ok: true
      restaurantId: string
      status: "draft" | "active"
      savedPaths: { logoPath: string | null; coverPath: string | null }
    }
  | { ok: false; code: "invalid_input" | "context_changed" | "storage_policy_denied" | "storage_unavailable" | "unavailable" }

type PersistInput =
  | { intent: "draft"; input: SavePanelRestaurantDraftInput }
  | { intent: "complete"; input: CompletePanelRestaurantOnboardingInput }

const extensionByType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}
const maxFileSize = 5 * 1024 * 1024

async function removeObjects(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, paths: string[]) {
  if (!paths.length) return
  try {
    const { error } = await supabase.storage.from("restaurant-brand").remove(paths)
    if (error) console.warn("[panel-brand] storage cleanup failed", error.statusCode ?? error.name)
  } catch {
    console.warn("[panel-brand] storage cleanup failed")
  }
}

export async function persistPanelRestaurantProfile(
  request: PersistInput,
  files: PanelBrandFiles = {},
): Promise<PanelOnboardingPersistenceResult> {
  const input = request.input
  if (input.restaurantId !== input.expectedRestaurantId) return { ok: false, code: "invalid_input" }

  for (const file of Object.values(files)) {
    if (!file) continue
    if (!extensionByType[file.type] || file.size <= 0 || file.size > maxFileSize) {
      return { ok: false, code: "invalid_input" }
    }
  }

  let restaurant
  try {
    restaurant = await getActivePanelRestaurant(input.expectedRestaurantId)
  } catch (cause) {
    if (cause instanceof Error && cause.message === "panel_restaurant_context_changed") {
      return { ok: false, code: "context_changed" }
    }
    if (cause instanceof Error && cause.message === "panel_restaurant_not_found") {
      return { ok: false, code: "context_changed" }
    }
    return { ok: false, code: "unavailable" }
  }
  if (!restaurant || restaurant.status !== "draft") return { ok: false, code: "context_changed" }

  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
  try {
    supabase = await createSupabaseServerClient("panel")
  } catch {
    return { ok: false, code: "unavailable" }
  }
  const uploadedPaths: string[] = []
  const nextPaths: Partial<Record<PanelBrandSlot, string>> = {}

  for (const slot of ["logo", "cover"] as const) {
    const file = files[slot]
    if (!file) continue
    const extension = extensionByType[file.type]
    const path = `${restaurant.id}/${slot}/${crypto.randomUUID()}.${extension}`
    let error
    try {
      ({ error } = await supabase.storage.from("restaurant-brand").upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      }))
    } catch (cause) {
      console.warn("[panel-brand] upload request failed", cause instanceof Error ? cause.name : typeof cause)
      await removeObjects(supabase, uploadedPaths)
      return { ok: false, code: "storage_unavailable" }
    }
    if (error) {
      const statusCode = String(error.statusCode ?? "")
      console.warn("[panel-brand] upload denied", { statusCode: statusCode || "unknown", errorName: error.name })
      await removeObjects(supabase, uploadedPaths)
      return { ok: false, code: statusCode === "403" ? "storage_policy_denied" : "storage_unavailable" }
    }
    uploadedPaths.push(path)
    nextPaths[slot] = path
  }

  const profile: PanelRestaurantDraftProfile = {
    ...input.profile,
    logoPath: nextPaths.logo ?? input.profile.logoPath,
    coverPath: nextPaths.cover ?? input.profile.coverPath,
  }

  let result: PanelOnboardingPersistenceResult
  try {
    if (request.intent === "draft") {
      const { data, error } = await supabase.rpc("save_panel_restaurant_draft", {
        p_restaurant_id: input.restaurantId,
        p_step: request.input.step,
        p_profile: profile,
      })
      const response = !error && panelRestaurantDraftResponseSchema.safeParse(data)
      result = response && response.success && response.data.ok && response.data.restaurantId === input.restaurantId
        ? {
            ok: true,
            restaurantId: response.data.restaurantId,
            status: "draft",
            savedPaths: { logoPath: profile.logoPath, coverPath: profile.coverPath },
          }
        : {
            ok: false,
            code: response && response.success && !response.data.ok && response.data.code === "invalid_input"
              ? "invalid_input"
              : "unavailable",
          }
    } else {
      const { data, error } = await supabase.rpc("complete_panel_restaurant_onboarding", {
        p_restaurant_id: input.restaurantId,
        p_profile: profile,
      })
      const response = !error && panelRestaurantCompletionResponseSchema.safeParse(data)
      result = response && response.success && response.data.ok && response.data.restaurantId === input.restaurantId
        ? {
            ok: true,
            restaurantId: response.data.restaurantId,
            status: "active",
            savedPaths: { logoPath: profile.logoPath, coverPath: profile.coverPath },
          }
        : {
            ok: false,
            code: response && response.success && !response.data.ok && response.data.code === "invalid_input"
              ? "invalid_input"
              : "unavailable",
          }
    }
  } catch {
    await removeObjects(supabase, uploadedPaths)
    return { ok: false, code: "unavailable" }
  }

  if (!result.ok) {
    await removeObjects(supabase, uploadedPaths)
    return result
  }

  await Promise.all([
    restaurant.logoPath !== profile.logoPath ? removeObjects(supabase, restaurant.logoPath ? [restaurant.logoPath] : []) : Promise.resolve(),
    restaurant.coverPath !== profile.coverPath ? removeObjects(supabase, restaurant.coverPath ? [restaurant.coverPath] : []) : Promise.resolve(),
  ])

  return result
}
