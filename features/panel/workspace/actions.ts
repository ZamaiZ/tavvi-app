"use server"

import { z } from "zod"

import { getPanelEntryPath, getPanelPublicBasePath } from "@/features/panel/auth/navigation"
import { getPanelRestaurantsForCurrentUser } from "@/features/panel/workspace/server/restaurants"
import { setActivePanelRestaurantId } from "@/features/panel/workspace/server/active-restaurant-cookie"
import { headers } from "next/headers"
import { getRequestHostname } from "@/lib/routing/host"

const restaurantIdSchema = z.string().uuid()

export async function selectPanelRestaurantAction(rawRestaurantId: unknown) {
  const parsedId = restaurantIdSchema.safeParse(rawRestaurantId)
  if (!parsedId.success) return { ok: false as const, code: "invalid_input" as const }

  try {
    const restaurants = await getPanelRestaurantsForCurrentUser()
    const selected = restaurants.find((restaurant) => restaurant.id === parsedId.data)
    if (!selected) return { ok: false as const, code: "unavailable" as const }

    await setActivePanelRestaurantId(selected.id)
    const requestHeaders = await headers()
    const publicBasePath = getPanelPublicBasePath(getRequestHostname(requestHeaders))
    return {
      ok: true as const,
      destination: getPanelEntryPath(selected.status, selected.onboardingStep, publicBasePath),
    }
  } catch {
    return { ok: false as const, code: "unavailable" as const }
  }
}
