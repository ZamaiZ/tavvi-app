import type { ReactNode } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getPanelPublicBasePath } from "@/features/panel/auth/navigation"
import { PanelAppShell } from "@/features/panel/shell/components/panel-app-shell"
import { getActivePanelRestaurant, getPanelRestaurantsForCurrentUser } from "@/features/panel/workspace/server/restaurants"
import { getRequestHostname } from "@/lib/routing/host"
import { requireAuthenticatedSurface } from "@/lib/supabase/require-authenticated-surface"

export default async function PanelWorkspaceLayout({ children }: { children: ReactNode }) {
  await requireAuthenticatedSurface("panel")
  const requestHeaders = await headers()
  const base = getPanelPublicBasePath(getRequestHostname(requestHeaders))
  let restaurant: Awaited<ReturnType<typeof getActivePanelRestaurant>>

  try {
    restaurant = await getActivePanelRestaurant()
  } catch (cause) {
    if (cause instanceof Error && cause.message === "panel_restaurant_not_found") redirect(base + "/restaurantes")
    throw cause
  }

  if (!restaurant) redirect(base + "/restaurantes")
  if (restaurant.status === "draft") redirect(base + `/onboarding/${restaurant.onboardingStep === "contact" ? "contato" : "identidade"}`)
  if (restaurant.status === "suspended") redirect(base + "/suspenso")

  let restaurants: Awaited<ReturnType<typeof getPanelRestaurantsForCurrentUser>> = [
    { id: restaurant.id, name: restaurant.name, slug: restaurant.slug, status: "active", onboardingStep: restaurant.onboardingStep },
  ]
  try {
    const available = await getPanelRestaurantsForCurrentUser()
    if (available.some((entry) => entry.id === restaurant.id)) restaurants = available
    else console.error("[panel-shell]", JSON.stringify({ stage: "restaurant_switcher_list_incomplete" }))
  } catch {
    console.error("[panel-shell]", JSON.stringify({ stage: "restaurant_switcher_list_unavailable" }))
  }

  return (
    <PanelAppShell
      publicBasePath={base}
      restaurant={{ id: restaurant.id, name: restaurant.name, slug: restaurant.slug, hasLogo: Boolean(restaurant.logoPath) }}
      restaurants={restaurants}
    >
      {children}
    </PanelAppShell>
  )
}
