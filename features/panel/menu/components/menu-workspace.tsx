"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react"
import { LuArrowDown, LuBookOpenCheck, LuCheck, LuCircleAlert, LuEllipsis, LuExternalLink, LuEye, LuEyeOff, LuGrid2X2, LuLayers2, LuList, LuListFilter, LuLoaderCircle, LuPencil, LuPlus, LuSearch, LuTrash2, LuUtensils, LuX } from "react-icons/lu"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PanelPageHeading } from "@/features/panel/workspace/components/panel-page-heading"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MenuBoard } from "./menu-board"
import { MenuCategoryEditor } from "./menu-category-editor"
import { MenuIndex } from "./menu-index"
import { MenuItemCard } from "./menu-item-card"
import { MenuItemEditor } from "./menu-item-editor"
import { MenuItemRow } from "./menu-item-row"
import { MenuMobileList } from "./menu-mobile-list"
import { MenuBatchWorkspace } from "./menu-batch-workspace"
import { MenuComboboxField, type MenuComboboxOption } from "./menu-fields"
import { publishMenuAction, unpublishMenuAction, setMenuAvailabilityAction, setMenuVisibilityAction, moveMenuItemAction, reorderMenuCategoriesAction, reorderMenuItemsAction, deleteMenuCategoryAction, deleteMenuItemAction } from "../actions"
import { type MenuActionFailureCode, type MenuCategoryDTO, type MenuItemDTO, type PanelMenuDTO } from "../model"

type ViewMode = "index" | "board"
type IndexLayout = "list" | "grid"
type ItemFilter = "all" | "hidden" | "unavailable" | "without-media"
type DeleteTarget = { kind: "item"; value: MenuItemDTO } | { kind: "category"; value: MenuCategoryDTO }

const MENU_FILTER_OPTIONS: readonly MenuComboboxOption[] = [
  { value: "all", label: "Todos os itens" },
  { value: "hidden", label: "Ocultos" },
  { value: "unavailable", label: "Esgotados" },
  { value: "without-media", label: "Sem mídia" },
]

function menuCounts(categories: MenuCategoryDTO[]): PanelMenuDTO["counts"] {
  const items = categories.flatMap((category) => category.items)
  return {
    categories: categories.length,
    items: items.length,
    visibleItems: items.filter((item) => item.isVisible).length,
    publicItems: categories.reduce((count, category) => count + category.items.filter((item) => category.isVisible && item.isVisible && item.media.length > 0).length, 0),
    unavailableItems: items.filter((item) => !item.isAvailable).length,
    missingMediaItems: items.filter((item) => item.missingMedia).length,
  }
}

function withCategories(menu: PanelMenuDTO, categories: MenuCategoryDTO[]): PanelMenuDTO {
  return { ...menu, categories, counts: menuCounts(categories) }
}

function matchesItem(category: MenuCategoryDTO, item: MenuItemDTO, query: string, filter: ItemFilter) {
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR")
  const matchesQuery = !normalizedQuery || `${item.name} ${item.description}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery)
  const matchesFilter = filter === "all"
    || (filter === "hidden" && (!item.isVisible || !category.isVisible))
    || (filter === "unavailable" && !item.isAvailable)
    || (filter === "without-media" && item.missingMedia)
  return matchesQuery && matchesFilter
}

function failureMessage(code: MenuActionFailureCode) {
  switch (code) {
    case "published_menu_empty": return "Esta alteração deixaria o cardápio publicado sem itens visíveis com mídia. Mantenha outro item público ou despublique primeiro."
    case "menu_requires_public_item": return "Adicione ao menos um item visível com mídia antes de publicar."
    case "category_not_empty": return "Mova ou exclua os itens desta categoria antes de excluí-la."
    case "category_not_found": return "Esta categoria mudou. Atualize o cardápio e tente novamente."
    case "item_not_found": return "Este item mudou. Atualize o cardápio e tente novamente."
    case "session_expired": return "Sua sessão expirou. Entre novamente para continuar."
    case "context_changed": return "O restaurante ativo mudou. Atualize o cardápio antes de continuar."
    case "invalid_media": return "Uma mídia não foi confirmada. Remova o arquivo e adicione-o novamente."
    default: return "Não foi possível salvar essa alteração. Tente novamente."
  }
}

function MenuCategoryActions({ category, onEdit, onDelete, onVisibility }: {
  category: MenuCategoryDTO
  onEdit: () => void
  onDelete: () => void
  onVisibility: () => void
}) {
  return <DropdownMenu>
    <DropdownMenuTrigger render={<Button type="button" size="icon-sm" variant="ghost" aria-label={`Ações da categoria ${category.name}`} />}><LuEllipsis aria-hidden="true" /></DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={onEdit}><LuPencil aria-hidden="true" />Editar</DropdownMenuItem>
      <DropdownMenuItem onClick={onVisibility}>{category.isVisible ? <LuEyeOff aria-hidden="true" /> : <LuEye aria-hidden="true" />}{category.isVisible ? "Ocultar" : "Reexibir"}</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" onClick={onDelete}><LuTrash2 aria-hidden="true" />Excluir</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
}

export function MenuWorkspace({ initialMenu, publicUrl }: { initialMenu: PanelMenuDTO; publicUrl: string }) {
  const router = useRouter()
  const prefersReducedMotion = useReducedMotion()
  const [menu, setMenu] = useState(initialMenu)
  const [view, setView] = useState<ViewMode>("index")
  const [layout, setLayout] = useState<IndexLayout>("list")
  const [indexExpanded, setIndexExpanded] = useState(true)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<ItemFilter>("all")
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<MenuCategoryDTO | null>(null)
  const [itemEditorOpen, setItemEditorOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItemDTO | null>(null)
  const [itemEditorCategoryId, setItemEditorCategoryId] = useState<string | null>(null)
  const [batchOpen, setBatchOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [publicationPending, setPublicationPending] = useState(false)
  const [pendingOperation, setPendingOperation] = useState(false)
  const operationRef = useRef(false)
  const [feedback, setFeedback] = useState("")

  useEffect(() => setMenu(initialMenu), [initialMenu])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`tavvi-menu-view:${initialMenu.restaurantId}`)
      if (stored === "board" || stored === "index") setView(stored)
      const storedLayout = localStorage.getItem(`tavvi-menu-layout:${initialMenu.restaurantId}`)
      if (storedLayout === "grid" || storedLayout === "list") setLayout(storedLayout)
    } catch {
      // A storage preference is optional; the default remains Índice/Lista.
    }
  }, [initialMenu.restaurantId])

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const isIndexShortcut = !event.repeat
        && (event.ctrlKey || event.metaKey)
        && event.key.toLowerCase() === "i"
        && !event.altKey
        && !event.shiftKey
      if (!isIndexShortcut || view !== "index" || !window.matchMedia("(min-width: 768px)").matches) return
      if (categoryEditorOpen || itemEditorOpen || batchOpen || deleteTarget) return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, [role='combobox'], [contenteditable='true']"))) return
      event.preventDefault()
      setIndexExpanded((current) => !current)
    }

    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [batchOpen, categoryEditorOpen, deleteTarget, itemEditorOpen, view])

  function chooseView(next: ViewMode) {
    setView(next)
    try { localStorage.setItem(`tavvi-menu-view:${menu.restaurantId}`, next) } catch { /* Preference is best effort. */ }
    if (next === "board") setSelectedCategoryId(null)
  }

  function chooseLayout(next: IndexLayout) {
    setLayout(next)
    try { localStorage.setItem(`tavvi-menu-layout:${menu.restaurantId}`, next) } catch { /* Preference is best effort. */ }
  }

  const allFilteredCategories = useMemo(() => menu.categories.flatMap((category) => {
    const items = category.items.filter((item) => matchesItem(category, item, query, filter))
    if ((query.trim() || filter !== "all") && !items.length) return []
    return [{ ...category, items }]
  }), [menu.categories, query, filter])
  const categoriesForView = useMemo(() => view === "index" && selectedCategoryId
    ? allFilteredCategories.filter((category) => category.id === selectedCategoryId)
    : allFilteredCategories,
  [allFilteredCategories, selectedCategoryId, view])
  const boardCategories = useMemo(() => menu.categories.map((category) => ({
    ...category,
    items: category.items.filter((item) => matchesItem(category, item, query, filter)),
  })), [menu.categories, query, filter])

  function itemEditor(item: MenuItemDTO | null, categoryId?: string) {
    if (!item && categoryId && !menu.categories.some((category) => category.id === categoryId)) return
    if (!item && !menu.categories.length) {
      setFeedback("Crie uma categoria antes de adicionar itens.")
      setEditingCategory(null)
      setCategoryEditorOpen(true)
      return
    }
    setEditingItem(item)
    setItemEditorCategoryId(item?.categoryId ?? categoryId ?? null)
    setItemEditorOpen(true)
  }

  function categoryEditor(category: MenuCategoryDTO | null) {
    setEditingCategory(category)
    setCategoryEditorOpen(true)
  }

  async function mutateMenu<T>(optimistic: (current: PanelMenuDTO) => PanelMenuDTO, action: () => Promise<{ ok: true; data: T } | { ok: false; code: MenuActionFailureCode }>) {
    if (operationRef.current) return false
    operationRef.current = true
    const previous = menu
    setMenu((current) => optimistic(current))
    setFeedback("")
    setPendingOperation(true)
    try {
      const result = await action()
      if (!result.ok) {
        setMenu(previous)
        setFeedback(failureMessage(result.code))
        return false
      }
      router.refresh()
      return true
    } catch {
      setMenu(previous)
      setFeedback("A conexão falhou. A alteração foi revertida; tente novamente.")
      return false
    } finally {
      operationRef.current = false
      setPendingOperation(false)
    }
  }

  function changeVisibility(kind: "category" | "item", id: string, current: boolean) {
    const nextValue = !current
    const optimistic = (currentMenu: PanelMenuDTO) => withCategories(currentMenu, currentMenu.categories.map((category) => kind === "category"
      ? category.id === id ? { ...category, isVisible: nextValue } : category
      : { ...category, items: category.items.map((item) => item.id === id ? { ...item, isVisible: nextValue } : item) }))
    void mutateMenu(optimistic, () => setMenuVisibilityAction({ expectedRestaurantId: menu.restaurantId, kind, id, isVisible: nextValue }))
  }

  function changeAvailability(item: MenuItemDTO, isAvailable: boolean) {
    const optimistic = (currentMenu: PanelMenuDTO) => withCategories(currentMenu, currentMenu.categories.map((category) => ({
      ...category,
      items: category.items.map((entry) => entry.id === item.id ? { ...entry, isAvailable } : entry),
    })))
    void mutateMenu(optimistic, () => setMenuAvailabilityAction({ expectedRestaurantId: menu.restaurantId, itemId: item.id, isAvailable }))
  }

  function moveItem(item: MenuItemDTO, categoryId: string) {
    if (!categoryId || categoryId === item.categoryId) return
    const optimistic = (currentMenu: PanelMenuDTO) => {
      const movedItem = currentMenu.categories.flatMap((category) => category.items).find((entry) => entry.id === item.id)
      if (!movedItem) return currentMenu
      const without = currentMenu.categories.map((category) => ({ ...category, items: category.items.filter((entry) => entry.id !== item.id) }))
      return withCategories(currentMenu, without.map((category) => category.id === categoryId ? { ...category, items: [...category.items, { ...movedItem, categoryId, position: category.items.length }] } : category))
    }
    void mutateMenu(optimistic, () => moveMenuItemAction({ expectedRestaurantId: menu.restaurantId, itemId: item.id, categoryId }))
  }

  function reorderCategories(categoryId: string, direction: -1 | 1) {
    const oldIndex = menu.categories.findIndex((category) => category.id === categoryId)
    const newIndex = Math.max(0, Math.min(menu.categories.length - 1, oldIndex + direction))
    if (oldIndex < 0 || oldIndex === newIndex) return
    const order = [...menu.categories]
    const [moved] = order.splice(oldIndex, 1)
    order.splice(newIndex, 0, moved)
    const orderedIds = order.map((category) => category.id)
    void mutateMenu((current) => withCategories(current, order), () => reorderMenuCategoriesAction({ expectedRestaurantId: menu.restaurantId, order: orderedIds }))
  }

  function saveItemOrder(categoryId: string, itemIds: string[]) {
    const byId = new Map(menu.categories.find((category) => category.id === categoryId)?.items.map((item) => [item.id, item]) ?? [])
    const orderedItems = itemIds.flatMap((id, position) => byId.has(id) ? [{ ...byId.get(id)!, position }] : [])
    void mutateMenu((current) => withCategories(current, current.categories.map((category) => category.id === categoryId ? { ...category, items: orderedItems } : category)), () => reorderMenuItemsAction({ expectedRestaurantId: menu.restaurantId, categoryId, order: itemIds }))
  }

  function moveItemPosition(item: MenuItemDTO, direction: -1 | 1) {
    const category = menu.categories.find((entry) => entry.id === item.categoryId)
    if (!category) return
    const oldIndex = category.items.findIndex((entry) => entry.id === item.id)
    const newIndex = Math.max(0, Math.min(category.items.length - 1, oldIndex + direction))
    if (oldIndex < 0 || oldIndex === newIndex) return
    const order = [...category.items]
    const [moved] = order.splice(oldIndex, 1)
    order.splice(newIndex, 0, moved)
    saveItemOrder(category.id, order.map((entry) => entry.id))
  }

  async function changePublication() {
    if (operationRef.current) return
    operationRef.current = true
    setPublicationPending(true)
    setFeedback("")
    try {
      const action = menu.status === "published" ? unpublishMenuAction : publishMenuAction
      const result = await action({ expectedRestaurantId: menu.restaurantId })
      if (!result.ok) setFeedback(failureMessage(result.code))
      else { setMenu((current) => ({ ...current, status: result.data.status })); router.refresh() }
    } catch {
      setFeedback("Não foi possível atualizar a publicação. Tente novamente.")
    } finally {
      operationRef.current = false
      setPublicationPending(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || operationRef.current) return
    operationRef.current = true
    const target = deleteTarget
    setPendingOperation(true)
    setFeedback("")
    try {
      const result = target.kind === "item"
        ? await deleteMenuItemAction({ expectedRestaurantId: menu.restaurantId, id: target.value.id })
        : await deleteMenuCategoryAction({ expectedRestaurantId: menu.restaurantId, id: target.value.id })
      if (!result.ok) {
        setFeedback(failureMessage(result.code))
        return
      }
      if (target.kind === "item") {
        setMenu((current) => withCategories(current, current.categories.map((category) => ({ ...category, items: category.items.filter((item) => item.id !== target.value.id) }))))
      } else {
        setMenu((current) => withCategories(current, current.categories.filter((category) => category.id !== target.value.id)))
        if (selectedCategoryId === target.value.id) setSelectedCategoryId(null)
      }
      setDeleteTarget(null)
      router.refresh()
    } catch {
      setFeedback("Não foi possível excluir este registro. Tente novamente.")
    } finally {
      operationRef.current = false
      setPendingOperation(false)
    }
  }

  const hasActiveFilters = Boolean(query.trim()) || filter !== "all"
  const emptyOnNoCategories = menu.categories.length === 0
  const allFilteredCount = allFilteredCategories.reduce((count, category) => count + category.items.length, 0)
  const visibleFilteredCount = categoriesForView.reduce((count, category) => count + category.items.length, 0)
  const motionReduced = prefersReducedMotion === true
  const publicationHint = menu.status === "published"
    ? "As alterações ficam públicas assim que são salvas."
    : "Publique quando houver um item visível com mídia."

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-svh">
        <div className="mx-auto flex w-full max-w-[1480px] flex-col px-4 py-7 sm:px-6 md:py-5 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-5 md:gap-6">
            <motion.header initial={motionReduced ? false : { opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: motionReduced ? 0.12 : 0.22, ease: [0.23, 1, 0.32, 1] }} className="flex flex-col gap-4">
              <PanelPageHeading title="Cardápio" icon={<LuUtensils aria-hidden="true" className="size-4" />} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge variant={menu.status === "published" ? "default" : "secondary"} className="gap-1.5 rounded-full px-3 py-1.5">{menu.status === "published" ? <LuCheck aria-hidden="true" /> : <LuLayers2 aria-hidden="true" />}{menu.status === "published" ? "Publicado" : "Rascunho"}</Badge>
                <Button nativeButton={false} render={<a href={publicUrl} target="_blank" rel="noreferrer" />} variant="outline" size="sm"><LuExternalLink aria-hidden="true" />Ver página</Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-border/70 bg-card px-3 py-2.5"><p className="text-[0.625rem] font-semibold tracking-wide text-muted-foreground uppercase">Categorias</p><p className="mt-0.5 text-lg font-semibold tabular-nums">{menu.counts.categories}</p></div>
                <div className="rounded-xl border border-border/70 bg-card px-3 py-2.5"><p className="text-[0.625rem] font-semibold tracking-wide text-muted-foreground uppercase">Itens</p><p className="mt-0.5 text-lg font-semibold tabular-nums">{menu.counts.items}<span className="ml-1.5 text-xs font-normal text-muted-foreground">· {menu.counts.unavailableItems} esgotados</span></p></div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/[0.045] px-3 py-2.5"><div><p className="text-[0.625rem] font-semibold tracking-wide text-muted-foreground uppercase">Acesso público</p><p className="mt-0.5 text-lg font-semibold tabular-nums">{menu.counts.publicItems}<span className="ml-1.5 text-xs font-normal text-muted-foreground">itens prontos</span></p></div><Button type="button" size="sm" variant={menu.status === "published" ? "outline" : "default"} disabled={publicationPending || pendingOperation || (menu.status === "draft" && menu.counts.publicItems === 0)} onClick={() => void changePublication()}>{publicationPending ? <LuLoaderCircle className="animate-spin" aria-hidden="true" /> : null}{menu.status === "published" ? "Despublicar" : "Publicar"}</Button></div>
              </div>
              <p className="-mt-2 text-xs text-muted-foreground">{publicationHint}</p>
            </motion.header>

            <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:p-3.5">
              <div className="relative min-w-0 flex-1"><LuSearch aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar itens" placeholder="Buscar por nome ou descrição" value={query} onChange={(event) => setQuery(event.target.value)} className="h-9 pl-9" />{query ? <Button type="button" size="icon-xs" variant="ghost" aria-label="Limpar busca" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setQuery("")}><LuX aria-hidden="true" /></Button> : null}</div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="menu-filter">Filtrar itens</label>
                <MenuComboboxField id="menu-filter" ariaLabel="Filtrar itens" value={filter} options={MENU_FILTER_OPTIONS} onValueChange={(value) => setFilter(value as ItemFilter)} icon={<LuListFilter aria-hidden="true" />} placeholder="Todos os itens" className="h-9 min-w-36 sm:w-40" />
                <div className="hidden items-center rounded-lg border border-border/70 bg-muted/40 p-1 md:flex" role="group" aria-label="Visualização do cardápio">
                  <Button type="button" size="sm" variant={view === "index" ? "secondary" : "ghost"} aria-pressed={view === "index"} onClick={() => chooseView("index")}><LuList aria-hidden="true" />Índice</Button>
                  <Button type="button" size="sm" variant={view === "board" ? "secondary" : "ghost"} aria-pressed={view === "board"} onClick={() => chooseView("board")}><LuLayers2 aria-hidden="true" />Quadro</Button>
                </div>
                {view === "index" ? <div className="hidden items-center rounded-lg border border-border/70 bg-muted/40 p-1 md:flex" role="group" aria-label="Formato do índice"><Button type="button" size="icon-sm" variant={layout === "list" ? "secondary" : "ghost"} aria-label="Exibir lista" aria-pressed={layout === "list"} onClick={() => chooseLayout("list")}><LuList aria-hidden="true" /></Button><Button type="button" size="icon-sm" variant={layout === "grid" ? "secondary" : "ghost"} aria-label="Exibir grade" aria-pressed={layout === "grid"} onClick={() => chooseLayout("grid")}><LuGrid2X2 aria-hidden="true" /></Button></div> : null}
              </div>
              <div className="flex gap-2 sm:ml-auto">
                <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={() => { setFeedback(""); setBatchOpen(true) }}><LuPlus aria-hidden="true" />Adicionar vários</Button>
                <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={() => categoryEditor(null)}><LuLayers2 aria-hidden="true" /><span className="hidden lg:inline">Nova categoria</span><span className="lg:hidden">Categoria</span></Button>
                <Button type="button" className="flex-1 sm:flex-none" onClick={() => itemEditor(null)}><LuPlus aria-hidden="true" />Novo item</Button>
              </div>
            </div>

            {feedback ? <Alert variant="destructive"><LuCircleAlert aria-hidden="true" /><AlertTitle>Não foi possível concluir</AlertTitle><AlertDescription>{feedback}</AlertDescription></Alert> : null}

            <div className="flex items-start gap-4">
              {view === "index" ? <MenuIndex categories={menu.categories} selectedCategoryId={selectedCategoryId} expanded={indexExpanded} onExpandedChange={setIndexExpanded} onSelect={setSelectedCategoryId} onReorder={reorderCategories} /> : null}
              <div className="min-w-0 flex-1">
                {emptyOnNoCategories ? <div className="rounded-3xl border border-dashed border-border bg-card px-5 py-12 text-center shadow-sm sm:py-16">
                  <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><LuBookOpenCheck aria-hidden="true" className="size-7" /></span>
                  <h2 className="mt-4 text-lg font-semibold tracking-tight">Seu cardápio começa pelas categorias</h2>
                  <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">Agrupe seus itens como quiser — por momento, tipo de prato ou especialidade.</p>
                  <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row"><Button type="button" onClick={() => categoryEditor(null)}><LuPlus aria-hidden="true" />Criar categoria</Button><Button type="button" variant="outline" onClick={() => setBatchOpen(true)}><LuLayers2 aria-hidden="true" />Adicionar várias categorias e itens</Button></div>
                </div> : (hasActiveFilters && ((view === "index" && selectedCategoryId) ? visibleFilteredCount === 0 : allFilteredCount === 0)) ? <div className="rounded-2xl border border-dashed border-border p-10 text-center"><LuSearch aria-hidden="true" className="mx-auto size-6 text-muted-foreground" /><h2 className="mt-3 font-semibold">Nenhum item encontrado</h2><p className="mt-1 text-sm text-muted-foreground">Tente outro termo ou limpe os filtros.</p><Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => { setQuery(""); setFilter("all"); setSelectedCategoryId(null) }}>Limpar busca e filtros</Button></div> : (
                  <>
                    {view === "board" ? <MenuBoard
                      categories={boardCategories}
                      reorderItemsEnabled={!hasActiveFilters}
                      reducedMotion={motionReduced}
                      onCategoryOrder={(ids) => { const order = ids.flatMap((id) => menu.categories.filter((category) => category.id === id)); void mutateMenu((current) => withCategories(current, order), () => reorderMenuCategoriesAction({ expectedRestaurantId: menu.restaurantId, order: ids })) }}
                      onItemOrder={saveItemOrder}
                      onEditItem={(item) => itemEditor(item)}
                      onDeleteItem={(item) => setDeleteTarget({ kind: "item", value: item })}
                      onItemVisibility={(item) => changeVisibility("item", item.id, item.isVisible)}
                      onAvailability={changeAvailability}
                      onMove={moveItem}
                      onAddItem={(categoryId) => itemEditor(null, categoryId)}
                      onEditCategory={(category) => categoryEditor(category)}
                      onDeleteCategory={(category) => category.items.length ? setFeedback("Mova ou exclua os itens desta categoria antes de excluí-la.") : setDeleteTarget({ kind: "category", value: category })}
                      onCategoryVisibility={(category) => changeVisibility("category", category.id, category.isVisible)}
                      onCategoryPosition={reorderCategories}
                    /> : null}
                    <div className={view === "board" ? "hidden" : "hidden md:block"}>
                      <div className="space-y-3">
                        <AnimatePresence initial={false} mode="popLayout">
                          {categoriesForView.map((category, categoryIndex) => <motion.section key={category.id} id={`menu-category-${category.id}`} initial={motionReduced ? { opacity: 0 } : { opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: motionReduced ? 0 : -4 }} transition={{ duration: motionReduced ? 0.1 : 0.18, delay: motionReduced ? 0 : categoryIndex * 0.025 }} className="scroll-mt-20 rounded-2xl border border-border/70 bg-card p-3 sm:p-4">
                            <header className="mb-3 flex items-center gap-2 border-b border-border/60 pb-2.5">
                              <span className={`size-2 shrink-0 rounded-full ${category.isVisible ? "bg-primary" : "bg-muted-foreground/40"}`} aria-hidden="true" />
                              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-semibold">{category.name}</h2>{!category.isVisible ? <Badge variant="outline" className="h-5">Oculta</Badge> : null}<span className="text-xs text-muted-foreground">{category.items.length} itens</span></div>{category.description ? <p className="mt-1 text-xs text-muted-foreground">{category.description}</p> : null}</div>
                              <Button type="button" size="sm" variant="outline" onClick={() => itemEditor(null, category.id)}><LuPlus aria-hidden="true" />Item</Button>
                              <MenuCategoryActions category={category} onEdit={() => categoryEditor(category)} onDelete={() => category.items.length ? setFeedback("Mova ou exclua os itens desta categoria antes de excluí-la.") : setDeleteTarget({ kind: "category", value: category })} onVisibility={() => changeVisibility("category", category.id, category.isVisible)} />
                            </header>
                            <div className={layout === "grid" ? "grid grid-cols-2 gap-3 xl:grid-cols-3" : "space-y-2.5"}>
                              {category.items.map((item, index) => {
                                const props = {
                                  item,
                                  categories: menu.categories,
                                  onEdit: () => itemEditor(item),
                                  onDelete: () => setDeleteTarget({ kind: "item", value: item }),
                                  onVisibility: () => changeVisibility("item", item.id, item.isVisible),
                                  onAvailability: (value: boolean) => changeAvailability(item, value),
                                  onMove: (categoryId: string) => moveItem(item, categoryId),
                                  ...(hasActiveFilters ? {} : { onMovePosition: (direction: -1 | 1) => moveItemPosition(item, direction) }),
                                  canMoveUp: index > 0,
                                  canMoveDown: index < category.items.length - 1,
                                }
                                return <motion.div
                                  key={item.id}
                                  layout="position"
                                  initial={motionReduced ? false : { opacity: 0, y: 5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: motionReduced ? 0.1 : 0.16, delay: motionReduced ? 0 : Math.min(index * 0.018, 0.16), ease: [0.23, 1, 0.32, 1] }}
                                  className="min-w-0"
                                >{layout === "grid" ? <MenuItemCard {...props} /> : <MenuItemRow {...props} />}</motion.div>
                              })}
                              {layout === "list" && category.items.length === 0 ? <p className="rounded-xl border border-dashed border-border/70 px-4 py-5 text-center text-xs text-muted-foreground">Nenhum item combina com os filtros.</p> : null}
                              {layout === "grid" && category.items.length === 0 ? <p className="col-span-full rounded-xl border border-dashed border-border/70 px-4 py-5 text-center text-xs text-muted-foreground">Nenhum item combina com os filtros.</p> : null}
                            </div>
                          </motion.section>)}
                        </AnimatePresence>
                      </div>
                    </div>
                    <MenuMobileList
                      categories={allFilteredCategories}
                      allCategories={menu.categories}
                      reorderEnabled={!hasActiveFilters}
                      onAddItem={(categoryId) => itemEditor(null, categoryId)}
                      onEditCategory={categoryEditor}
                      onDeleteCategory={(category) => category.items.length ? setFeedback("Mova ou exclua os itens desta categoria antes de excluí-la.") : setDeleteTarget({ kind: "category", value: category })}
                      onCategoryVisibility={(category) => changeVisibility("category", category.id, category.isVisible)}
                      onCategoryPosition={reorderCategories}
                      onItemPosition={moveItemPosition}
                      onEditItem={(item) => itemEditor(item)}
                      onDeleteItem={(item) => setDeleteTarget({ kind: "item", value: item })}
                      onItemVisibility={(item) => changeVisibility("item", item.id, item.isVisible)}
                      onAvailability={changeAvailability}
                      onMove={moveItem}
                    />
                    {view === "board" ? <p className="mt-3 hidden text-center text-xs text-muted-foreground md:block"><LuArrowDown aria-hidden="true" className="mr-1 inline size-3.5" />Arraste cartões para reordenar dentro da categoria. Use o seletor para mover entre categorias.</p> : null}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <MenuCategoryEditor restaurantId={menu.restaurantId} category={editingCategory} open={categoryEditorOpen} onOpenChange={(open) => { setCategoryEditorOpen(open); if (!open) setEditingCategory(null) }} onSaved={() => { setFeedback(""); router.refresh() }} />
      <MenuItemEditor restaurantId={menu.restaurantId} item={editingItem} initialCategoryId={itemEditorCategoryId} categories={menu.categories} attributes={menu.attributes} open={itemEditorOpen} onOpenChange={(open) => { setItemEditorOpen(open); if (!open) { setEditingItem(null); setItemEditorCategoryId(null) } }} onSaved={() => { setFeedback(""); router.refresh() }} />
      <MenuBatchWorkspace restaurantId={menu.restaurantId} categories={menu.categories} attributes={menu.attributes} open={batchOpen} onOpenChange={setBatchOpen} onComplete={() => { setFeedback(""); router.refresh() }} />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !pendingOperation) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteTarget?.kind === "category" ? "Excluir categoria?" : "Excluir item?"}</AlertDialogTitle>
            <AlertDialogDescription>{deleteTarget?.kind === "category" ? `“${deleteTarget.value.name}” será removida. Esta ação não pode ser desfeita.` : `“${deleteTarget?.value.name}” e as mídias associadas serão removidas. Esta ação não pode ser desfeita.`}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingOperation}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={pendingOperation} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(event) => { event.preventDefault(); void confirmDelete() }}>{pendingOperation ? <LuLoaderCircle className="animate-spin" aria-hidden="true" /> : <LuTrash2 aria-hidden="true" />}Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MotionConfig>
  )
}
