import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getPanelPublicBasePath } from "@/features/panel/auth/navigation"
import { PanelMenuTemplate } from "@/features/panel/workspace/components/panel-menu-template"
import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getRequestHostname } from "@/lib/routing/host"

export default async function PanelMenuPage() {
  const requestHeaders = await headers()
  const base = getPanelPublicBasePath(getRequestHostname(requestHeaders))
  const supabase = await createSupabaseServerClient("panel")
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims?.sub) redirect(base + "/entrar")
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
  return <PanelMenuTemplate name={restaurant.name} slug={restaurant.slug} />
}
