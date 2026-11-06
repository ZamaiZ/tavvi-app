import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getPanelEntryPath, getPanelPublicBasePath, getPanelSignInPath } from "@/features/panel/auth/navigation"
import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getRequestHostname } from "@/lib/routing/host"

export default async function PanelHomePage() {
  const requestHeaders = await headers()
  const publicBasePath = getPanelPublicBasePath(getRequestHostname(requestHeaders))
  const supabase = await createSupabaseServerClient("panel")
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims?.sub) redirect(getPanelSignInPath(publicBasePath))

  let restaurant: Awaited<ReturnType<typeof getActivePanelRestaurant>> = null
  try {
    restaurant = await getActivePanelRestaurant()
  } catch {
    // Contexto inválido volta à escolha; a seleção valida a membership novamente.
  }
  if (restaurant) redirect(getPanelEntryPath(restaurant.status, restaurant.onboardingStep, publicBasePath))

  redirect(publicBasePath + "/restaurantes")
}
