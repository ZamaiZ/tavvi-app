"use client"

import { LuArrowDown, LuArrowUp, LuChevronLeft, LuChevronRight, LuListTree } from "react-icons/lu"
import { motion } from "motion/react"

import { Button } from "@/components/ui/button"
import { cn } from "cn"
import type { MenuCategoryDTO } from "../model"

export function MenuIndex({
  categories,
  selectedCategoryId,
  expanded,
  onExpandedChange,
  onSelect,
  onReorder,
}: {
  categories: MenuCategoryDTO[]
  selectedCategoryId: string | null
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  onSelect: (id: string | null) => void
  onReorder: (categoryId: string, direction: -1 | 1) => void
}) {
  return (
    <aside className={cn("hidden shrink-0 self-start rounded-2xl border border-border/70 bg-card/70 p-2 transition-[width] duration-200 motion-reduce:transition-none md:block", expanded ? "w-64" : "w-12")} aria-label="Índice de categorias">
      <div className={cn("flex h-9 items-center", expanded ? "justify-between px-2" : "justify-center")}>
        {expanded ? <span className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground"><LuListTree aria-hidden="true" />Índice</span> : null}
        {expanded ? <kbd className="rounded border border-border/70 bg-background px-1.5 py-0.5 text-[0.5625rem] font-medium text-muted-foreground">Ctrl I</kbd> : null}
        <Button type="button" size="icon-sm" variant="ghost" aria-label={expanded ? "Recolher índice" : "Expandir índice"} aria-keyshortcuts="Control+I Meta+I" aria-expanded={expanded} title="Atalho: Ctrl + I" onClick={() => onExpandedChange(!expanded)}>
          {expanded ? <LuChevronLeft aria-hidden="true" /> : <LuChevronRight aria-hidden="true" />}
        </Button>
      </div>
      {expanded ? (
        <nav className="mt-2 space-y-1">
          <Button type="button" size="sm" variant={selectedCategoryId === null ? "secondary" : "ghost"} className="w-full justify-start" onClick={() => onSelect(null)}>Todas as categorias<span className="ml-auto text-[0.6875rem] tabular-nums text-muted-foreground">{categories.length}</span></Button>
          {categories.map((category, index) => <motion.div key={category.id} layout="position" className="group flex min-w-0 items-center gap-1">
            <Button type="button" size="sm" variant={selectedCategoryId === category.id ? "secondary" : "ghost"} className="min-w-0 flex-1 justify-start" onClick={() => onSelect(category.id)}>
              <span className={cn("size-1.5 shrink-0 rounded-full", category.isVisible ? "bg-primary" : "bg-muted-foreground/40")} aria-hidden="true" />
              <span className="truncate">{category.name}</span>
              <span className="ml-auto text-[0.6875rem] tabular-nums text-muted-foreground">{category.items.length}</span>
            </Button>
            <div className="hidden shrink-0 group-hover:flex group-focus-within:flex">
              <Button type="button" size="icon-xs" variant="ghost" aria-label={`Mover ${category.name} para cima`} disabled={index === 0} onClick={() => onReorder(category.id, -1)}><LuArrowUp aria-hidden="true" /></Button>
              <Button type="button" size="icon-xs" variant="ghost" aria-label={`Mover ${category.name} para baixo`} disabled={index === categories.length - 1} onClick={() => onReorder(category.id, 1)}><LuArrowDown aria-hidden="true" /></Button>
            </div>
          </motion.div>)}
          {!categories.length ? <p className="px-2 py-3 text-xs leading-5 text-muted-foreground">Crie categorias para formar o índice.</p> : null}
        </nav>
      ) : <button type="button" onClick={() => onExpandedChange(true)} className="mt-2 flex w-full flex-col items-center gap-2 rounded-lg py-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Expandir índice de categorias" aria-keyshortcuts="Control+I Meta+I" title="Atalho: Ctrl + I"><LuListTree aria-hidden="true" /><span className="text-[0.625rem]">{categories.length}</span></button>}
    </aside>
  )
}
