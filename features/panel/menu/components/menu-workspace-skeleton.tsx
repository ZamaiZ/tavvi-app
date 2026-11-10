import { Skeleton } from "@/components/ui/skeleton"

export function MenuWorkspaceSkeleton() {
  return (
    <main aria-label="Carregando cardápio" className="min-h-svh">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5 px-4 py-7 sm:px-6 md:py-5 lg:px-8">
        <div className="mx-auto w-full max-w-[1320px] space-y-5">
          <header className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-3"><Skeleton className="h-7 w-28 rounded-lg" /><Skeleton className="h-9 w-72 max-w-[75vw]" /><Skeleton className="h-4 w-48" /></div>
              <Skeleton className="h-8 w-28 rounded-full" />
            </div>
            <div className="grid gap-2 sm:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-[68px] rounded-xl" />)}</div>
          </header>
          <Skeleton className="h-[58px] rounded-2xl" />
          <div className="hidden gap-4 md:flex">
            <Skeleton className="h-[420px] w-64 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-3 rounded-2xl border border-border/60 bg-card p-4">
              <Skeleton className="h-7 w-48" />
              {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-[92px] rounded-2xl" />)}
            </div>
          </div>
          <div className="space-y-4 md:hidden">
            {Array.from({ length: 2 }, (_, group) => <div key={group} className="space-y-2"><Skeleton className="h-7 w-44" />{Array.from({ length: 2 }, (_, index) => <Skeleton key={index} className="h-28 rounded-2xl" />)}</div>)}
          </div>
        </div>
      </div>
    </main>
  )
}
