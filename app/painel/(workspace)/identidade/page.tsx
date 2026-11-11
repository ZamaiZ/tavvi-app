import type { Metadata } from "next"
import { headers } from "next/headers"
import { LuIdCard } from "react-icons/lu"

import { getPanelPublicBasePath } from "@/features/panel/auth/navigation"
import { IdentityEditor } from "@/features/panel/profile/components/identity-editor"
import { PanelPageHeading } from "@/features/panel/workspace/components/panel-page-heading"
import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import { getRequestHostname } from "@/lib/routing/host"

export const metadata: Metadata = { title: "Identidade do restaurante" }

export default async function PanelIdentityPage() {
  const restaurant = await getActivePanelRestaurant()
  if (!restaurant) throw new Error("panel_restaurant_not_found")
  const requestHeaders = await headers()
  const base = getPanelPublicBasePath(getRequestHostname(requestHeaders))
  return (
    <div className="min-h-svh">
      <header className="mx-auto w-full max-w-[1320px] px-4 py-7 sm:px-6 md:py-5 lg:px-8">
        <PanelPageHeading title="Identidade" icon={<LuIdCard aria-hidden="true" className="size-4" />} />
      </header>
      <IdentityEditor restaurant={restaurant} publicBasePath={base} />
    </div>
  )
}
