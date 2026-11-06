import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getPanelEntryPath, getPanelPublicBasePath } from "@/features/panel/auth/navigation"
import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import { getRequestHostname } from "@/lib/routing/host"
import { requireAuthenticatedSurface } from "@/lib/supabase/require-authenticated-surface"

export default async function PanelHomePage() {
  await requireAuthenticatedSurface("panel")
  const requestHeaders = await headers()
  const publicBasePath = getPanelPublicBasePath(getRequestHostname(requestHeaders))

  let restaurant: Awaited<ReturnType<typeof getActivePanelRestaurant>> = null
  try {
    restaurant = await getActivePanelRestaurant()
  } catch {
    // Contexto inválido volta à escolha; a seleção valida a membership novamente.
  }
  if (restaurant) redirect(getPanelEntryPath(restaurant.status, restaurant.onboardingStep, publicBasePath))

  redirect(publicBasePath + "/restaurantes")
}
