import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { PanelRestaurantPicker } from "@/features/panel/workspace/components/panel-restaurant-picker"
import { getPanelRestaurantsForCurrentUser } from "@/features/panel/workspace/server/restaurants"
import { getPanelPublicBasePath, getPanelSignInPath } from "@/features/panel/auth/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getRequestHostname } from "@/lib/routing/host"

export const metadata: Metadata = { title: "Seus restaurantes" }

export default async function PanelRestaurantsPage() {
  const requestHeaders = await headers()
  const publicBasePath = getPanelPublicBasePath(getRequestHostname(requestHeaders))
  const supabase = await createSupabaseServerClient("panel")
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData?.claims?.sub) redirect(getPanelSignInPath(publicBasePath))

  const restaurants = await getPanelRestaurantsForCurrentUser()
  return <PanelRestaurantPicker restaurants={restaurants} publicBasePath={publicBasePath} />
}
