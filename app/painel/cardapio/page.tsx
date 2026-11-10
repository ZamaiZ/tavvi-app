import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getPanelPublicBasePath } from "@/features/panel/auth/navigation"
import { getPanelMenu } from "@/features/panel/menu/server/read"
import { PanelMenuTemplate } from "@/features/panel/workspace/components/panel-menu-template"
import {
  getActivePanelRestaurant,
  getPanelRestaurantsForCurrentUser,
} from "@/features/panel/workspace/server/restaurants"
import { PanelAppShell } from "@/features/panel/shell/components/panel-app-shell"
import { createPublicRestaurantUrl } from "@/lib/routing/panel"
import { getRequestHostname } from "@/lib/routing/host"
import { requireAuthenticatedSurface } from "@/lib/supabase/require-authenticated-surface"

export default async function PanelMenuPage() {
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
  if (restaurant.status === "draft") redirect(base + `/${restaurant.onboardingStep === "contact" ? "contato" : "identidade"}`)
  if (restaurant.status === "suspended") redirect(base + "/suspenso")

  // The switcher is supplementary navigation: if its membership query is
  // unavailable, keep the active Cardápio page usable and omit switching.
  let restaurants: Awaited<ReturnType<typeof getPanelRestaurantsForCurrentUser>> = [
    {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      status: "active",
      onboardingStep: restaurant.onboardingStep,
    },
  ]

  try {
    const availableRestaurants = await getPanelRestaurantsForCurrentUser()
    if (availableRestaurants.some((entry) => entry.id === restaurant.id)) {
      restaurants = availableRestaurants
    } else {
      console.error("[panel-shell]", JSON.stringify({ stage: "restaurant_switcher_list_incomplete" }))
    }
  } catch {
    console.error("[panel-shell]", JSON.stringify({ stage: "restaurant_switcher_list_unavailable" }))
  }

  return (
    <PanelAppShell
      publicBasePath={base}
      restaurant={{
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        hasLogo: Boolean(restaurant.logoPath),
      }}
      restaurants={restaurants}
    >
      <PanelMenuTemplate
        menu={await getPanelMenu(restaurant, base)}
        publicUrl={createPublicRestaurantUrl(restaurant.slug)}
      />
    </PanelAppShell>
  )
}
