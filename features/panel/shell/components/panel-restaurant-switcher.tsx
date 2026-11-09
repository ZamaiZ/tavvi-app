"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { motion, useReducedMotion } from "motion/react"
import { LuCheck, LuChevronRight, LuLoaderCircle } from "react-icons/lu"

import { selectPanelRestaurantAction } from "@/features/panel/workspace/actions"
import { restaurantInitials } from "@/features/panel/shell/lib/restaurant-initials"
import type { PanelRestaurantListItem } from "@/features/panel/workspace/server/restaurants"
import { PopoverDescription, PopoverTitle } from "@/components/ui/popover"

const SWITCHER_EASE = [0.23, 1, 0.32, 1] as const

function statusLabel(status: PanelRestaurantListItem["status"]) {
  if (status === "active") return "Ativo"
  if (status === "draft") return "Rascunho"
  return "Suspenso"
}

export function PanelRestaurantSwitcher({
  restaurants,
  currentRestaurantId,
  onClose,
}: {
  restaurants: PanelRestaurantListItem[]
  currentRestaurantId: string
  onClose: () => void
}) {
  const router = useRouter()
  const prefersReducedMotion = useReducedMotion()
  const reducedMotion = prefersReducedMotion === true
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const orderedRestaurants = [...restaurants].sort((left, right) => {
    if (left.id === currentRestaurantId) return -1
    if (right.id === currentRestaurantId) return 1
    return left.name.localeCompare(right.name, "pt-BR")
  })
  const listVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: reducedMotion ? 0 : 0.035 } },
  }
  const rowVariants = {
    hidden: reducedMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(5px)" },
    visible: {
      opacity: 1,
      transform: "translateY(0px)",
      transition: { duration: reducedMotion ? 0.12 : 0.16, ease: SWITCHER_EASE },
    },
  }

  function selectRestaurant(id: string) {
    if (id === currentRestaurantId) {
      onClose()
      return
    }

    setError("")
    setPendingId(id)
    startTransition(async () => {
      try {
        const result = await selectPanelRestaurantAction(id)
        if (!result.ok) {
          setError("Não foi possível trocar de restaurante. Atualize a página e tente novamente.")
          setPendingId(null)
          return
        }

        onClose()
        router.replace(result.destination)
      } catch {
        setError("Não foi possível trocar de restaurante. Atualize a página e tente novamente.")
        setPendingId(null)
      }
    })
  }

  return (
    <div className="space-y-2">
      <div className="space-y-0.5 px-1 pb-1">
        <PopoverTitle className="text-sm font-semibold tracking-tight">Seus restaurantes</PopoverTitle>
        <PopoverDescription className="text-xs">Escolha o espaço que deseja acessar.</PopoverDescription>
      </div>

      {error ? (
        <p role="status" aria-live="polite" className="rounded-xl bg-destructive/10 px-3 py-2 text-xs leading-5 text-destructive">
          {error}
        </p>
      ) : null}

      <motion.div
        initial={reducedMotion ? false : "hidden"}
        animate="visible"
        variants={listVariants}
        className="max-h-[min(52dvh,22rem)] space-y-1 overflow-y-auto pr-0.5"
      >
        {orderedRestaurants.map((restaurant) => {
          const active = restaurant.id === currentRestaurantId
          const selecting = pending && pendingId === restaurant.id

          return (
            <motion.button
              key={restaurant.id}
              variants={rowVariants}
              type="button"
              aria-current={active ? "true" : undefined}
              aria-busy={selecting}
              disabled={pending}
              onClick={() => selectRestaurant(restaurant.id)}
              className={`group flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left outline-none transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.99] motion-reduce:active:scale-100 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-65 ${
                active
                  ? "border-primary/20 bg-primary/[0.07]"
                  : "border-transparent bg-card/65 hover:border-border/70 hover:bg-card"
              }`}
            >
              <span className={`grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl text-xs font-semibold ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {restaurantInitials(restaurant.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{restaurant.name}</span>
                <span className="mt-0.5 block text-[0.6875rem] text-muted-foreground">
                  {selecting ? "Abrindo restaurante…" : `${active ? "Atual · " : ""}${statusLabel(restaurant.status)}`}
                </span>
              </span>
              {selecting ? (
                <LuLoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none" />
              ) : active ? (
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <LuCheck aria-hidden="true" className="size-3.5" />
                </span>
              ) : (
                <LuChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              )}
            </motion.button>
          )
        })}
      </motion.div>
    </div>
  )
}
