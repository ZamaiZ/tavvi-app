"use server"

import { revalidatePath } from "next/cache"

import {
  restaurantIdSchema,
  updateRestaurantSlugSchema,
} from "@/features/admin/restaurants/schema"
import {
  RestaurantAccessError,
  RestaurantInputError,
  RestaurantServiceError,
  setPlatformRestaurantStatus,
  updatePlatformRestaurantSlug,
} from "@/features/admin/restaurants/server/restaurants"

type RestaurantActionFailure = {
  ok: false
  code:
    | "invalid_input"
    | "unauthorized"
    | "service_unavailable"
    | "not_found"
    | "slug_unavailable"
  fieldErrors?: Record<string, string[] | undefined>
}

export type RestaurantStatusActionResult =
  | {
      ok: true
      restaurantId: string
      status: "draft" | "active" | "suspended"
      statusBeforeSuspension: "draft" | "active" | null
    }
  | RestaurantActionFailure

export type RestaurantSlugActionResult =
  | { ok: true; slug: string }
  | RestaurantActionFailure

function mapError(error: unknown): RestaurantActionFailure {
  if (error instanceof RestaurantAccessError) {
    return { ok: false, code: "unauthorized" }
  }
  if (error instanceof RestaurantInputError) {
    return { ok: false, code: "invalid_input" }
  }
  if (error instanceof RestaurantServiceError) {
    return { ok: false, code: "service_unavailable" }
  }
  return { ok: false, code: "service_unavailable" }
}

async function updateStatus(
  rawRestaurantId: unknown,
  action: "suspend" | "restore"
): Promise<RestaurantStatusActionResult> {
  const parsedId = restaurantIdSchema.safeParse(rawRestaurantId)
  if (!parsedId.success) {
    return { ok: false, code: "invalid_input" }
  }

  try {
    const result = await setPlatformRestaurantStatus({
      restaurantId: parsedId.data,
      action,
    })

    if (result.status === "not-found") {
      return { ok: false, code: "not_found" }
    }

    revalidatePath("/admin/restaurantes")
    return {
      ok: true,
      restaurantId: result.restaurantId,
      status: result.restaurantStatus,
      statusBeforeSuspension: result.statusBeforeSuspension,
    }
  } catch (error) {
    return mapError(error)
  }
}

export async function suspendPlatformRestaurantAction(
  rawRestaurantId: unknown
): Promise<RestaurantStatusActionResult> {
  return updateStatus(rawRestaurantId, "suspend")
}

export async function restorePlatformRestaurantAction(
  rawRestaurantId: unknown
): Promise<RestaurantStatusActionResult> {
  return updateStatus(rawRestaurantId, "restore")
}

export async function updatePlatformRestaurantSlugAction(
  rawInput: unknown
): Promise<RestaurantSlugActionResult> {
  const parsedInput = updateRestaurantSlugSchema.safeParse(rawInput)
  if (!parsedInput.success) {
    return {
      ok: false,
      code: "invalid_input",
      fieldErrors: parsedInput.error.flatten().fieldErrors,
    }
  }

  try {
    const result = await updatePlatformRestaurantSlug(parsedInput.data)
    if (result.status === "not-found") {
      return { ok: false, code: "not_found" }
    }
    if (result.status === "slug-unavailable") {
      return { ok: false, code: "slug_unavailable" }
    }

    revalidatePath("/admin/restaurantes")
    return { ok: true, slug: result.slug }
  } catch (error) {
    return mapError(error)
  }
}
