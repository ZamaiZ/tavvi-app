import type { Metadata } from "next"
import { LuSettings2 } from "react-icons/lu"

import { PaymentSettingsPage } from "@/features/panel/settings/components/payment-settings-page"
import { getPanelPaymentMethods } from "@/features/panel/settings/server/read"
import { PanelPageHeading } from "@/features/panel/workspace/components/panel-page-heading"
import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"

export const metadata: Metadata = { title: "Configurações financeiras" }

export default async function PanelFinanceSettingsPage() {
  const restaurant = await getActivePanelRestaurant()
  if (!restaurant || restaurant.status !== "active") throw new Error("panel_restaurant_not_found")
  const configuration = await getPanelPaymentMethods(restaurant.id)
  return (
    <div className="min-h-svh">
      <header className="mx-auto w-full max-w-[1320px] px-4 py-7 sm:px-6 md:py-5 lg:px-8">
        <PanelPageHeading title="Configurações financeiras" icon={<LuSettings2 aria-hidden="true" className="size-4" />} />
      </header>
      <PaymentSettingsPage
        key={restaurant.id}
        expectedRestaurantId={restaurant.id}
        initialEnabledMethods={configuration.enabledMethods}
        initialCustomMethods={configuration.customMethods}
        initialTipPolicy={configuration.tipPolicy}
      />
    </div>
  )
}
