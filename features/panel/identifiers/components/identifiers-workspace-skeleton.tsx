import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-32 shrink-0 rounded-full" />
          ))}
        </div>
        <div className="hidden overflow-hidden rounded-2xl border border-border/70 bg-card md:block">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="h-11 px-5">
                  <Skeleton className="h-3 w-14" />
                </TableHead>
                <TableHead className="h-11 px-5">
                  <Skeleton className="h-3 w-28" />
                </TableHead>
                <TableHead className="h-11 px-5">
                  <Skeleton className="h-3 w-24" />
                </TableHead>
                <TableHead className="h-11 px-5 text-right">
                  <Skeleton className="ml-auto h-3 w-12" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }, (_, index) => (
                <TableRow key={index} className="border-border/60">
                  <TableCell className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <Skeleton className="size-8 rounded-lg" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </TableCell>
                  <TableCell className="px-5 py-3.5">
                    <Skeleton className="h-7 w-28 rounded-full" />
                  </TableCell>
                  <TableCell className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="h-[17px] w-7 rounded-full" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </TableCell>
                  <TableCell className="px-5 py-3.5">
                    <Skeleton className="ml-auto size-9 rounded-lg" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="grid gap-3 md:hidden">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="space-y-4 rounded-2xl border border-border/70 bg-card p-4"
            >
              <div className="flex justify-between">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <Skeleton className="h-4 w-40" />
              <div className="flex gap-2">
                <Skeleton className="h-11 flex-1 rounded-xl" />
                <Skeleton className="h-11 w-24 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
