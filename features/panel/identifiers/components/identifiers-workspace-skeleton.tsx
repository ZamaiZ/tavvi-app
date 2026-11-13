import { Skeleton } from "@/components/ui/skeleton"

export function IdentifiersWorkspaceSkeleton() {
  return (
    <main aria-label="Carregando identificadores" className="min-h-svh">
      <div className="mx-auto w-full max-w-[1320px] space-y-5 px-4 pb-28 sm:px-6 md:pb-10 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-9 w-44 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
        <Skeleton className="h-[58px] rounded-2xl" />
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-10 w-32 shrink-0 rounded-full" />)}
        </div>
        <div className="hidden overflow-hidden rounded-2xl border border-border/70 bg-card md:block">
          <div className="grid grid-cols-[1fr_1.2fr_0.8fr_0.7fr] gap-4 border-b border-border/60 px-5 py-3">
            {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-3 w-20" />)}
          </div>
          {Array.from({ length: 5 }, (_, index) => <div key={index} className="grid grid-cols-[1fr_1.2fr_0.8fr_0.7fr] items-center gap-4 border-b border-border/50 px-5 py-5 last:border-b-0"><Skeleton className="h-4 w-24" /><Skeleton className="h-6 w-28 rounded-full" /><Skeleton className="h-4 w-20" /><Skeleton className="h-9 w-24 rounded-lg" /></div>)}
        </div>
        <div className="grid gap-3 md:hidden">
          {Array.from({ length: 3 }, (_, index) => <div key={index} className="space-y-4 rounded-2xl border border-border/70 bg-card p-4"><div className="flex justify-between"><Skeleton className="h-5 w-28" /><Skeleton className="h-6 w-24 rounded-full" /></div><Skeleton className="h-4 w-40" /><div className="flex gap-2"><Skeleton className="h-11 flex-1 rounded-xl" /><Skeleton className="h-11 w-24 rounded-xl" /></div></div>)}
        </div>
      </div>
    </main>
  )
}

