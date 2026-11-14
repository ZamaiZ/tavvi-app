import type { Metadata } from "next"
import { LuBellRing } from "react-icons/lu"

import { CallsWorkspace } from "@/features/panel/calls/components/calls-workspace"
import { getPanelServiceCalls } from "@/features/panel/calls/server/read"
import { PanelPageHeading } from "@/features/panel/workspace/components/panel-page-heading"
import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"

export const metadata: Metadata = { title: "Chamados" }

export default async function PanelCallsPage() {
  const restaurant = await getActivePanelRestaurant()
  if (!restaurant || restaurant.status !== "active") throw new Error("panel_restaurant_not_found")
  const calls = await getPanelServiceCalls(restaurant)

  return (
    <div className="min-h-svh">
      <header className="mx-auto w-full max-w-[1320px] px-4 py-7 sm:px-6 md:py-5 lg:px-8">
        <PanelPageHeading title="Chamados" icon={<LuBellRing aria-hidden="true" className="size-4" />} />
      </header>
      <CallsWorkspace restaurantId={restaurant.id} initialCalls={calls} initialNow={Date.now()} />
    </div>
  )
}
