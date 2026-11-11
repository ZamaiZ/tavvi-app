import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getPanelPublicBasePath } from "@/features/panel/auth/navigation"
import { PanelSuspendedState } from "@/features/panel/workspace/components/panel-suspended-state"
import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import { getRequestHostname } from "@/lib/routing/host"
import { requireAuthenticatedSurface } from "@/lib/supabase/require-authenticated-surface"

export default async function PanelSuspendedPage() {
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
  if (restaurant.status !== "suspended") redirect(base + (restaurant.status === "draft" ? `/onboarding/${restaurant.onboardingStep === "contact" ? "contato" : "identidade"}` : "/cardapio"))
  return <PanelSuspendedState name={restaurant.name} />
}
