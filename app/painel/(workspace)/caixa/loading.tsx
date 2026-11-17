import { LuReceiptText } from "react-icons/lu"

import { PanelPageHeading } from "@/features/panel/workspace/components/panel-page-heading"
import { Skeleton } from "@/components/ui/skeleton"

export default function PanelCashLoading() {
  return (
    <div className="min-h-svh">
      <header className="mx-auto w-full max-w-[1320px] px-4 py-7 sm:px-6 md:py-5 lg:px-8">
        <PanelPageHeading title="Caixa" icon={<LuReceiptText aria-hidden="true" className="size-4" />} />
      </header>
      <main aria-label="Carregando caixa e comandas" className="mx-auto w-full max-w-[1320px] space-y-5 px-4 pb-32 sm:px-6 md:pb-10 lg:px-8">
        <section className="space-y-3"><Skeleton className="h-56 rounded-3xl" /><Skeleton className="h-52 rounded-2xl" /></section>
        <section className="grid gap-3 sm:grid-cols-3"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /></section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Skeleton className="h-12 w-full rounded-xl sm:w-64" /><Skeleton className="h-10 w-full rounded-xl sm:w-64" /></div>
        <div className="flex items-center justify-between gap-3"><div className="space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-3 w-64" /></div><Skeleton className="h-10 w-24 rounded-xl" /></div>
        <section className="grid gap-3 lg:grid-cols-2"><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-28 rounded-2xl" /></section>
      </main>
    </div>
  )
}
