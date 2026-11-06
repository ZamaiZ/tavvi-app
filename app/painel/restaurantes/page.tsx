import type { Metadata } from "next"
import { headers } from "next/headers"

import { PanelRestaurantPicker } from "@/features/panel/workspace/components/panel-restaurant-picker"
import { getPanelRestaurantsForCurrentUser } from "@/features/panel/workspace/server/restaurants"
import { getPanelPublicBasePath } from "@/features/panel/auth/navigation"
import { getRequestHostname } from "@/lib/routing/host"
import { requireAuthenticatedSurface } from "@/lib/supabase/require-authenticated-surface"

export const metadata: Metadata = { title: "Seus restaurantes" }

export default async function PanelRestaurantsPage() {
  await requireAuthenticatedSurface("panel")
  const requestHeaders = await headers()
  const publicBasePath = getPanelPublicBasePath(getRequestHostname(requestHeaders))

  const restaurants = await getPanelRestaurantsForCurrentUser()
  return <PanelRestaurantPicker restaurants={restaurants} publicBasePath={publicBasePath} />
}
