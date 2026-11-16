import type { Metadata } from "next"
import { LuReceiptText } from "react-icons/lu"

import { CashRealtimeProvider, CashWorkspace } from "@/features/panel/orders/components/cash-workspace"
import { getPanelOpenComandas } from "@/features/panel/orders/server/read"
import { PanelPageHeading } from "@/features/panel/workspace/components/panel-page-heading"
import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"

export const metadata: Metadata = { title: "Caixa" }

export default async function PanelCashPage() {
  const restaurant = await getActivePanelRestaurant()
  if (!restaurant || restaurant.status !== "active") throw new Error("panel_restaurant_not_found")
  const comandas = await getPanelOpenComandas(restaurant)

  return (
    <div className="min-h-svh">
      <header className="mx-auto w-full max-w-[1320px] px-4 py-7 sm:px-6 md:py-5 lg:px-8">
        <PanelPageHeading title="Caixa" icon={<LuReceiptText aria-hidden="true" className="size-4" />} />
      </header>
      <CashRealtimeProvider restaurantId={restaurant.id}>
        <CashWorkspace initialComandas={comandas} />
      </CashRealtimeProvider>
    </div>
  )
}
