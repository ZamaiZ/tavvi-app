import { Skeleton } from "@/components/ui/skeleton"

export default function PublicTableMenuLoading() {
  return (
    <main aria-label="Carregando cardápio da mesa" className="min-h-svh bg-background px-5 py-10">
      <div className="mx-auto grid min-h-[calc(100svh-5rem)] w-full max-w-xl content-center gap-7">
        <div className="flex items-center gap-4">
          <Skeleton className="size-[4.5rem] shrink-0 rounded-[1.5rem]" />
          <div className="grid gap-2.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-7 w-52 max-w-[58vw]" />
          </div>
        </div>
        <div className="grid gap-3 rounded-3xl border border-border/60 bg-card/60 p-5 shadow-sm">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-full max-w-sm" />
          <Skeleton className="mt-2 h-12 w-full rounded-xl" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl sm:col-span-2" />
        </div>
      </div>
    </main>
  )
}
