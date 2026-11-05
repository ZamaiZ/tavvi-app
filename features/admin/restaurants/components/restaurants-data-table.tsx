"use client"

import { motion, useReducedMotion } from "motion/react"
import {
  LuChevronLeft,
  LuChevronRight,
  LuStore,
} from "react-icons/lu"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  formatRestaurantDate,
  restaurantInitials,
  type RestaurantAdmin,
} from "@/features/admin/restaurants/model"
import { RestaurantStatusBadge } from "@/features/admin/restaurants/components/restaurant-status-badge"

type RestaurantsDataTableProps = {
  rows: RestaurantAdmin[]
  page: number
  pageCount: number
  pageSize: number
  totalRows: number
  onPageChange: (page: number) => void
  onOpenRestaurant: (restaurantId: string) => void
}

export function RestaurantsDataTable({
  rows,
  page,
  pageCount,
  pageSize,
  totalRows,
  onPageChange,
  onOpenRestaurant,
}: RestaurantsDataTableProps) {
  const shouldReduceMotion = useReducedMotion()
  const firstRow = totalRows === 0 ? 0 : (page - 1) * pageSize + 1
  const lastRow = Math.min(page * pageSize, totalRows)

  if (rows.length === 0) {
    return (
      <div
        aria-live="polite"
        className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/15 px-6 text-center"
      >
        <span className="flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <LuStore aria-hidden="true" className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium">Nenhum restaurante nesta página</p>
          <p className="max-w-sm text-xs leading-5 text-muted-foreground">
            Ajuste a busca ou escolha outra situação para ver restaurantes.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="hidden overflow-hidden rounded-xl border border-border/70 md:block">
        <div className="overflow-x-auto">
          <Table className="min-w-[680px]">
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="h-10 pl-4">Restaurante</TableHead>
                <TableHead className="h-10">Endereço</TableHead>
                <TableHead className="h-10">Situação</TableHead>
                <TableHead className="h-10 pr-4 text-right">Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((restaurant) => (
                <motion.tr
                  key={restaurant.id}
                  onClick={() => onOpenRestaurant(restaurant.id)}
                  whileHover={shouldReduceMotion ? undefined : { y: -1 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.998 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.16 }}
                  className="cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/45 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none last:border-0"
                >
                  <TableCell className="pl-4">
                    <button
                      type="button"
                      aria-label={`Abrir detalhes de ${restaurant.name}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onOpenRestaurant(restaurant.id)
                      }}
                      className="flex min-h-11 min-w-0 w-full items-center gap-3 rounded-md text-left focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <span
                        aria-hidden="true"
                        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-semibold text-primary"
                      >
                        {restaurantInitials(restaurant.name)}
                      </span>
                      <span className="min-w-0 truncate text-sm font-medium">
                        {restaurant.name}
                      </span>
                    </button>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    /{restaurant.slug}
                  </TableCell>
                  <TableCell>
                    <RestaurantStatusBadge status={restaurant.status} />
                  </TableCell>
                  <TableCell className="pr-4 text-right text-xs text-muted-foreground">
                    {formatRestaurantDate(restaurant.createdAt)}
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid gap-2 md:hidden">
        {rows.map((restaurant) => (
          <motion.button
            key={restaurant.id}
            type="button"
            aria-label={`Abrir ${restaurant.name}`}
            onClick={() => onOpenRestaurant(restaurant.id)}
            whileHover={shouldReduceMotion ? undefined : { y: -1 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.16 }}
            className="flex min-h-[76px] w-full items-center gap-3 rounded-2xl border border-border/70 bg-card px-3 py-3 text-left shadow-sm transition-colors hover:border-border hover:bg-card/90 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none"
          >
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-semibold text-primary"
            >
              {restaurantInitials(restaurant.name)}
            </span>
            <span className="min-w-0 flex-1 space-y-1">
              <span className="block truncate text-sm font-medium">
                {restaurant.name}
              </span>
              <span className="block truncate font-mono text-[0.6875rem] text-muted-foreground">
                /{restaurant.slug}
              </span>
            </span>
            <RestaurantStatusBadge status={restaurant.status} />
            <LuChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          </motion.button>
        ))}
      </div>

      {pageCount > 1 && (
        <nav
          aria-label="Paginação dos restaurantes"
          className="flex items-center justify-between gap-3 px-1 pt-1"
        >
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {firstRow}–{lastRow} de {totalRows}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Página anterior"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <LuChevronLeft aria-hidden="true" />
            </Button>
            <span className="min-w-16 text-center text-xs tabular-nums text-muted-foreground">
              Página {page} de {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Próxima página"
              disabled={page >= pageCount}
              onClick={() => onPageChange(page + 1)}
            >
              <LuChevronRight aria-hidden="true" />
            </Button>
          </div>
        </nav>
      )}
    </div>
  )
}
