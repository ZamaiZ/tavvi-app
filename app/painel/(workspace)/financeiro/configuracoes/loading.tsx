import { LuSettings2 } from "react-icons/lu"

import { Skeleton } from "@/components/ui/skeleton"
import { PanelPageHeading } from "@/features/panel/workspace/components/panel-page-heading"

export default function PanelFinanceSettingsLoading() {
  return <div className="min-h-svh">
    <header className="mx-auto w-full max-w-[1320px] px-4 py-7 sm:px-6 md:py-5 lg:px-8"><PanelPageHeading title="Configurações financeiras" icon={<LuSettings2 aria-hidden="true" className="size-4" />} /></header>
    <main aria-label="Carregando configurações financeiras" className="mx-auto w-full max-w-[1120px] space-y-5 px-4 pb-32 sm:px-6 md:pb-10 lg:px-8">
      <Skeleton className="mx-auto h-28 w-full max-w-[900px] rounded-2xl" />
      <section className="mx-auto grid w-full max-w-[900px] gap-3 sm:grid-cols-2"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /></section>
      <Skeleton className="mx-auto h-64 w-full max-w-[900px] rounded-2xl" />
    </main>
  </div>
}
