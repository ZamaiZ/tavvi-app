import { Skeleton } from "@/components/ui/skeleton"

export function FinanceDashboardSkeleton() {
  return <main aria-label="Carregando resumo financeiro" className="mx-auto w-full max-w-[1320px] space-y-5 px-4 pb-32 sm:px-6 md:pb-10 lg:px-8">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Skeleton className="h-11 w-52 rounded-xl" /><Skeleton className="h-11 w-full rounded-xl sm:w-80" /></div>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-32 rounded-2xl" /></section>
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.85fr)]"><Skeleton className="h-[24rem] rounded-3xl" /><Skeleton className="h-[24rem] rounded-3xl" /></section>
    <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3"><Skeleton className="h-72 rounded-3xl" /><Skeleton className="h-72 rounded-3xl" /><Skeleton className="h-72 rounded-3xl" /></section>
  </main>
}
