"use client"

import { LuArrowDown, LuArrowUp, LuEllipsis, LuEye, LuEyeOff, LuLayers2, LuPlus, LuPencil, LuTrash2 } from "react-icons/lu"
import { motion, useReducedMotion } from "motion/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MenuItemRow } from "./menu-item-row"
import type { MenuCategoryDTO, MenuItemDTO } from "../model"

export function MenuMobileList({
  categories,
  allCategories,
  reorderEnabled,
  onAddItem,
  onEditCategory,
  onDeleteCategory,
  onCategoryVisibility,
  onCategoryPosition,
  onItemPosition,
  onEditItem,
  onDeleteItem,
  onItemVisibility,
  onAvailability,
  onMove,
}: {
  categories: MenuCategoryDTO[]
  allCategories: MenuCategoryDTO[]
  reorderEnabled: boolean
  onAddItem: (categoryId: string) => void
  onEditCategory: (category: MenuCategoryDTO) => void
  onDeleteCategory: (category: MenuCategoryDTO) => void
  onCategoryVisibility: (category: MenuCategoryDTO) => void
  onCategoryPosition: (categoryId: string, direction: -1 | 1) => void
  onItemPosition: (item: MenuItemDTO, direction: -1 | 1) => void
  onEditItem: (item: MenuItemDTO) => void
  onDeleteItem: (item: MenuItemDTO) => void
  onItemVisibility: (item: MenuItemDTO) => void
  onAvailability: (item: MenuItemDTO, value: boolean) => void
  onMove: (item: MenuItemDTO, categoryId: string) => void
}) {
  const reducedMotion = useReducedMotion() === true
  return (
    <div className="space-y-7 md:hidden">
      {categories.map((category, categoryIndex) => {
        const categoryPosition = allCategories.findIndex((entry) => entry.id === category.id)
        return <motion.section key={category.id} id={`menu-category-${category.id}`} layout="position" initial={reducedMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0.1 : 0.17, delay: reducedMotion ? 0 : Math.min(categoryIndex * 0.025, 0.18) }} className="scroll-mt-24 space-y-3">
          <header className="flex items-center gap-2 border-b border-border/70 pb-2">
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-semibold tracking-tight">{category.name}</h2>{!category.isVisible ? <Badge variant="outline" className="h-5">Oculta</Badge> : null}</div>{category.description ? <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{category.description}</p> : null}</div>
            <Button type="button" size="icon-sm" variant="outline" aria-label={`Adicionar item em ${category.name}`} onClick={() => onAddItem(category.id)}><LuPlus aria-hidden="true" /></Button>
            {reorderEnabled ? <div className="flex">
              <Button type="button" size="icon-sm" variant="ghost" aria-label={`Mover categoria ${category.name} para cima`} disabled={categoryPosition === 0} onClick={() => onCategoryPosition(category.id, -1)}><LuArrowUp aria-hidden="true" /></Button>
              <Button type="button" size="icon-sm" variant="ghost" aria-label={`Mover categoria ${category.name} para baixo`} disabled={categoryPosition === allCategories.length - 1} onClick={() => onCategoryPosition(category.id, 1)}><LuArrowDown aria-hidden="true" /></Button>
            </div> : null}
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
          {category.items.length ? <div className="space-y-2.5">{category.items.map((item, index) => <motion.div key={item.id} layout="position" initial={reducedMotion ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0.1 : 0.15, delay: reducedMotion ? 0 : Math.min(index * 0.018, 0.14) }}><MenuItemRow
            item={item}
            categories={allCategories}
            onEdit={() => onEditItem(item)}
            onDelete={() => onDeleteItem(item)}
            onVisibility={() => onItemVisibility(item)}
            onAvailability={(value) => onAvailability(item, value)}
            onMove={(categoryId) => onMove(item, categoryId)}
            onMovePosition={reorderEnabled ? (direction) => onItemPosition(item, direction) : undefined}
            canMoveUp={index > 0}
            canMoveDown={index < category.items.length - 1}
          /></motion.div>)}</div> : <div className="rounded-xl border border-dashed border-border/70 px-4 py-5 text-center"><LuLayers2 aria-hidden="true" className="mx-auto size-5 text-muted-foreground" /><p className="mt-2 text-xs text-muted-foreground">Ainda não há itens nesta categoria.</p><Button type="button" size="sm" variant="ghost" className="mt-1" onClick={() => onAddItem(category.id)}>Adicionar o primeiro item</Button></div>}
        </motion.section>
      })}
    </div>
  )
}
