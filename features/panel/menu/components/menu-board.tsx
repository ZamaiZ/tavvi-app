"use client"

import { useState } from "react"
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, horizontalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { LuArrowDown, LuArrowUp, LuEllipsis, LuEye, LuEyeOff, LuGrip, LuImage, LuPencil, LuPlus, LuTrash2, LuVideo } from "react-icons/lu"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import type { MenuCategoryDTO, MenuItemDTO } from "../model"
import { formatMenuPriceCents } from "../lib/currency"
import { MenuItemActions } from "./menu-item-actions"

function formatPrice(item: MenuItemDTO) {
  return item.pricing.mode === "single" ? `R$ ${formatMenuPriceCents(item.pricing.basePriceCents)}` : `${item.pricing.variants.length} variações`
}

function SortableBoardItem({
  item,
  category,
  categories,
  index,
  reducedMotion,
  onEdit,
  onDelete,
  onVisibility,
  onAvailability,
  onMove,
  onPosition,
  reorderItemsEnabled,
}: {
  item: MenuItemDTO
  category: MenuCategoryDTO
  categories: MenuCategoryDTO[]
  index: number
  reducedMotion: boolean
  onEdit: () => void
  onDelete: () => void
  onVisibility: () => void
  onAvailability: (value: boolean) => void
  onMove: (categoryId: string) => void
  onPosition: (direction: -1 | 1) => void
  reorderItemsEnabled: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `item:${item.id}`, data: { categoryId: category.id }, disabled: !reorderItemsEnabled })
  const media = item.media[0]
  return (
    <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition: reducedMotion ? "none" : transition }} className={`overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm ${isDragging ? "z-10 opacity-65 shadow-lg" : ""}`}>
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {media?.kind === "image" ? <img src={media.url} alt={media.altText || `Foto de ${item.name}`} loading="lazy" className="size-full object-cover" /> : media?.posterUrl ? <img src={media.posterUrl} alt={media.altText || `Capa de ${item.name}`} loading="lazy" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-muted-foreground">{media?.kind === "video" ? <LuVideo className="size-6" aria-hidden="true" /> : <LuImage className="size-6" aria-hidden="true" />}</div>}
        <Button type="button" size="icon-sm" variant="secondary" className="absolute left-2 top-2 cursor-grab touch-none active:cursor-grabbing" aria-label={`Arrastar ${item.name} para reordenar`} disabled={!reorderItemsEnabled} {...attributes} {...listeners}><LuGrip aria-hidden="true" /></Button>
        <div className="absolute right-2 top-2"><MenuItemActions item={item} categories={categories} onEdit={onEdit} onDelete={onDelete} onVisibility={onVisibility} onMove={onMove} /></div>
        {media?.kind === "video" ? <Badge className="absolute bottom-2 left-2 gap-1 bg-black/70 text-white"><LuVideo aria-hidden="true" />Vídeo</Badge> : null}
      </div>
      <div className="space-y-2.5 p-3">
        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h4 className="truncate text-sm font-semibold">{item.name}</h4><p className="mt-1 text-xs font-semibold text-primary">{formatPrice(item)}</p></div><div className="flex flex-wrap justify-end gap-1">{!item.isVisible ? <Badge variant="outline">Oculto</Badge> : null}{!item.isAvailable ? <Badge variant="secondary">Esgotado</Badge> : null}{item.missingMedia ? <Badge variant="destructive">Sem mídia</Badge> : null}</div></div>
        {item.description ? <p className="line-clamp-2 min-h-8 text-xs leading-4 text-muted-foreground">{item.description}</p> : null}
        <label className="flex items-center justify-between border-t border-border/60 pt-2 text-xs text-muted-foreground"><span>{item.isAvailable ? "Disponível" : "Esgotado"}</span><Switch checked={item.isAvailable} onCheckedChange={onAvailability} aria-label={`${item.isAvailable ? "Marcar como esgotado" : "Marcar como disponível"}: ${item.name}`} /></label>
        {reorderItemsEnabled ? <div className="flex justify-end gap-1"><Button type="button" size="icon-sm" variant="ghost" aria-label={`Mover ${item.name} para cima`} disabled={index === 0} onClick={() => onPosition(-1)}><LuArrowUp aria-hidden="true" /></Button><Button type="button" size="icon-sm" variant="ghost" aria-label={`Mover ${item.name} para baixo`} disabled={index === category.items.length - 1} onClick={() => onPosition(1)}><LuArrowDown aria-hidden="true" /></Button></div> : null}
      </div>
    </article>
  )
}

function SortableCategoryColumn({
  category,
  categories,
  onEditItem,
  onDeleteItem,
  onItemVisibility,
  onAvailability,
  onMove,
  onAddItem,
  onItemOrder,
  categoryIndex,
  onCategoryPosition,
  onEditCategory,
  onDeleteCategory,
  onCategoryVisibility,
  reorderItemsEnabled,
  reducedMotion,
}: {
  category: MenuCategoryDTO
  categories: MenuCategoryDTO[]
  onEditItem: (item: MenuItemDTO) => void
  onDeleteItem: (item: MenuItemDTO) => void
  onItemVisibility: (item: MenuItemDTO) => void
  onAvailability: (item: MenuItemDTO, value: boolean) => void
  onMove: (item: MenuItemDTO, categoryId: string) => void
  onAddItem: (categoryId: string) => void
  onItemOrder: (categoryId: string, itemIds: string[]) => void
  categoryIndex: number
  onCategoryPosition: (categoryId: string, direction: -1 | 1) => void
  onEditCategory: (category: MenuCategoryDTO) => void
  onDeleteCategory: (category: MenuCategoryDTO) => void
  onCategoryVisibility: (category: MenuCategoryDTO) => void
  reorderItemsEnabled: boolean
  reducedMotion: boolean
}) {
  const [announcement, setAnnouncement] = useState("")
  const { attributes: categoryAttributes, listeners: categoryListeners, setNodeRef: setCategoryRef, transform: categoryTransform, transition: categoryTransition, isDragging: isCategoryDragging } = useSortable({ id: `category:${category.id}` })
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!reorderItemsEnabled || !over || active.id === over.id || active.data.current?.categoryId !== over.data.current?.categoryId) return
    const oldIndex = category.items.findIndex((item) => `item:${item.id}` === active.id)
    const newIndex = category.items.findIndex((item) => `item:${item.id}` === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const items = arrayMove(category.items, oldIndex, newIndex)
    onItemOrder(category.id, items.map((item) => item.id))
    setAnnouncement(`${items[newIndex].name} movido para a posição ${newIndex + 1} em ${category.name}.`)
  }

  return (
    <section ref={setCategoryRef} style={{ transform: CSS.Transform.toString(categoryTransform), transition: reducedMotion ? "none" : categoryTransition }} className={`w-[min(340px,84vw)] shrink-0 rounded-2xl border border-border/70 bg-muted/35 p-3 ${isCategoryDragging ? "z-10 opacity-65 shadow-xl" : ""}`} aria-labelledby={`board-category-${category.id}`}>
      <header className="mb-3 flex items-center gap-2 border-b border-border/70 px-1 pb-3">
        <span className={`size-2 shrink-0 rounded-full ${category.isVisible ? "bg-primary" : "bg-muted-foreground/40"}`} aria-hidden="true" />
        <div className="min-w-0 flex-1"><h3 id={`board-category-${category.id}`} className="truncate text-sm font-semibold">{category.name}</h3><p className="text-xs text-muted-foreground">{category.items.length} {category.items.length === 1 ? "item" : "itens"}{!category.isVisible ? " · oculta" : ""}</p></div>
        <Button type="button" size="icon-sm" variant="ghost" aria-label={`Arrastar categoria ${category.name} para reordenar`} className="cursor-grab touch-none active:cursor-grabbing" {...categoryAttributes} {...categoryListeners}><LuGrip aria-hidden="true" /></Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label={`Mover categoria ${category.name} para cima`} disabled={categoryIndex === 0} onClick={() => onCategoryPosition(category.id, -1)}><LuArrowUp aria-hidden="true" /></Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label={`Mover categoria ${category.name} para baixo`} disabled={categoryIndex === categories.length - 1} onClick={() => onCategoryPosition(category.id, 1)}><LuArrowDown aria-hidden="true" /></Button>
        <Button type="button" size="icon-sm" variant="outline" aria-label={`Adicionar item em ${category.name}`} onClick={() => onAddItem(category.id)}><LuPlus aria-hidden="true" /></Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button type="button" size="icon-sm" variant="ghost" aria-label={`Ações da categoria ${category.name}`} />}><LuEllipsis aria-hidden="true" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEditCategory(category)}><LuPencil aria-hidden="true" />Editar categoria</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCategoryVisibility(category)}>{category.isVisible ? <LuEyeOff aria-hidden="true" /> : <LuEye aria-hidden="true" />}{category.isVisible ? "Ocultar" : "Reexibir"}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onDeleteCategory(category)}><LuTrash2 aria-hidden="true" />Excluir categoria</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={category.items.map((item) => `item:${item.id}`)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2.5">
            {category.items.map((item, index) => <SortableBoardItem key={item.id} item={item} category={category} categories={categories} index={index} reducedMotion={reducedMotion}
              reorderItemsEnabled={reorderItemsEnabled}
              onEdit={() => onEditItem(item)} onDelete={() => onDeleteItem(item)} onVisibility={() => onItemVisibility(item)}
              onAvailability={(value) => onAvailability(item, value)} onMove={(categoryId) => onMove(item, categoryId)}
              onPosition={(direction) => {
                const next = Math.max(0, Math.min(category.items.length - 1, index + direction))
                if (next === index) return
                const moved = arrayMove(category.items, index, next)
                onItemOrder(category.id, moved.map((entry) => entry.id))
                setAnnouncement(`${item.name} movido para a posição ${next + 1} em ${category.name}.`)
              }}
            />)}
            {!category.items.length ? <p className="rounded-xl border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">Adicione o primeiro item desta categoria.</p> : null}
          </div>
        </SortableContext>
      </DndContext>
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </section>
  )
}

export function MenuBoard({
  categories,
  onCategoryOrder,
  onItemOrder,
  onEditItem,
  onDeleteItem,
  onItemVisibility,
  onAvailability,
  onMove,
  onAddItem,
  onEditCategory,
  onDeleteCategory,
  onCategoryVisibility,
  onCategoryPosition,
  reorderItemsEnabled,
  reducedMotion,
}: {
  categories: MenuCategoryDTO[]
  onCategoryOrder: (categoryIds: string[]) => void
  onItemOrder: (categoryId: string, itemIds: string[]) => void
  onEditItem: (item: MenuItemDTO) => void
  onDeleteItem: (item: MenuItemDTO) => void
  onItemVisibility: (item: MenuItemDTO) => void
  onAvailability: (item: MenuItemDTO, value: boolean) => void
  onMove: (item: MenuItemDTO, categoryId: string) => void
  onAddItem: (categoryId: string) => void
  onEditCategory: (category: MenuCategoryDTO) => void
  onDeleteCategory: (category: MenuCategoryDTO) => void
  onCategoryVisibility: (category: MenuCategoryDTO) => void
  onCategoryPosition: (categoryId: string, direction: -1 | 1) => void
  reorderItemsEnabled: boolean
  reducedMotion: boolean
}) {
  const [announcement, setAnnouncement] = useState("")
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  return (
    <div className="hidden md:block">
      {categories.length ? <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => {
        if (!event.over || event.active.id === event.over.id) return
        const oldIndex = categories.findIndex((category) => `category:${category.id}` === event.active.id)
        const newIndex = categories.findIndex((category) => `category:${category.id}` === event.over?.id)
        if (oldIndex < 0 || newIndex < 0) return
        const moved = arrayMove(categories, oldIndex, newIndex)
        onCategoryOrder(moved.map((category) => category.id))
        setAnnouncement(`${moved[newIndex].name} movida para a posição ${newIndex + 1} das categorias.`)
      }}>
        <SortableContext items={categories.map((category) => `category:${category.id}`)} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-3 overflow-x-auto pb-3">
            {categories.map((category, categoryIndex) => <SortableCategoryColumn key={category.id} category={category} categories={categories} categoryIndex={categoryIndex} reorderItemsEnabled={reorderItemsEnabled} reducedMotion={reducedMotion} onEditCategory={onEditCategory} onDeleteCategory={onDeleteCategory} onCategoryVisibility={onCategoryVisibility} onCategoryPosition={onCategoryPosition} onEditItem={onEditItem} onDeleteItem={onDeleteItem} onItemVisibility={onItemVisibility} onAvailability={onAvailability} onMove={onMove} onAddItem={onAddItem} onItemOrder={onItemOrder} />)}
          </div>
        </SortableContext>
      </DndContext> : <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">Crie uma categoria para começar a organizar o Quadro.</div>}
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </div>
  )
}
