"use client"

import { motion, type Variants } from "motion/react"
import { LuArrowUpRight, LuImage, LuVideo } from "react-icons/lu"

import { Badge } from "@/components/ui/badge"
import type { MenuCategoryDTO, MenuItemDTO } from "@/features/panel/menu/model"
import { formatMenuPriceCents } from "@/features/panel/menu/lib/currency"

const EASE = [0.23, 1, 0.32, 1] as const

function itemIsAvailable(item: MenuItemDTO, categoryVisible: boolean) {
  if (!categoryVisible || !item.isVisible || item.missingMedia || !item.isAvailable) return false
  return item.pricing.mode === "single" || item.pricing.variants.some((variant) => variant.isAvailable)
}

function unavailableLabel(item: MenuItemDTO, categoryVisible: boolean) {
  if (!categoryVisible) return "Categoria oculta"
  if (!item.isVisible) return "Item oculto"
  if (item.missingMedia) return "Sem foto"
  return "Esgotado"
}

function priceSummary(item: MenuItemDTO) {
  if (item.pricing.mode === "single") return "R$ " + formatMenuPriceCents(item.pricing.basePriceCents)
  const prices = item.pricing.variants.map((variant) => variant.priceCents)
  if (!prices.length) return "Sem variações"
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max
    ? "A partir de R$ " + formatMenuPriceCents(min)
    : "R$ " + formatMenuPriceCents(min) + " – " + formatMenuPriceCents(max)
}

function CatalogItem({
  item,
  categoryName,
  categoryVisible,
  index,
  reducedMotion,
  canSelect,
  onSelect,
}: {
  item: MenuItemDTO
  categoryName: string
  categoryVisible: boolean
  index: number
  reducedMotion: boolean
  canSelect: boolean
  onSelect: (item: MenuItemDTO, categoryName: string) => void
}) {
  const media = item.media[0]
  const available = itemIsAvailable(item, categoryVisible)
  const price = priceSummary(item)

  return (
    <motion.li
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0.1 : 0.18, delay: reducedMotion ? 0 : Math.min(index * 0.018, 0.14), ease: EASE }}
      className="list-none"
    >
      <button
        type="button"
        disabled={!available || !canSelect}
        onClick={() => onSelect(item, categoryName)}
        aria-label={item.name + ", " + categoryName + ", " + (available ? price : unavailableLabel(item, categoryVisible)) + ". " + (item.pricing.mode === "variants" ? "Escolher variação" : "Configurar item")}
        className="group flex min-h-28 w-full min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 text-left shadow-sm outline-none transition-[border-color,box-shadow,transform,background-color] duration-200 hover:border-primary/25 hover:bg-card/95 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100 sm:gap-4 sm:p-3.5"
      >
        <span className="relative size-[5.5rem] shrink-0 overflow-hidden rounded-xl bg-muted sm:size-24">
          {media?.kind === "image" ? (
            <img src={media.url} alt={media.altText || "Foto de " + item.name} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.035] motion-reduce:transition-none" />
          ) : media?.posterUrl ? (
            <img src={media.posterUrl} alt={media.altText || "Capa de " + item.name} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.035] motion-reduce:transition-none" />
          ) : (
            <span className="grid size-full place-items-center text-muted-foreground">
              {media?.kind === "video" ? <LuVideo aria-hidden="true" className="size-6" /> : <LuImage aria-hidden="true" className="size-6" />}
            </span>
          )}
          {media?.kind === "video" ? <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/70 p-1 text-white"><LuVideo aria-hidden="true" className="size-3" /></span> : null}
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="h-5 max-w-full truncate rounded-full px-2 text-[0.625rem] font-medium">{categoryName}</Badge>
            {!available ? <Badge variant="secondary" className="h-5 rounded-full px-2 text-[0.625rem]">{unavailableLabel(item, categoryVisible)}</Badge> : null}
          </span>
          <span className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-[0.95rem]">{item.name}</span>
          {item.description ? <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">{item.description}</span> : null}
          {item.pricing.mode === "variants" ? (
            <span className="flex flex-wrap gap-1.5 pt-0.5">
              {item.pricing.variants.map((variant) => (
                <span key={variant.id} className={variant.isAvailable ? "inline-flex items-center gap-1 rounded-lg border border-border/70 bg-background/75 px-2 py-1 text-[0.65rem] tabular-nums text-foreground/80" : "inline-flex items-center gap-1 rounded-lg border border-border/50 bg-muted/50 px-2 py-1 text-[0.65rem] tabular-nums text-muted-foreground line-through"}>
                  {variant.name}<span aria-hidden="true" className="text-muted-foreground/70">·</span>R$ {formatMenuPriceCents(variant.priceCents)}
                </span>
              ))}
            </span>
          ) : (
            <span className="pt-0.5 text-sm font-semibold tabular-nums text-primary">{price}</span>
          )}
        </span>

        <span aria-hidden="true" className="hidden size-9 shrink-0 place-items-center rounded-xl bg-primary/[0.07] text-primary transition-[transform,background-color] group-hover:translate-x-0.5 group-hover:bg-primary/10 sm:grid">
          <LuArrowUpRight className="size-4" />
        </span>
      </button>
    </motion.li>
  )
}

export function OrderMenuCatalog({
  categories,
  reducedMotion,
  canSelect = true,
  onSelectItem,
}: {
  categories: MenuCategoryDTO[]
  reducedMotion: boolean
  canSelect?: boolean
  onSelectItem: (item: MenuItemDTO, categoryName: string) => void
}) {
  const sequence = {
    hidden: {},
    visible: { transition: { staggerChildren: reducedMotion ? 0 : 0.035 } },
  } satisfies Variants

  return (
    <motion.div
      initial={reducedMotion ? false : "hidden"}
      animate="visible"
      variants={sequence}
      className="h-full min-h-0 overflow-y-auto overscroll-contain px-4 pb-5 pt-1 sm:px-6"
    >
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {categories.map((category) => (
          <section key={category.id} aria-labelledby={"order-category-" + category.id} className="space-y-2.5">
            <header className="flex items-end justify-between gap-3 border-b border-border/60 pb-2">
              <div className="min-w-0">
                <h2 id={"order-category-" + category.id} className="truncate text-sm font-semibold tracking-tight">{category.name}</h2>
                {category.description ? <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{category.description}</p> : null}
              </div>
              <span className="shrink-0 text-[0.68rem] tabular-nums text-muted-foreground">{category.items.length} {category.items.length === 1 ? "item" : "itens"}</span>
            </header>
            <ul className="grid gap-2.5">
              {category.items.map((item, index) => (
                <CatalogItem
                  key={item.id}
                  item={item}
                  categoryName={category.name}
                  categoryVisible={category.isVisible}
                  index={index}
                  reducedMotion={reducedMotion}
                  canSelect={canSelect}
                  onSelect={onSelectItem}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </motion.div>
  )
}
