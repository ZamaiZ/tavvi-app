import { LuWalletCards } from "react-icons/lu"

import { FinanceDashboardSkeleton } from "@/features/panel/finance/components/finance-dashboard-skeleton"
import { PanelPageHeading } from "@/features/panel/workspace/components/panel-page-heading"

export default function PanelFinanceLoading() {
  return <div className="min-h-svh">
    <header className="mx-auto w-full max-w-[1320px] px-4 py-7 sm:px-6 md:py-5 lg:px-8">
      <PanelPageHeading title="Financeiro" icon={<LuWalletCards aria-hidden="true" className="size-4" />} />
    </header>
    <FinanceDashboardSkeleton />
  </div>
}
