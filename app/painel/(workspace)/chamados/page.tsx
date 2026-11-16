import type { Metadata } from "next"
import { headers } from "next/headers"
import { LuBellRing } from "react-icons/lu"

import { CallsWorkspace } from "@/features/panel/calls/components/calls-workspace"
import { getPanelResolvedServiceCallsCount, getPanelServiceCalls } from "@/features/panel/calls/server/read"
import { getPanelPublicBasePath } from "@/features/panel/auth/navigation"
import { getPanelMenu } from "@/features/panel/menu/server/read"
import { PanelPageHeading } from "@/features/panel/workspace/components/panel-page-heading"
import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getRequestHostname } from "@/lib/routing/host"

export const metadata: Metadata = { title: "Chamados" }

export default async function PanelCallsPage() {
  const requestHeaders = await headers()
  const base = getPanelPublicBasePath(getRequestHostname(requestHeaders))
  const restaurant = await getActivePanelRestaurant()
  if (!restaurant || restaurant.status !== "active") throw new Error("panel_restaurant_not_found")
  const supabase = await createSupabaseServerClient("panel")
  const [{ data: claimsData, error: claimsError }, calls, resolvedCount, menu] = await Promise.all([
    supabase.auth.getClaims(),
    getPanelServiceCalls(restaurant),
    getPanelResolvedServiceCallsCount(restaurant.id),
    getPanelMenu(restaurant, base),
  ])
  const viewerId = claimsData?.claims?.sub
  if (claimsError || typeof viewerId !== "string") throw new Error("panel_auth_required")

  return (
    <div className="min-h-svh">
      <header className="mx-auto w-full max-w-[1320px] px-4 py-7 sm:px-6 md:py-5 lg:px-8">
        <PanelPageHeading title="Chamados" icon={<LuBellRing aria-hidden="true" className="size-4" />} />
      </header>
      <CallsWorkspace restaurantId={restaurant.id} viewerId={viewerId} menu={menu} cardapioHref={`${base}/cardapio`} initialCalls={calls} initialResolvedCount={resolvedCount} />
    </div>
  )
}
