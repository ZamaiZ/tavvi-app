import type { Metadata } from "next"
import { headers } from "next/headers"
import { LuArrowLeft, LuWalletCards } from "react-icons/lu"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { CashSessionPanel } from "@/features/panel/cash/components/cash-session-panel"
import { getPanelCashState } from "@/features/panel/cash/server/read"
import { FinanceOverviewDashboard } from "@/features/panel/finance/components/finance-overview-dashboard"
import { financeDateRangeSchema } from "@/features/panel/finance/schema"
import { getPanelFinanceOverview } from "@/features/panel/finance/server/read"
import { getPanelPublicBasePath } from "@/features/panel/auth/navigation"
import { getPanelPaymentOptions } from "@/features/panel/payments/model"
import { getPanelPaymentMethods } from "@/features/panel/settings/server/read"
import { PanelPageHeading } from "@/features/panel/workspace/components/panel-page-heading"
import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import { getRequestHostname } from "@/lib/routing/host"

export const metadata: Metadata = { title: "Financeiro" }

type FinancePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function localToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export default async function PanelFinancePage({ searchParams }: FinancePageProps) {
  const [params, requestHeaders, restaurant] = await Promise.all([
    searchParams,
    headers(),
    getActivePanelRestaurant(),
  ])
  if (!restaurant || restaurant.status !== "active") throw new Error("panel_restaurant_not_found")

  const today = localToday()
  const base = getPanelPublicBasePath(getRequestHostname(requestHeaders))
  const cashView = firstParam(params.view) === "cash"
  if (cashView) {
    const [cashState, paymentConfiguration] = await Promise.all([
      getPanelCashState(restaurant.id),
      getPanelPaymentMethods(restaurant.id),
    ])
    return <div className="min-h-svh">
      <header className="mx-auto flex w-full max-w-[1320px] items-center justify-between gap-3 px-4 py-7 sm:px-6 md:py-5 lg:px-8">
        <PanelPageHeading title="Movimentações de caixa" icon={<LuWalletCards aria-hidden="true" className="size-4" />} />
        <Button render={<Link href={`${base}/financeiro`} />} variant="outline" className="min-h-10 rounded-xl"><LuArrowLeft aria-hidden="true" />Resumo financeiro</Button>
      </header>
      <CashSessionPanel initialState={cashState} restaurantId={restaurant.id} paymentMethods={getPanelPaymentOptions(paymentConfiguration)} />
    </div>
  }
  const requestedRange = financeDateRangeSchema.safeParse({ from: firstParam(params.from), to: firstParam(params.to) })
  const range = requestedRange.success ? requestedRange.data : { from: today, to: today }
  const data = await getPanelFinanceOverview(restaurant.id, range)

  return <div className="min-h-svh">
    <header className="mx-auto flex w-full max-w-[1320px] items-center justify-between gap-3 px-4 py-7 sm:px-6 md:py-5 lg:px-8">
      <PanelPageHeading title="Financeiro" icon={<LuWalletCards aria-hidden="true" className="size-4" />} />
    </header>
    <FinanceOverviewDashboard data={data} today={today} settingsHref={`${base}/financeiro/configuracoes`} cashHref={`${base}/financeiro?view=cash`} restaurantId={restaurant.id} />
  </div>
}
