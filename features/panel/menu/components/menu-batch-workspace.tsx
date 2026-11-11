"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { LuAlignLeft, LuCheck, LuChevronDown, LuChevronLeft, LuChevronRight, LuCircleAlert, LuCircleDollarSign, LuCirclePlus, LuCloudUpload, LuFolderPlus, LuGripVertical, LuImagePlus, LuLayers2, LuLoaderCircle, LuPlus, LuShieldAlert, LuSparkles, LuTag, LuTags, LuTrash2, LuUpload, LuUtensils, LuVideo } from "react-icons/lu"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { MENU_MAX_ATTRIBUTES_PER_ITEM, MENU_MAX_CATEGORIES_PER_BATCH, MENU_MAX_ITEMS_PER_BATCH, MENU_MAX_MEDIA_PER_ITEM, MENU_MAX_VARIANTS_PER_ITEM, MENU_MEDIA_LIMITS, type MenuAttributeDTO, type MenuAttributeKind, type MenuCategoryDTO } from "../model"
import { MenuComboboxField, MenuIconInput, MenuIconTextarea, MenuPriceInput, type MenuComboboxOption } from "./menu-fields"
import { normalizeMenuPriceInput, parseMenuPriceCents } from "../lib/currency"
import { createMenuAttributeAction, saveMenuBatchAction } from "../actions"
import { batchDraftStore } from "../lib/batch-draft-store"
import type { MenuBatchDraft } from "../lib/batch-draft-schema"
import { discardUploadedMenuMedia, inspectMenuFile, uploadMenuMedia, type UploadedMenuMedia } from "../lib/media-prep"

type BatchCategory = { id: string; name: string; description: string }
type BatchVariant = { id: string; name: string; price: string; isAvailable: boolean }
type BatchAttribute = { id: string; kind: MenuAttributeKind; qualifier: "contains" | "may_contain" | null }
type BatchItem = {
  id: string
  categoryId: string
  name: string
  description: string
  price: string
  pricingMode: "single" | "variants"
  variants: BatchVariant[]
  highlights: string
  attributes: BatchAttribute[]
  files: File[]
}

function newItem(categoryId = ""): BatchItem {
  return { id: crypto.randomUUID(), categoryId, name: "", description: "", price: "", pricingMode: "single", variants: [], highlights: "", attributes: [], files: [] }
}

function parseBatchHighlights(value: string) {
  const seen = new Set<string>()
  return value.split(/[\n,]/).map((entry) => entry.trim()).filter((entry) => {
    const key = entry.normalize("NFC").toLocaleLowerCase("pt-BR")
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function mediaFileIdentity(file: File) {
  return JSON.stringify([file.name, file.size, file.lastModified, file.type])
}

function sortableMediaId(itemId: string, file: File) {
  return `batch-media:${itemId}:${encodeURIComponent(mediaFileIdentity(file))}`
}

const ATTRIBUTE_QUALIFIER_OPTIONS: readonly MenuComboboxOption[] = [
  { value: "contains", label: "Contém" },
  { value: "may_contain", label: "Pode conter" },
]

const ATTRIBUTE_KIND_OPTIONS: readonly MenuComboboxOption[] = [
  { value: "diet", label: "Dieta" },
  { value: "allergen", label: "Alergênico" },
]

function SortableBatchMedia({
  itemId,
  file,
  index,
  itemCount,
  disabled,
  onRemove,
  onMove,
}: {
  itemId: string
  file: File
  index: number
  itemCount: number
  disabled: boolean
  onRemove: () => void
  onMove: (direction: -1 | 1) => void
}) {
  const id = sortableMediaId(itemId, file)
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  const [previewUrl, setPreviewUrl] = useState("")

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return <div
    ref={setNodeRef}
    style={{ transform: CSS.Transform.toString(transform) ?? undefined, transition: transition ?? undefined }}
    title={file.name}
    className={`group relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted shadow-sm ${isDragging ? "z-20 scale-[1.02] border-primary/60 opacity-70 shadow-xl" : "border-border/70"}`}
  >
    {previewUrl ? file.type.startsWith("video/")
      ? <video src={previewUrl} className="size-full object-cover" muted playsInline preload="metadata" />
      : <img src={previewUrl} alt={file.name} className="size-full object-cover" />
      : <div className="flex size-full items-center justify-center"><LuImagePlus className="size-6 animate-pulse text-muted-foreground" aria-hidden="true" /></div>}
    <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-1.5">
      <button ref={setActivatorNodeRef} type="button" {...attributes} {...listeners} aria-label={`Arraste para reordenar ${file.name}, posição ${index + 1}`} className="flex size-11 touch-none items-center justify-center rounded-lg bg-black/60 text-white shadow-sm backdrop-blur transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
        <LuGripVertical aria-hidden="true" />
      </button>
      <Button type="button" size="icon" variant="destructive" className="size-11 rounded-lg" disabled={disabled} aria-label={`Remover ${file.name}`} onClick={onRemove}><LuTrash2 aria-hidden="true" /></Button>
    </div>
    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1.5 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-1.5 pb-1.5 pt-6 text-white">
      <span className="min-w-0 truncate pl-0.5 text-[0.625rem] font-medium">{index === 0 ? "Capa" : `Mídia ${index + 1} de ${itemCount}`}{file.type.startsWith("video/") ? <LuVideo className="ml-1 inline size-3.5 align-[-2px]" aria-hidden="true" /> : null}</span>
      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" size="icon" variant="ghost" className="size-11 rounded-lg bg-black/55 text-white hover:bg-black/80 hover:text-white" disabled={disabled || index === 0} aria-label={`Mover ${file.name} uma posição para trás`} onClick={() => onMove(-1)}><LuChevronLeft aria-hidden="true" /></Button>
        <Button type="button" size="icon" variant="ghost" className="size-11 rounded-lg bg-black/55 text-white hover:bg-black/80 hover:text-white" disabled={disabled || index === itemCount - 1} aria-label={`Mover ${file.name} uma posição para frente`} onClick={() => onMove(1)}><LuChevronRight aria-hidden="true" /></Button>
      </div>
    </div>
  </div>
}

function draftFrom(value: MenuBatchDraft) {
  return { categories: value.categories, items: value.items }
}

export function MenuBatchWorkspace({
  restaurantId,
  categories: existingCategories,
  attributes: menuAttributes,
  open,
  onOpenChange,
  onComplete,
}: {
  restaurantId: string
  categories: MenuCategoryDTO[]
  attributes: MenuAttributeDTO[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}) {
  const router = useRouter()
  const firstCategoryId = existingCategories[0]?.id ?? ""
  const reduceMotion = useReducedMotion()
  const mediaSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const [categories, setCategories] = useState<BatchCategory[]>([])
  const [items, setItems] = useState<BatchItem[]>([newItem(firstCategoryId)])
  const [restoreDraft, setRestoreDraft] = useState<MenuBatchDraft | null>(null)
  const [restoreHandled, setRestoreHandled] = useState(false)
  const [storageError, setStorageError] = useState("")
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [draggingMediaItemId, setDraggingMediaItemId] = useState<string | null>(null)
  const [mediaAnnouncement, setMediaAnnouncement] = useState("")
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(() => new Set())
  const [attributeCatalog, setAttributeCatalog] = useState(menuAttributes)
  const [newAttributeKind, setNewAttributeKind] = useState<MenuAttributeKind>("diet")
  const [newAttributeLabel, setNewAttributeLabel] = useState("")
  const [creatingAttribute, setCreatingAttribute] = useState(false)
  const [attributeError, setAttributeError] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [committedDraft, setCommittedDraft] = useState(false)
  const allCategories = useMemo(() => [
    ...existingCategories.map(({ id, name }) => ({ id, name, isNew: false as const })),
    ...categories.map(({ id, name }) => ({ id, name, isNew: true as const })),
  ], [categories, existingCategories])
  const categoryOptions = useMemo<MenuComboboxOption[]>(() => allCategories.map((category) => ({
    value: category.id,
    label: category.name || "Categoria sem nome",
    badge: category.isNew ? "Nova" : undefined,
  })), [allCategories])
  const dietAttributes = useMemo(() => attributeCatalog.filter((attribute) => attribute.kind === "diet"), [attributeCatalog])
  const allergenAttributes = useMemo(() => attributeCatalog.filter((attribute) => attribute.kind === "allergen"), [attributeCatalog])
  const itemsWithMedia = items.filter((item) => item.files.length > 0).length
  const selectedFiles = items.reduce((total, item) => total + item.files.length, 0)

  useEffect(() => {
    if (!open) return
    let active = true
    setCategories([])
    setItems([newItem(firstCategoryId)])
    setExpandedDetails(new Set())
    setRestoreHandled(false)
    setStorageError("")
    setError("")
    setCommittedDraft(false)
    batchDraftStore.load(restaurantId).then((draft) => {
      if (!active) return
      setRestoreDraft(draft)
      if (!draft) setRestoreHandled(true)
    }).catch(() => {
      if (!active) return
      setRestoreHandled(true)
      setStorageError("O navegador não conseguiu ler o rascunho salvo. Seu formulário atual continuará disponível enquanto esta janela ficar aberta.")
    })
    return () => { active = false }
  }, [firstCategoryId, open, restaurantId])

  useEffect(() => setAttributeCatalog(menuAttributes), [menuAttributes])

  useEffect(() => {
    if (!open || !restoreHandled || saving || committedDraft) return
    const timer = window.setTimeout(() => {
      batchDraftStore.save({ restaurantId, categories, items }).then(() => setStorageError("")).catch(() => {
        setStorageError("Não foi possível salvar o rascunho local. O conteúdo continua neste formulário enquanto ele estiver aberto.")
      })
    }, 550)
    return () => window.clearTimeout(timer)
  }, [categories, items, open, restaurantId, restoreHandled, saving, committedDraft])

  function resumeDraft() {
    if (!restoreDraft) return
    const restored = draftFrom(restoreDraft)
    setCategories(restored.categories)
    setItems(restored.items.map((item) => ({
      ...item,
      price: normalizeMenuPriceInput(item.price),
      variants: item.variants.map((variant) => ({ ...variant, price: normalizeMenuPriceInput(variant.price) })),
    })))
    setExpandedDetails(new Set(restored.items.filter((item) => item.description || item.highlights || item.attributes.length).map((item) => item.id)))
    setRestoreDraft(null)
    setRestoreHandled(true)
  }

  async function discardDraft() {
    try {
      await batchDraftStore.remove(restaurantId)
      setRestoreDraft(null)
      setRestoreHandled(true)
      setStorageError("")
    } catch {
      setStorageError("Não foi possível apagar o rascunho local. Tente novamente antes de continuar.")
    }
  }

  async function requestClose(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(true)
      return
    }
    if (saving || committedDraft || !restoreHandled) return
    try {
      await batchDraftStore.save({ restaurantId, categories, items })
      setStorageError("")
      onOpenChange(false)
    } catch {
      setStorageError("Não foi possível salvar o rascunho local. Mantenha a janela aberta ou escolha fechar sem salvar.")
    }
  }

  function addCategory() {
    if (categories.length >= MENU_MAX_CATEGORIES_PER_BATCH) return
    const category = { id: crypto.randomUUID(), name: "", description: "" }
    setCategories((current) => [...current, category])
    setItems((current) => current.map((item) => item.categoryId ? item : { ...item, categoryId: category.id }))
  }

  function addItem() {
    if (items.length >= MENU_MAX_ITEMS_PER_BATCH) return
    setItems((current) => [...current, newItem(allCategories[0]?.id ?? "")])
  }

  function changePricingMode(itemId: string, pricingMode: BatchItem["pricingMode"]) {
    const initialVariant = pricingMode === "variants"
      ? { id: crypto.randomUUID(), name: "", price: "", isAvailable: true }
      : null
    setItems((current) => current.map((item) => item.id !== itemId ? item : {
      ...item,
      pricingMode,
      variants: pricingMode === "variants" && item.variants.length === 0 && initialVariant !== null
        ? [initialVariant]
        : item.variants,
    }))
  }

  function addVariant(itemId: string) {
    const variant: BatchVariant = { id: crypto.randomUUID(), name: "", price: "", isAvailable: true }
    setItems((current) => current.map((item) => item.id !== itemId || item.variants.length >= MENU_MAX_VARIANTS_PER_ITEM
      ? item
      : { ...item, variants: [...item.variants, variant] }))
  }

  function updateVariant(itemId: string, variantId: string, update: Partial<Omit<BatchVariant, "id">>) {
    setItems((current) => current.map((item) => item.id !== itemId ? item : {
      ...item,
      variants: item.variants.map((variant) => variant.id === variantId ? { ...variant, ...update } : variant),
    }))
  }

  function removeVariant(itemId: string, variantId: string) {
    setItems((current) => current.map((item) => item.id !== itemId ? item : {
      ...item,
      variants: item.variants.filter((variant) => variant.id !== variantId),
    }))
  }

  function toggleDetails(itemId: string) {
    setExpandedDetails((current) => {
      const next = new Set(current)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  function toggleAttribute(itemId: string, attribute: MenuAttributeDTO, checked: boolean) {
    setItems((current) => current.map((item) => {
      if (item.id !== itemId) return item
      const currentAttribute = item.attributes.find((entry) => entry.id === attribute.id)
      if (checked && !currentAttribute) {
        const next = [...item.attributes, {
          id: attribute.id,
          kind: attribute.kind,
          qualifier: attribute.kind === "allergen" ? "contains" as const : null,
        }]
        return { ...item, attributes: next.slice(0, MENU_MAX_ATTRIBUTES_PER_ITEM) }
      }
      if (!checked && currentAttribute) return { ...item, attributes: item.attributes.filter((entry) => entry.id !== attribute.id) }
      return item
    }))
  }

  function setAttributeQualifier(itemId: string, attributeId: string, qualifier: "contains" | "may_contain") {
    setItems((current) => current.map((item) => item.id !== itemId ? item : {
      ...item,
      attributes: item.attributes.map((attribute) => attribute.id === attributeId ? { ...attribute, qualifier } : attribute),
    }))
  }

  async function createAttribute() {
    const label = newAttributeLabel.trim()
    if (label.length < 2 || creatingAttribute) return
    setCreatingAttribute(true)
    setAttributeError("")
    try {
      const result = await createMenuAttributeAction({ expectedRestaurantId: restaurantId, kind: newAttributeKind, label })
      if (!result.ok) {
        setAttributeError("Não foi possível criar o atributo. Confira o nome e tente novamente.")
        return
      }
      setAttributeCatalog((current) => current.some((attribute) => attribute.id === result.data.attributeId)
        ? current
        : [...current, { id: result.data.attributeId, kind: newAttributeKind, label, isSystem: false }])
      setNewAttributeLabel("")
      router.refresh()
    } catch {
      setAttributeError("Não foi possível criar o atributo. Tente novamente.")
    } finally {
      setCreatingAttribute(false)
    }
  }

  function addFiles(itemId: string, files: FileList | readonly File[]) {
    if (saving) return
    const target = items.find((item) => item.id === itemId)
    if (!target || !files.length) return
    const existing = new Set(target.files.map(mediaFileIdentity))
    const uniqueFiles = Array.from(files).filter((file) => {
      const identity = mediaFileIdentity(file)
      if (existing.has(identity)) return false
      existing.add(identity)
      return true
    })
    const remaining = Math.max(0, MENU_MAX_MEDIA_PER_ITEM - target.files.length)
    const accepted = uniqueFiles.slice(0, remaining)
    if (accepted.length) {
      setItems((current) => current.map((item) => item.id === itemId ? { ...item, files: [...item.files, ...accepted] } : item))
    }
    if (uniqueFiles.length > remaining) {
      setRowErrors((current) => ({ ...current, [itemId]: `Cada item aceita até ${MENU_MAX_MEDIA_PER_ITEM} mídias; os arquivos excedentes não foram adicionados.` }))
    }
  }

  function removeFile(itemId: string, file: File) {
    const identity = mediaFileIdentity(file)
    setItems((current) => current.map((item) => item.id === itemId
      ? { ...item, files: item.files.filter((candidate) => mediaFileIdentity(candidate) !== identity) }
      : item))
  }

  function reorderFiles(itemId: string, event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return
    const activeId = String(event.active.id)
    const overId = String(event.over.id)
    setItems((current) => current.map((item) => {
      if (item.id !== itemId) return item
      const oldIndex = item.files.findIndex((file) => sortableMediaId(itemId, file) === activeId)
      const newIndex = item.files.findIndex((file) => sortableMediaId(itemId, file) === overId)
      return oldIndex < 0 || newIndex < 0 ? item : { ...item, files: arrayMove(item.files, oldIndex, newIndex) }
    }))
  }

  function moveFile(itemId: string, index: number, direction: -1 | 1) {
    const item = items.find((entry) => entry.id === itemId)
    const nextIndex = index + direction
    if (!item || nextIndex < 0 || nextIndex >= item.files.length) return
    setMediaAnnouncement(`Mídia ${item.files[index].name} movida para a posição ${nextIndex + 1} de ${item.files.length}.`)
    setItems((current) => current.map((item) => {
      if (item.id !== itemId) return item
      return { ...item, files: arrayMove(item.files, index, nextIndex) }
    }))
  }

  function validate(): boolean {
    const nextRowErrors: Record<string, string> = {}
    const categoryNames = new Set<string>()
    categories.forEach((category) => {
      const key = category.name.trim().toLocaleLowerCase("pt-BR")
      if (key && categoryNames.has(key)) nextRowErrors[`category:${category.id}`] = "Já existe uma categoria com este nome neste lote."
      if (key) categoryNames.add(key)
      if (key.length < 2) nextRowErrors[`category:${category.id}`] = "Informe ao menos 2 caracteres."
    })
    const itemNames = new Set<string>()
    items.forEach((item) => {
      const key = `${item.categoryId}:${item.name.trim().toLocaleLowerCase("pt-BR")}`
      const highlights = parseBatchHighlights(item.highlights)
      if (!item.categoryId || !allCategories.some((category) => category.id === item.categoryId)) nextRowErrors[item.id] = "Escolha uma categoria."
      else if (item.name.trim().length < 2) nextRowErrors[item.id] = "Informe o nome do item."
      else if (item.name.trim().length > 120 || item.description.trim().length > 600) nextRowErrors[item.id] = "Revise os limites de nome e descrição."
      else if (itemNames.has(key)) nextRowErrors[item.id] = "Nome repetido nesta categoria."
      else if (item.pricingMode === "single" && parseMenuPriceCents(item.price) === null) nextRowErrors[item.id] = "Informe um preço válido, por exemplo 24,90 (máximo R$ 999.999,99)."
      else if (item.pricingMode === "variants" && (item.variants.length < 1 || item.variants.length > MENU_MAX_VARIANTS_PER_ITEM)) nextRowErrors[item.id] = `Adicione de 1 a ${MENU_MAX_VARIANTS_PER_ITEM} variações.`
      else if (item.pricingMode === "variants" && item.variants.some((variant) => !variant.name.trim() || variant.name.trim().length > 60 || parseMenuPriceCents(variant.price) === null)) nextRowErrors[item.id] = "Cada variação precisa de um nome de até 60 caracteres e preço válido."
      else if (item.pricingMode === "variants" && new Set(item.variants.map((variant) => variant.name.trim().normalize("NFC").toLocaleLowerCase("pt-BR"))).size !== item.variants.length) nextRowErrors[item.id] = "Use nomes diferentes para as variações deste item."
      else if (highlights.length > 10 || highlights.some((highlight) => highlight.length > 30)) nextRowErrors[item.id] = "Use até 10 destaques, com no máximo 30 caracteres cada."
      else if (item.attributes.length > MENU_MAX_ATTRIBUTES_PER_ITEM) nextRowErrors[item.id] = `Cada item aceita até ${MENU_MAX_ATTRIBUTES_PER_ITEM} atributos.`
      else if (item.files.length < 1) nextRowErrors[item.id] = "Adicione pelo menos uma foto ou vídeo a este item."
      itemNames.add(key)
      if (item.files.length > MENU_MAX_MEDIA_PER_ITEM) nextRowErrors[item.id] ??= "Cada item pode ter até 6 mídias."
    })
    setRowErrors(nextRowErrors)
    return Object.keys(nextRowErrors).length === 0
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    if (committedDraft) return
    if (!validate()) {
      setError("Revise os campos destacados antes de salvar.")
      return
    }
    setSaving(true)
    const uploaded: UploadedMenuMedia[] = []
    const rowMedia = new Map<string, { index: number; media: UploadedMenuMedia }[]>()
    const queue = items.flatMap((item) => item.files.map((file, index) => ({ item, file, index })))
    setProgress({ done: 0, total: queue.length })
    let cursor = 0
    let uploadError: unknown = null
    const worker = async () => {
      while (cursor < queue.length && !uploadError) {
        const current = queue[cursor++]
        let selected: Awaited<ReturnType<typeof inspectMenuFile>> | null = null
        try {
          selected = await inspectMenuFile(current.file)
          const media = await uploadMenuMedia({
            expectedRestaurantId: restaurantId,
            itemId: current.item.id,
            selected,
            onProgress: () => undefined,
          })
          uploaded.push(media)
          rowMedia.set(current.item.id, [...(rowMedia.get(current.item.id) ?? []), { index: current.index, media }])
          setProgress((value) => ({ ...value, done: value.done + 1 }))
        } catch (cause) {
          uploadError = cause
          setRowErrors((errors) => ({
            ...errors,
            [current.item.id]: cause instanceof Error ? cause.message : "Não foi possível preparar esta mídia.",
          }))
        } finally {
          if (selected) URL.revokeObjectURL(selected.previewUrl)
        }
      }
    }

    try {
      try {
        await batchDraftStore.save({ restaurantId, categories, items })
        setStorageError("")
      } catch {
        setStorageError("O navegador não conseguiu atualizar o rascunho local. O cadastro continua nesta janela.")
      }
      await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker))
      if (uploadError) throw uploadError
      const payload = {
        expectedRestaurantId: restaurantId,
        categories: categories.map((category) => ({ ...category, isVisible: true })),
        items: items.map((item) => ({
          id: item.id,
          categoryId: item.categoryId,
          name: item.name,
          description: item.description,
          isVisible: true,
          isAvailable: true,
          pricing: item.pricingMode === "single"
            ? { mode: "single", basePriceCents: parseMenuPriceCents(item.price) as number }
            : { mode: "variants", variants: item.variants.map((variant) => ({
              id: variant.id,
              name: variant.name.trim(),
              priceCents: parseMenuPriceCents(variant.price) as number,
              isAvailable: variant.isAvailable,
            })) },
          highlights: parseBatchHighlights(item.highlights),
          attributes: item.attributes,
          media: (rowMedia.get(item.id) ?? []).sort((left, right) => left.index - right.index).map(({ media: entry }, position) => {
            const { cleanup: _cleanup, url: _url, posterUrl: _posterUrl, ...metadata } = entry
            return { ...metadata, position }
          }),
        })),
      }
      const result = await saveMenuBatchAction(payload)
      if (!result.ok) {
        await discardUploadedMenuMedia(restaurantId, uploaded)
        if (result.code === "batch_already_saved") {
          setCommittedDraft(true)
          setError("Encontramos itens com os mesmos identificadores. O envio anterior pode ter sido concluído; feche esta cópia local para conferir o cardápio atualizado antes de criar outro lote.")
          onComplete()
          return
        }
        setError(result.code === "published_menu_empty"
          ? "O lote deixaria o cardápio publicado sem itens públicos. Adicione mídia a um item visível ou despublique primeiro."
          : "Não foi possível salvar o lote. Os dados continuam no formulário; revise as linhas e tente novamente.")
        return
      }
      try {
        await batchDraftStore.remove(restaurantId)
        onOpenChange(false)
        onComplete()
      } catch {
        setCommittedDraft(true)
        setError("O lote foi salvo, mas o rascunho local não foi removido. Descarte a cópia local para evitar enviá-lo de novo.")
      }
    } catch (cause) {
      await discardUploadedMenuMedia(restaurantId, uploaded)
      setError(cause instanceof Error ? cause.message : "Não foi possível completar o envio. O rascunho foi mantido.")
    } finally {
      setSaving(false)
    }
  }

  async function discardCommittedCopy() {
    try {
      await batchDraftStore.remove(restaurantId)
      setCommittedDraft(false)
      onOpenChange(false)
      onComplete()
    } catch {
      setStorageError("Não foi possível remover a cópia local. Tente novamente.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { void requestClose(value) }}>
      <DialogContent showCloseButton={!saving} className="fixed left-0 top-0 right-0 bottom-0 h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none p-0 sm:max-w-none">
        <div className="flex h-full min-h-0 flex-col bg-background">
          <header className="shrink-0 border-b border-border/70 bg-gradient-to-br from-primary/[0.08] via-card to-card px-4 pb-4 pt-5 sm:px-7 sm:pb-5">
            <DialogHeader className="mx-auto w-full max-w-6xl">
              <div className="flex items-start gap-3">
                <span className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><LuCirclePlus aria-hidden="true" /></span>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><DialogTitle className="text-lg sm:text-xl">Cadastro em lote</DialogTitle><Badge variant="secondary">{items.length} / {MENU_MAX_ITEMS_PER_BATCH} itens</Badge></div><DialogDescription className="mt-1 max-w-2xl">Cadastre itens completos em uma única tela, incluindo destaques e atributos. Cada item precisa de pelo menos uma mídia.</DialogDescription></div>
              </div>
            </DialogHeader>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-7 sm:py-6">
            <div className="mx-auto w-full max-w-6xl space-y-4 pb-24">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-border/70 bg-card px-3 py-2.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{items.length} {items.length === 1 ? "item" : "itens"}</span>
                <span>{categories.length} {categories.length === 1 ? "categoria nova" : "categorias novas"}</span>
                <span>{selectedFiles} {selectedFiles === 1 ? "mídia selecionada" : "mídias selecionadas"}</span>
                {items.length - itemsWithMedia > 0 ? <span className="font-medium text-destructive">{items.length - itemsWithMedia} {items.length - itemsWithMedia === 1 ? "item sem mídia" : "itens sem mídia"} · mídia obrigatória antes de salvar.</span> : <span className="text-primary">Todas as linhas têm mídia.</span>}
              </div>
              {!restoreHandled ? <div className="fixed inset-0 z-[60] grid place-items-center bg-background/80 p-4 backdrop-blur-sm">
                <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
                  {restoreDraft ? <>
                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><LuUpload aria-hidden="true" /></span>
                    <h2 className="mt-3 text-base font-semibold">Rascunho de lote encontrado</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">Salvo neste navegador em {new Date(restoreDraft.updatedAt).toLocaleString("pt-BR")}. {restoreDraft.items.length} itens e {restoreDraft.categories.length} categorias.</p>
                    <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => void discardDraft()}>Descartar rascunho</Button><Button type="button" onClick={resumeDraft}>Continuar de onde parou</Button></div>
                  </> : <div className="flex items-center gap-3"><LuLoaderCircle className="size-5 animate-spin text-primary" aria-hidden="true" /><div><h2 className="text-sm font-semibold">Verificando rascunho salvo</h2><p className="mt-1 text-xs text-muted-foreground">O formulário ficará pronto em instantes.</p></div></div>}
                </div>
              </div> : null}
              {storageError ? <Alert variant="destructive"><LuCircleAlert aria-hidden="true" /><AlertTitle>Rascunho local indisponível</AlertTitle><AlertDescription>{storageError}</AlertDescription></Alert> : null}
              {categories.length ? <section className="rounded-2xl border border-border/70 bg-card p-3.5 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">Categorias novas</h2><p className="text-xs text-muted-foreground">Até {MENU_MAX_CATEGORIES_PER_BATCH} por lote; também pode usar uma existente.</p></div><Button type="button" size="sm" variant="outline" disabled={categories.length >= MENU_MAX_CATEGORIES_PER_BATCH} onClick={addCategory}><LuFolderPlus aria-hidden="true" />Nova categoria</Button></div>
                <div className="space-y-2">{categories.map((category, index) => <div key={category.id} className="grid gap-2 rounded-xl bg-muted/35 p-2 sm:grid-cols-[minmax(180px,0.7fr)_minmax(0,1fr)_36px]">
                  <div className="space-y-1"><Label htmlFor={`batch-category-${category.id}`}>Categoria {index + 1}</Label><MenuIconInput id={`batch-category-${category.id}`} icon={<LuFolderPlus aria-hidden="true" />} maxLength={80} aria-invalid={Boolean(rowErrors[`category:${category.id}`])} value={category.name} onValueChange={(value) => setCategories((current) => current.map((entry) => entry.id === category.id ? { ...entry, name: value } : entry))} placeholder="Ex.: Pratos principais" /></div>
                  <div className="space-y-1"><Label htmlFor={`batch-category-description-${category.id}`}>Descrição <span className="font-normal text-muted-foreground">(opcional)</span></Label><MenuIconInput id={`batch-category-description-${category.id}`} icon={<LuAlignLeft aria-hidden="true" />} maxLength={300} value={category.description} onValueChange={(value) => setCategories((current) => current.map((entry) => entry.id === category.id ? { ...entry, description: value } : entry))} placeholder="Breve apresentação da categoria" /></div>
                  <div className="flex items-end justify-end"><Button type="button" size="icon" variant="ghost" aria-label={`Remover categoria ${category.name || index + 1}`} onClick={() => { const fallback = categories.find((entry) => entry.id !== category.id)?.id ?? firstCategoryId; setCategories((current) => current.filter((entry) => entry.id !== category.id)); setItems((current) => current.map((item) => item.categoryId === category.id ? { ...item, categoryId: fallback } : item)) }}><LuTrash2 aria-hidden="true" /></Button></div>
                  {rowErrors[`category:${category.id}`] ? <p className="text-xs text-destructive sm:col-span-3">{rowErrors[`category:${category.id}`]}</p> : null}
                </div>)}</div>
              </section> : <Button type="button" variant="outline" onClick={addCategory}><LuFolderPlus aria-hidden="true" />Criar categoria neste lote</Button>}

              <details className="rounded-xl border border-border/70 bg-card px-3 py-2.5">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium"><LuTags className="size-4 text-primary" aria-hidden="true" />Criar atributo personalizado para este restaurante<span className="ml-auto text-[0.6875rem] font-normal text-muted-foreground">{attributeCatalog.length} disponíveis</span><LuChevronDown className="size-4 text-muted-foreground" aria-hidden="true" /></summary>
                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(150px,0.32fr)_minmax(0,1fr)_auto]">
                  <MenuComboboxField id="batch-new-attribute-kind" ariaLabel="Tipo do atributo personalizado" value={newAttributeKind} options={ATTRIBUTE_KIND_OPTIONS} onValueChange={(value) => setNewAttributeKind(value as MenuAttributeKind)} icon={<LuTags aria-hidden="true" />} placeholder="Tipo" />
                  <MenuIconInput aria-label="Nome do atributo personalizado" icon={<LuTag aria-hidden="true" />} maxLength={40} value={newAttributeLabel} onValueChange={setNewAttributeLabel} placeholder="Ex.: Produção local" />
                  <Button type="button" variant="outline" disabled={creatingAttribute || newAttributeLabel.trim().length < 2} onClick={() => void createAttribute()}>{creatingAttribute ? <LuLoaderCircle className="animate-spin" aria-hidden="true" /> : <LuPlus aria-hidden="true" />}Criar atributo</Button>
                </div>
                {attributeError ? <p role="alert" className="mt-2 text-xs text-destructive">{attributeError}</p> : null}
              </details>

              <form id="menu-batch-form" onSubmit={submit} className="space-y-3">
                {items.map((item, index) => <section key={item.id} className="rounded-2xl border border-border/70 bg-card shadow-sm">
                  <header className="flex items-center justify-between border-b border-border/60 px-3 py-2.5 sm:px-4"><div className="flex items-center gap-2"><span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-[0.6875rem] font-semibold text-primary">{index + 1}</span><h2 className="text-xs font-semibold">Novo item</h2></div>{items.length > 1 ? <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remover item ${index + 1}`} onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}><LuTrash2 aria-hidden="true" /></Button> : null}</header>
                  <div className="grid gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.82fr)]">
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1"><Label htmlFor={`batch-name-${item.id}`}>Nome do item</Label><MenuIconInput id={`batch-name-${item.id}`} icon={<LuUtensils aria-hidden="true" />} maxLength={120} aria-invalid={Boolean(rowErrors[item.id])} value={item.name} onValueChange={(value) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, name: value } : entry))} placeholder="Ex.: Risoto de cogumelos" /></div>
                        <div className="space-y-1"><Label htmlFor={`batch-category-select-${item.id}`}>Categoria</Label><MenuComboboxField id={`batch-category-select-${item.id}`} value={item.categoryId} options={categoryOptions} onValueChange={(value) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, categoryId: value } : entry))} icon={<LuLayers2 aria-hidden="true" />} placeholder="Escolha uma categoria" emptyMessage="Crie ou adicione uma categoria para continuar." /></div>
                      </div>
                      <div className="space-y-2 rounded-xl border border-border/70 bg-card p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="space-y-0.5"><p className="text-sm font-medium">Preço</p><p className="text-xs text-muted-foreground">Escolha um preço ou ofereça tamanhos e opções.</p></div>
                          <div role="group" aria-label={`Tipo de preço para ${item.name || `item ${index + 1}`}`} className="inline-flex rounded-lg border border-border/70 bg-muted/40 p-1">
                            <Button type="button" size="sm" variant={item.pricingMode === "single" ? "secondary" : "ghost"} aria-pressed={item.pricingMode === "single"} onClick={() => changePricingMode(item.id, "single")}><LuCircleDollarSign aria-hidden="true" />Preço único</Button>
                            <Button type="button" size="sm" variant={item.pricingMode === "variants" ? "secondary" : "ghost"} aria-pressed={item.pricingMode === "variants"} onClick={() => changePricingMode(item.id, "variants")}><LuLayers2 aria-hidden="true" />Variações</Button>
                          </div>
                        </div>
                        <AnimatePresence mode="wait" initial={false}>
                          {item.pricingMode === "single" ? (
                            <motion.div key="single-price" initial={reduceMotion ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: reduceMotion ? 0 : 0.16 }} className="max-w-xs">
                              <MenuPriceInput id={`batch-price-${item.id}`} aria-label="Preço do item em reais" aria-invalid={Boolean(rowErrors[item.id])} value={item.price} onValueChange={(value) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, price: value } : entry))} />
                            </motion.div>
                          ) : (
                            <motion.div key="variant-prices" initial={reduceMotion ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: reduceMotion ? 0 : 0.16 }} className="space-y-2">
                              <AnimatePresence initial={false}>
                                {item.variants.map((variant, variantIndex) => <motion.div key={variant.id} layout={!reduceMotion} initial={reduceMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: reduceMotion ? 0 : 0.16, delay: reduceMotion ? 0 : Math.min(variantIndex * 0.035, 0.14) }} className="rounded-xl border border-border/70 bg-muted/20 p-2.5">
                                  <div className="mb-2 text-xs font-medium text-muted-foreground">Variação {variantIndex + 1}</div>
                                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(145px,0.55fr)_auto]">
                                    <MenuIconInput aria-label={`Nome da variação ${variantIndex + 1}`} icon={<LuTag aria-hidden="true" />} maxLength={60} value={variant.name} onValueChange={(value) => updateVariant(item.id, variant.id, { name: value })} placeholder="Ex.: Individual" />
                                    <MenuPriceInput aria-label={`Preço da variação ${variantIndex + 1}`} value={variant.price} onValueChange={(value) => updateVariant(item.id, variant.id, { price: value })} />
                                    <div className="flex min-h-9 items-center justify-between gap-3 border-t border-border/60 pt-2 sm:border-0 sm:pt-0">
                                      <span className="text-xs text-muted-foreground">{variant.isAvailable ? "Disponível" : "Indisponível"}</span>
                                      <Switch checked={variant.isAvailable} aria-label={`${variant.name || `Variação ${variantIndex + 1}`} disponível`} onCheckedChange={(isAvailable) => updateVariant(item.id, variant.id, { isAvailable })} />
                                      <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remover variação ${variant.name || variantIndex + 1}`} onClick={() => removeVariant(item.id, variant.id)}><LuTrash2 aria-hidden="true" /></Button>
                                    </div>
                                  </div>
                                </motion.div>)}
                              </AnimatePresence>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs text-muted-foreground">{item.variants.length} / {MENU_MAX_VARIANTS_PER_ITEM} variações</p>
                                <Button type="button" size="sm" variant="outline" disabled={item.variants.length >= MENU_MAX_VARIANTS_PER_ITEM} onClick={() => addVariant(item.id)}><LuPlus aria-hidden="true" />Adicionar variação</Button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <section className="min-w-0 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] via-card to-card p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2"><Label htmlFor={`batch-media-${item.id}`} className="text-sm font-semibold">Mídia do item</Label><Badge variant="secondary">Obrigatória</Badge></div>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">Adicione de 1 a {MENU_MAX_MEDIA_PER_ITEM} fotos ou vídeos para salvar este item.</p>
                        </div>
                        <Badge variant={item.files.length ? "outline" : "destructive"} className="shrink-0 tabular-nums">{item.files.length} / {MENU_MAX_MEDIA_PER_ITEM}</Badge>
                      </div>
                      <DndContext sensors={mediaSensors} collisionDetection={closestCenter} onDragEnd={(event) => reorderFiles(item.id, event)}>
                        <SortableContext items={item.files.map((file) => sortableMediaId(item.id, file))} strategy={rectSortingStrategy}>
                          {item.files.length ? <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-3">
                            {item.files.map((file, fileIndex) => <SortableBatchMedia key={sortableMediaId(item.id, file)} itemId={item.id} file={file} index={fileIndex} itemCount={item.files.length} disabled={saving} onRemove={() => removeFile(item.id, file)} onMove={(direction) => moveFile(item.id, fileIndex, direction)} />)}
                          </div> : <div className="mt-3 flex min-h-28 flex-col items-center justify-center rounded-xl border border-dashed border-primary/35 bg-background/65 px-4 py-5 text-center">
                            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><LuImagePlus aria-hidden="true" /></span>
                            <p className="mt-2 text-sm font-medium">Nenhuma mídia adicionada</p>
                            <p className="mt-1 text-xs text-muted-foreground">A primeira foto ou vídeo é necessária para salvar.</p>
                          </div>}
                        </SortableContext>
                      </DndContext>
                      <p className="sr-only" role="status" aria-live="polite">{mediaAnnouncement}</p>
                      <div
                        onDragEnter={(event) => { if (!Array.from(event.dataTransfer.types).includes("Files")) return; event.preventDefault(); if (!saving) setDraggingMediaItemId(item.id) }}
                        onDragOver={(event) => { if (Array.from(event.dataTransfer.types).includes("Files")) event.preventDefault() }}
                        onDragLeave={(event) => { if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return; setDraggingMediaItemId(null) }}
                        onDrop={(event) => { event.preventDefault(); setDraggingMediaItemId(null); if (!saving) addFiles(item.id, event.dataTransfer.files) }}
                        className={`mt-3 rounded-xl border border-dashed transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${draggingMediaItemId === item.id ? "border-primary bg-primary/[0.09] ring-2 ring-primary/15" : "border-border/80 bg-background/55 hover:border-primary/40 hover:bg-background/90"}`}
                      >
                        <label htmlFor={`batch-media-${item.id}`} className="flex min-h-20 cursor-pointer items-center gap-3 px-3 py-3 sm:px-4">
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><LuCloudUpload aria-hidden="true" /></span>
                          <span className="min-w-0 flex-1"><span className="block text-xs font-semibold">Solte arquivos aqui ou escolha no dispositivo</span><span className="mt-1 block text-[0.6875rem] leading-4 text-muted-foreground">Fotos até 5 MiB · MP4/WebM até 15 s · até 6 mídias</span></span>
                          <LuUpload className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        </label>
                        <input id={`batch-media-${item.id}`} type="file" multiple accept={[...MENU_MEDIA_LIMITS.image.mimes, ...MENU_MEDIA_LIMITS.video.mimes].join(",")} className="sr-only" disabled={saving || item.files.length >= MENU_MAX_MEDIA_PER_ITEM} onChange={(event) => { if (event.currentTarget.files) addFiles(item.id, event.currentTarget.files); event.currentTarget.value = "" }} />
                      </div>
                      {item.files.length ? <p className="mt-2 text-[0.6875rem] text-muted-foreground">Use a alça ou as setas nas miniaturas para ordenar. A primeira será a capa do item.</p> : null}
                    </section>

                    <div className="lg:col-span-2">
                      <Button type="button" variant="ghost" className="h-auto w-full justify-between rounded-xl border border-border/70 px-3 py-2.5 text-left hover:bg-muted/45" aria-expanded={expandedDetails.has(item.id)} onClick={() => toggleDetails(item.id)}>
                        <span className="flex min-w-0 items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><LuTags aria-hidden="true" /></span><span className="min-w-0"><span className="block text-sm font-semibold">Descrição, destaques e atributos</span><span className="mt-0.5 block text-xs font-normal text-muted-foreground">Complementos do item · opcionais</span></span></span>
                        <span className="flex shrink-0 items-center gap-2">{item.highlights.trim() ? <Badge variant="outline">Destaques</Badge> : null}{item.attributes.length ? <Badge variant="outline">{item.attributes.length} atributos</Badge> : null}<LuChevronDown className={`size-4 transition-transform ${expandedDetails.has(item.id) ? "rotate-180" : ""}`} aria-hidden="true" /></span>
                      </Button>
                      <AnimatePresence initial={false}>
                        {expandedDetails.has(item.id) ? <motion.div id={`batch-details-${item.id}`} initial={reduceMotion ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: reduceMotion ? 0 : 0.18 }} className="overflow-hidden">
                          <div className="grid gap-3 pt-3 lg:grid-cols-2">
                            <div className="space-y-1"><Label htmlFor={`batch-description-${item.id}`}>Descrição <span className="font-normal text-muted-foreground">(opcional)</span></Label><MenuIconTextarea id={`batch-description-${item.id}`} icon={<LuAlignLeft aria-hidden="true" />} maxLength={600} value={item.description} onValueChange={(value) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, description: value } : entry))} placeholder="Ingredientes ou detalhes do prato" /></div>
                            <div className="space-y-1"><Label htmlFor={`batch-highlights-${item.id}`}>Destaques <span className="font-normal text-muted-foreground">(opcional)</span></Label><MenuIconTextarea id={`batch-highlights-${item.id}`} icon={<LuSparkles aria-hidden="true" />} maxLength={320} value={item.highlights} onValueChange={(value) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, highlights: value } : entry))} placeholder="Separe por vírgula: feito na casa, acompanha salada" /><p className="text-[0.6875rem] text-muted-foreground">Até 10 destaques, com 30 caracteres cada.</p></div>
                            <fieldset className="space-y-2 rounded-xl border border-border/70 bg-card p-3 lg:col-span-2">
                              <legend className="px-1 text-xs font-semibold">Atributos do cardápio <span className="font-normal text-muted-foreground">(opcional · {item.attributes.length}/{MENU_MAX_ATTRIBUTES_PER_ITEM})</span></legend>
                              {attributeCatalog.length ? <div className="grid gap-3 sm:grid-cols-2">
                                {[{ kind: "diet" as const, title: "Dietas", options: dietAttributes }, { kind: "allergen" as const, title: "Alergênicos", options: allergenAttributes }].map((group) => <div key={group.kind} className="space-y-1.5">
                                  <p className="flex items-center gap-1.5 text-[0.6875rem] font-medium text-muted-foreground">{group.kind === "allergen" ? <LuShieldAlert aria-hidden="true" /> : <LuTags aria-hidden="true" />}{group.title}</p>
                                  <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-1.5">
                                    {group.options.length ? group.options.map((attribute) => {
                                      const selectedAttribute = item.attributes.find((entry) => entry.id === attribute.id)
                                      return <div key={attribute.id} className={`grid gap-2 rounded-lg px-2 py-1.5 ${selectedAttribute?.kind === "allergen" ? "sm:grid-cols-[minmax(0,1fr)_138px] sm:items-center" : "grid-cols-1"}`}>
                                        <div className="flex min-h-8 min-w-0 items-center gap-2">
                                          <Checkbox checked={Boolean(selectedAttribute)} disabled={saving || (!selectedAttribute && item.attributes.length >= MENU_MAX_ATTRIBUTES_PER_ITEM)} onCheckedChange={(checked) => toggleAttribute(item.id, attribute, checked === true)} aria-label={attribute.label} />
                                          <span className="min-w-0 flex-1 truncate text-xs">{attribute.label}</span>
                                          {!attribute.isSystem ? <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[0.5625rem]">Personalizado</Badge> : null}
                                        </div>
                                        {selectedAttribute?.kind === "allergen" ? <MenuComboboxField id={`batch-attribute-${item.id}-${attribute.id}`} ariaLabel={`Qualificador para ${attribute.label}`} className="h-8 w-full" value={selectedAttribute.qualifier ?? "contains"} options={ATTRIBUTE_QUALIFIER_OPTIONS} onValueChange={(value) => setAttributeQualifier(item.id, attribute.id, value as "contains" | "may_contain")} icon={<LuShieldAlert aria-hidden="true" />} placeholder="Qualificador" /> : null}
                                      </div>
                                    }) : <p className="p-2 text-xs text-muted-foreground">Nenhum atributo deste tipo cadastrado.</p>}
                                  </div>
                                </div>)}
                              </div> : <p className="rounded-lg bg-muted/35 p-3 text-xs text-muted-foreground">Nenhum atributo cadastrado para este restaurante.</p>}
                            </fieldset>
                          </div>
                        </motion.div> : null}
                      </AnimatePresence>
                    </div>
                    {rowErrors[item.id] ? <p className="text-xs leading-5 text-destructive lg:col-span-2">{rowErrors[item.id]}</p> : null}
                  </div>
                </section>)}
                {items.length < MENU_MAX_ITEMS_PER_BATCH ? <Button type="button" variant="outline" className="w-full border-dashed" onClick={addItem}><LuPlus aria-hidden="true" />Adicionar outro item</Button> : null}
              </form>

              {error ? <Alert variant={committedDraft ? "default" : "destructive"}><LuCircleAlert aria-hidden="true" /><AlertTitle>{committedDraft ? "Verifique o lote salvo" : "Não foi possível concluir"}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
              {progress.total > 0 && saving ? <div className="rounded-xl border border-border/70 bg-card p-3"><p className="text-xs font-medium">Enviando mídias · {progress.done} de {progress.total}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} /></div></div> : null}
            </div>
          </div>
          <footer className="sticky bottom-0 z-10 shrink-0 border-t border-border/70 bg-background/95 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur sm:px-7">
            <div className="mx-auto flex w-full max-w-6xl flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">Rascunho recuperável neste navegador · até 50 itens</p>
              <div className="flex justify-end gap-2">
                {committedDraft ? <Button type="button" onClick={() => void discardCommittedCopy()}><LuCheck aria-hidden="true" />Descartar cópia local</Button> : <>
                  {storageError ? <Button type="button" variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>Fechar sem salvar</Button> : null}
                  <Button type="button" variant="outline" disabled={saving || !restoreHandled} onClick={() => void requestClose(false)}>Fechar</Button>
                  <Button type="submit" form="menu-batch-form" disabled={saving || !restoreHandled || !items.length}>
                    {saving ? <LuLoaderCircle className="animate-spin" aria-hidden="true" /> : null}
                    {saving ? "Salvando lote…" : <><LuCheck aria-hidden="true" />Salvar {items.length} itens</>}
                  </Button>
                </>}
              </div>
            </div>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  )
}
