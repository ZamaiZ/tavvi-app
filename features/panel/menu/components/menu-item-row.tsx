"use client"

import { LuImage, LuMoveDown, LuMoveUp, LuVideo } from "react-icons/lu"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { MenuItemActions } from "./menu-item-actions"
import type { MenuCategoryDTO, MenuItemDTO } from "../model"
import { formatMenuPriceCents } from "../lib/currency"

function priceLabel(item: MenuItemDTO) {
  return item.pricing.mode === "single"
    ? `R$ ${formatMenuPriceCents(item.pricing.basePriceCents)}`
    : `${item.pricing.variants.length} variações`
}

export function MenuItemRow({
  item,
  categories,
  onEdit,
  onDelete,
  onVisibility,
  onAvailability,
  onMove,
  onMovePosition,
  canMoveUp,
  canMoveDown,
}: {
  item: MenuItemDTO
  categories: MenuCategoryDTO[]
  onEdit: () => void
  onDelete: () => void
  onVisibility: () => void
  onAvailability: (value: boolean) => void
  onMove: (categoryId: string) => void
  onMovePosition?: (direction: -1 | 1) => void
  canMoveUp?: boolean
  canMoveDown?: boolean
}) {
  const firstMedia = item.media[0]
  return (
    <article className="group flex min-w-0 flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:border-border hover:shadow-md sm:flex-row sm:items-center sm:p-3.5">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted sm:size-[76px]">
        {firstMedia?.kind === "image" ? <img src={firstMedia.url} alt={firstMedia.altText || `Foto de ${item.name}`} loading="lazy" className="size-full object-cover" /> : firstMedia?.posterUrl ? <img src={firstMedia.posterUrl} alt={firstMedia.altText || `Capa de ${item.name}`} loading="lazy" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-muted-foreground">{firstMedia?.kind === "video" ? <LuVideo aria-hidden="true" className="size-6" /> : <LuImage aria-hidden="true" className="size-6" />}</div>}
        {firstMedia?.kind === "video" ? <span className="absolute bottom-1 left-1 rounded bg-black/70 p-1 text-white"><LuVideo aria-hidden="true" className="size-3" /></span> : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="truncate text-sm font-semibold tracking-tight">{item.name}</h3>
          {!item.isVisible ? <Badge variant="outline" className="h-5">Oculto</Badge> : null}
          {!item.isAvailable ? <Badge variant="secondary" className="h-5">Esgotado</Badge> : null}
          {item.missingMedia ? <Badge variant="destructive" className="h-5">Sem mídia</Badge> : null}
        </div>
        {item.description ? <p className="mt-1 line-clamp-1 text-xs leading-5 text-muted-foreground">{item.description}</p> : <p className="mt-1 text-xs text-muted-foreground">{priceLabel(item)}</p>}
        {item.description ? <p className="mt-1 text-xs font-semibold tabular-nums text-foreground/80">{priceLabel(item)}</p> : null}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2 sm:border-0 sm:pt-0">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={item.isAvailable} onCheckedChange={onAvailability} aria-label={`${item.isAvailable ? "Marcar como esgotado" : "Marcar como disponível"}: ${item.name}`} />
          {item.isAvailable ? "Disponível" : "Esgotado"}
        </label>
        <div className="flex items-center gap-1">
          {onMovePosition ? <div className="flex">
            <Button type="button" size="icon-sm" variant="ghost" aria-label={`Mover ${item.name} para cima`} disabled={!canMoveUp} onClick={() => onMovePosition(-1)}><LuMoveUp aria-hidden="true" /></Button>
            <Button type="button" size="icon-sm" variant="ghost" aria-label={`Mover ${item.name} para baixo`} disabled={!canMoveDown} onClick={() => onMovePosition(1)}><LuMoveDown aria-hidden="true" /></Button>
          </div> : null}
          <MenuItemActions item={item} categories={categories} onEdit={onEdit} onDelete={onDelete} onVisibility={onVisibility} onMove={onMove} />
        </div>
      </div>
    </article>
  )
}
