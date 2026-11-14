import { Skeleton } from "@/components/ui/skeleton"

export function FeedbackWorkspaceSkeleton() {
  return (
    <main aria-label="Carregando feedbacks" aria-busy="true" className="min-h-svh">
      <div className="mx-auto w-full max-w-[1320px] space-y-5 px-4 pb-28 sm:px-6 md:pb-10 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-2"><Skeleton className="h-4 w-52" /><Skeleton className="h-8 w-64 rounded-xl" /></div>
          <Skeleton className="h-11 w-32 rounded-xl" />
        </div>
        <div className="flex gap-2"><Skeleton className="h-10 w-28 rounded-xl" /><Skeleton className="h-10 w-32 rounded-xl" /></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="space-y-4 rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><Skeleton className="size-9 rounded-xl" /><div className="space-y-1.5"><Skeleton className="h-3.5 w-28" /><Skeleton className="h-2.5 w-36" /></div></div><Skeleton className="h-6 w-14 rounded-full" /></div>
              <div className="space-y-2"><Skeleton className="h-3.5 w-full" /><Skeleton className="h-3.5 w-11/12" /><Skeleton className="h-3.5 w-2/3" /></div>
              <div className="flex items-center justify-between border-t border-border/50 pt-3.5"><div className="flex gap-2"><Skeleton className="size-16 rounded-xl" /><Skeleton className="size-16 rounded-xl" /></div><Skeleton className="size-8 rounded-full" /></div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
