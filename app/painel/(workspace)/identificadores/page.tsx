import type { Metadata } from "next"
import { LuNfc } from "react-icons/lu"

import { IdentifiersWorkspace } from "@/features/panel/identifiers/components/identifiers-workspace"
import { getPanelIdentifiers } from "@/features/panel/identifiers/server/read"
import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import { PanelPageHeading } from "@/features/panel/workspace/components/panel-page-heading"

export const metadata: Metadata = { title: "Identificadores" }

export default async function PanelIdentifiersPage() {
  const restaurant = await getActivePanelRestaurant()
  if (!restaurant) throw new Error("panel_restaurant_not_found")
  const identifiers = await getPanelIdentifiers(restaurant)

  return (
    <div className="min-h-svh">
      <header className="mx-auto w-full max-w-[1320px] px-4 py-7 sm:px-6 md:py-5 lg:px-8">
        <PanelPageHeading title="Identificadores" icon={<LuNfc aria-hidden="true" className="size-4" />} />
      </header>
      <IdentifiersWorkspace initialData={identifiers} />
    </div>
  )
}

