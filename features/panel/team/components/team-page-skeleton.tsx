import { Skeleton } from "@/components/ui/skeleton"

export function TeamPageSkeleton() {
  return (
    <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24 rounded-full" />
            <Skeleton className="h-7 w-40 rounded-lg" />
            <Skeleton className="h-4 w-64 max-w-[75vw] rounded-full" />
          </div>
          <Skeleton className="hidden h-10 w-40 rounded-xl sm:block" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-10 w-full rounded-xl sm:max-w-sm" />
            <Skeleton className="h-9 w-full rounded-xl sm:w-40" />
          </div>
          <div className="mt-5 hidden space-y-3 md:block">
            <Skeleton className="h-10 w-full rounded-lg" />
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-lg" />
            ))}
          </div>
          <div className="mt-5 grid gap-3 md:hidden">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-36 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
