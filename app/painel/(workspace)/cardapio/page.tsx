import { headers } from "next/headers"

import { getPanelPublicBasePath } from "@/features/panel/auth/navigation"
import { getPanelMenu } from "@/features/panel/menu/server/read"
import { PanelMenuTemplate } from "@/features/panel/workspace/components/panel-menu-template"
import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import { getRequestHostname } from "@/lib/routing/host"
import { createPublicRestaurantUrl } from "@/lib/routing/panel"

export default async function PanelMenuPage() {
  const requestHeaders = await headers()
  const base = getPanelPublicBasePath(getRequestHostname(requestHeaders))
  const restaurant = await getActivePanelRestaurant()
  if (!restaurant) throw new Error("panel_restaurant_not_found")
  return <PanelMenuTemplate menu={await getPanelMenu(restaurant, base)} publicUrl={createPublicRestaurantUrl(restaurant.slug)} />
}
