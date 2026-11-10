"use client"

import { useMemo } from "react"
import { LuEllipsis, LuEye, LuEyeOff, LuLayers2, LuPencil, LuTrash2 } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MenuComboboxField, type MenuComboboxOption } from "./menu-fields"
import type { MenuCategoryDTO, MenuItemDTO } from "../model"

export function MenuItemActions({
  item,
  categories,
  onEdit,
  onDelete,
  onVisibility,
  onMove,
}: {
  item: MenuItemDTO
  categories: MenuCategoryDTO[]
  onEdit: () => void
  onDelete: () => void
  onVisibility: () => void
  onMove: (categoryId: string) => void
}) {
  const categoryOptions = useMemo<MenuComboboxOption[]>(() => categories.map((category) => ({ value: category.id, label: category.name })), [categories])

  return (
    <div className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
      {categories.length > 1 ? <MenuComboboxField id={`move-${item.id}`} ariaLabel={`Categoria de ${item.name}`} value={item.categoryId} options={categoryOptions} onValueChange={onMove} icon={<LuLayers2 aria-hidden="true" />} placeholder="Mover categoria" className="h-8 w-36 max-w-36" /> : null}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon" aria-label={`Ações de ${item.name}`} className="size-8 text-muted-foreground" />}>
          <LuEllipsis aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem onClick={onEdit}><LuPencil aria-hidden="true" />Editar item</DropdownMenuItem>
          <DropdownMenuItem onClick={onVisibility}>{item.isVisible ? <LuEyeOff aria-hidden="true" /> : <LuEye aria-hidden="true" />}{item.isVisible ? "Ocultar" : "Reexibir"}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}><LuTrash2 aria-hidden="true" />Excluir item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
