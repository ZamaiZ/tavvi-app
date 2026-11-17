import type { Metadata } from "next"
import { headers } from "next/headers"
import { LuReceiptText } from "react-icons/lu"

import { CashRealtimeProvider, CashWorkspace } from "@/features/panel/orders/components/cash-workspace"
import { getPanelComandasPage } from "@/features/panel/orders/server/read"
import { getPanelCashState } from "@/features/panel/cash/server/read"
import { getPanelPaymentMethods } from "@/features/panel/settings/server/read"
import { getPanelPublicBasePath } from "@/features/panel/auth/navigation"
import { getPanelMenu } from "@/features/panel/menu/server/read"
import { PanelPageHeading } from "@/features/panel/workspace/components/panel-page-heading"
import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import { getRequestHostname } from "@/lib/routing/host"

export const metadata: Metadata = { title: "Caixa" }

type PanelCashPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function PanelCashPage({ searchParams }: PanelCashPageProps) {
  const params = await searchParams
  const requestHeaders = await headers()
  const base = getPanelPublicBasePath(getRequestHostname(requestHeaders))
  const restaurant = await getActivePanelRestaurant()
  if (!restaurant || restaurant.status !== "active") throw new Error("panel_restaurant_not_found")
  const status = firstParam(params.status) === "closed" ? "closed" : "open"
  const pageValue = Number(firstParam(params.page) ?? "1")
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 && pageValue <= 1_000_000 ? pageValue : 1
  const [initialData, paymentConfiguration, menu, cashState] = await Promise.all([
    getPanelComandasPage(restaurant, { status, page }),
    getPanelPaymentMethods(restaurant.id),
    status === "open" ? getPanelMenu(restaurant, base) : Promise.resolve(null),
    getPanelCashState(restaurant.id),
  ])

  return (
    <div className="min-h-svh">
      <header className="mx-auto w-full max-w-[1320px] px-4 py-7 sm:px-6 md:py-5 lg:px-8">
        <PanelPageHeading title="Caixa" icon={<LuReceiptText aria-hidden="true" className="size-4" />} />
      </header>
      <CashRealtimeProvider restaurantId={restaurant.id}>
        <CashWorkspace initialData={initialData} status={status} paymentConfiguration={paymentConfiguration} cashState={cashState} restaurantId={restaurant.id} menu={menu} cardapioHref={`${base}/cardapio`} />
      </CashRealtimeProvider>
    </div>
  )
}
