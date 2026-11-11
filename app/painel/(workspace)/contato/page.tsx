import type { Metadata } from "next"
import { LuContactRound } from "react-icons/lu"

import { ContactEditor } from "@/features/panel/profile/components/contact-editor"
import { PanelPageHeading } from "@/features/panel/workspace/components/panel-page-heading"
import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"

export const metadata: Metadata = { title: "Contato do restaurante" }

export default async function PanelContactPage() {
  const restaurant = await getActivePanelRestaurant()
  if (!restaurant) throw new Error("panel_restaurant_not_found")
  return (
    <div className="min-h-svh">
      <header className="mx-auto w-full max-w-[1320px] px-4 pt-7 sm:px-6 md:pt-5 lg:px-8">
        <PanelPageHeading title="Contato" icon={<LuContactRound aria-hidden="true" className="size-4" />} />
      </header>
      <ContactEditor restaurant={restaurant} />
    </div>
  )
}
