import { Skeleton } from "@/components/ui/skeleton"

export function CallsWorkspaceSkeleton() {
  return (
    <main aria-label="Carregando chamados" className="min-h-svh">
      <div className="mx-auto w-full max-w-[1320px] space-y-5 px-4 pb-28 sm:px-6 md:pb-10 lg:px-8">
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-[94px] rounded-2xl" />
          <Skeleton className="h-[94px] rounded-2xl" />
        </div>
        <Skeleton className="h-11 w-full max-w-[28rem] rounded-xl" />
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="space-y-4 rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2"><Skeleton className="h-6 w-28" /><Skeleton className="h-3 w-40" /></div>
                <Skeleton className="h-6 w-28 rounded-full" />
              </div>
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
