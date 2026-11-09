"use client"

import { motion, useReducedMotion } from "motion/react"
import { LuCalendarDays, LuEllipsis, LuExternalLink } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  formatRestaurantDate,
  restaurantInitials,
  restaurantStatusLabels,
  type RestaurantAdmin,
} from "@/features/admin/restaurants/model"
import { RestaurantStatusBadge } from "@/features/admin/restaurants/components/restaurant-status-badge"

type RestaurantMobileCardProps = {
  restaurant: RestaurantAdmin
  index: number
  onOpenRestaurant: (restaurantId: string) => void
}

export function RestaurantMobileCard({
  restaurant,
  index,
  onOpenRestaurant,
}: RestaurantMobileCardProps) {
  const shouldReduceMotion = useReducedMotion()
  const openDetails = () => onOpenRestaurant(restaurant.id)

  return (
    <article className="relative min-w-0">
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <motion.button
              type="button"
              aria-label={`Abrir detalhes de ${restaurant.name}, restaurante ${restaurantStatusLabels[restaurant.status].toLowerCase()}`}
              aria-haspopup="dialog"
              onClick={openDetails}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: {
                  duration: shouldReduceMotion ? 0 : 0.22,
                  delay: shouldReduceMotion ? 0 : Math.min(index * 0.025, 0.12),
                  ease: "easeOut",
                },
              }}
              whileHover={
                shouldReduceMotion
                  ? undefined
                  : { y: -1, transition: { duration: 0.16, delay: 0 } }
              }
              whileTap={
                shouldReduceMotion
                  ? undefined
                  : { scale: 0.995, transition: { duration: 0.1, delay: 0 } }
              }
              className="w-full rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-muted/25 p-4 text-left shadow-sm transition-[border-color,background-color,box-shadow] hover:border-border hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none"
            />
          }
        >
          <span className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/10 bg-primary/10 text-xs font-semibold text-primary"
            >
              {restaurantInitials(restaurant.name)}
            </span>
            <span className="min-w-0 flex-1 pr-10">
              <span className="block truncate text-sm font-semibold tracking-tight text-foreground">
                {restaurant.name}
              </span>
              <span className="mt-1 block truncate font-mono text-[0.6875rem] text-muted-foreground">
                /{restaurant.slug}
              </span>
            </span>
          </span>
          <span className="mt-3 flex min-w-0 items-center justify-between gap-2 border-t border-border/60 pt-3">
            <RestaurantStatusBadge status={restaurant.status} />
            <span className="flex min-w-0 items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
              <LuCalendarDays
                aria-hidden="true"
                className="size-3.5 shrink-0"
              />
              <span className="min-w-0 truncate">
                Criado {formatRestaurantDate(restaurant.createdAt)}
              </span>
            </span>
          </span>
        </ContextMenuTrigger>
        <ContextMenuContent className="min-w-48">
          <ContextMenuItem onClick={openDetails}>
            <LuExternalLink aria-hidden="true" />
            Abrir detalhes
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Ações para ${restaurant.name}`}
              className="absolute top-2 right-2 z-10 size-8 rounded-lg bg-background/90 text-muted-foreground shadow-sm ring-1 ring-border/70 hover:bg-background hover:text-foreground"
            />
          }
        >
          <LuEllipsis aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem onClick={openDetails}>
            <LuExternalLink aria-hidden="true" />
            Abrir detalhes
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </article>
  )
}
