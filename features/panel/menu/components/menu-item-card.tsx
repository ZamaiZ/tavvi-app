"use client"

import { LuArrowDown, LuArrowUp, LuImage, LuVideo } from "react-icons/lu"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { MenuItemActions } from "./menu-item-actions"
import type { MenuCategoryDTO, MenuItemDTO } from "../model"
import { formatMenuPriceCents } from "../lib/currency"

function priceLabel(item: MenuItemDTO) {
  return item.pricing.mode === "single" ? `R$ ${formatMenuPriceCents(item.pricing.basePriceCents)}` : `${item.pricing.variants.length} variações`
}

export function MenuItemCard({
  item, categories, onEdit, onDelete, onVisibility, onAvailability, onMove, onMovePosition, canMoveUp, canMoveDown,
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
  const media = item.media[0]
  return (
    <article className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {media?.kind === "image" ? <img src={media.url} alt={media.altText || `Foto de ${item.name}`} loading="lazy" className="size-full object-cover" /> : media?.posterUrl ? <img src={media.posterUrl} alt={media.altText || `Capa de ${item.name}`} loading="lazy" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-muted-foreground">{media?.kind === "video" ? <LuVideo className="size-8" aria-hidden="true" /> : <LuImage className="size-8" aria-hidden="true" />}</div>}
        {media?.kind === "video" ? <Badge className="absolute bottom-2 left-2 gap-1 bg-black/70 text-white"><LuVideo aria-hidden="true" />Vídeo</Badge> : null}
        <div className="absolute right-2 top-2"><MenuItemActions item={item} categories={categories} onEdit={onEdit} onDelete={onDelete} onVisibility={onVisibility} onMove={onMove} /></div>
      </div>
      <div className="space-y-3 p-3.5">
        <div className="flex min-w-0 items-start justify-between gap-2"><div className="min-w-0"><h3 className="truncate text-sm font-semibold">{item.name}</h3><p className="mt-1 text-sm font-semibold tabular-nums text-primary">{priceLabel(item)}</p></div><div className="flex flex-col items-end gap-1">{!item.isVisible ? <Badge variant="outline">Oculto</Badge> : null}{!item.isAvailable ? <Badge variant="secondary">Esgotado</Badge> : null}{item.missingMedia ? <Badge variant="destructive">Sem mídia</Badge> : null}</div></div>
        {item.description ? <p className="line-clamp-2 min-h-9 text-xs leading-5 text-muted-foreground">{item.description}</p> : null}
        <label className="flex items-center justify-between border-t border-border/60 pt-2 text-xs text-muted-foreground"><span>{item.isAvailable ? "Disponível" : "Esgotado"}</span><Switch checked={item.isAvailable} onCheckedChange={onAvailability} aria-label={`${item.isAvailable ? "Marcar como esgotado" : "Marcar como disponível"}: ${item.name}`} /></label>
        {onMovePosition ? <div className="flex justify-end gap-1"><Button type="button" size="icon-sm" variant="ghost" aria-label={`Mover ${item.name} para cima`} disabled={!canMoveUp} onClick={() => onMovePosition(-1)}><LuArrowUp aria-hidden="true" /></Button><Button type="button" size="icon-sm" variant="ghost" aria-label={`Mover ${item.name} para baixo`} disabled={!canMoveDown} onClick={() => onMovePosition(1)}><LuArrowDown aria-hidden="true" /></Button></div> : null}
      </div>
    </article>
  )
}
