"use client"

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { LuAlignLeft, LuCircleAlert, LuImagePlus, LuLayers2, LuLoaderCircle, LuPlus, LuShieldAlert, LuSparkles, LuTag, LuTags, LuTrash2, LuUtensils, LuVideo } from "react-icons/lu"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { MenuComboboxField, MenuIconInput, MenuIconTextarea, MenuPriceInput, type MenuComboboxOption } from "./menu-fields"
import { createMenuAttributeAction, saveMenuItemAction } from "../actions"
import { MENU_MAX_MEDIA_PER_ITEM, MENU_MAX_VARIANTS_PER_ITEM, MENU_MEDIA_LIMITS, type MenuAttributeDTO, type MenuAttributeKind, type MenuCategoryDTO, type MenuItemDTO, type MenuMediaDTO } from "../model"
import { formatMenuPriceCents, parseMenuPriceCents } from "../lib/currency"
import { discardUploadedMenuMedia, inspectMenuFile, uploadMenuMedia, type SelectedMenuMedia, type UploadedMenuMedia } from "../lib/media-prep"

type MediaDraft =
  | { key: string; saved: MenuMediaDTO; selected?: never }
  | { key: string; selected: SelectedMenuMedia; saved?: never }

type VariantDraft = { id: string; name: string; price: string; isAvailable: boolean }

function toVariantDraft(item: MenuItemDTO | null): VariantDraft[] {
  if (!item || item.pricing.mode !== "variants") return []
  return item.pricing.variants.map((variant) => ({
    id: variant.id,
    name: variant.name,
    price: formatMenuPriceCents(variant.priceCents),
    isAvailable: variant.isAvailable,
  }))
}

const ATTRIBUTE_KIND_OPTIONS: readonly MenuComboboxOption[] = [
  { value: "diet", label: "Dieta" },
  { value: "allergen", label: "Alergênico" },
]

const ALLERGEN_QUALIFIER_OPTIONS: readonly MenuComboboxOption[] = [
  { value: "contains", label: "Contém" },
  { value: "may_contain", label: "Pode conter" },
]

export function MenuItemEditor({
  restaurantId,
  item,
  initialCategoryId,
  categories,
  attributes,
  open,
  onOpenChange,
  onSaved,
}: {
  restaurantId: string
  item: MenuItemDTO | null
  initialCategoryId: string | null
  categories: MenuCategoryDTO[]
  attributes: MenuAttributeDTO[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const router = useRouter()
  const [itemId, setItemId] = useState(item?.id ?? "")
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? categories[0]?.id ?? "")
  const [name, setName] = useState(item?.name ?? "")
  const [description, setDescription] = useState(item?.description ?? "")
  const [isVisible, setIsVisible] = useState(item?.isVisible ?? true)
  const [isAvailable, setIsAvailable] = useState(item?.isAvailable ?? true)
  const [priceMode, setPriceMode] = useState<"single" | "variants">(item?.pricing.mode ?? "single")
  const [singlePrice, setSinglePrice] = useState(item?.pricing.mode === "single" ? formatMenuPriceCents(item.pricing.basePriceCents) : "")
  const [variants, setVariants] = useState<VariantDraft[]>(toVariantDraft(item))
  const [highlights, setHighlights] = useState(item?.highlights.join(", ") ?? "")
  const [itemAttributes, setItemAttributes] = useState<Record<string, "contains" | "may_contain" | null>>(() => Object.fromEntries((item?.attributes ?? []).map((entry) => [entry.id, entry.qualifier])))
  const [media, setMedia] = useState<MediaDraft[]>(() => (item?.media ?? []).map((entry) => ({ key: entry.id, saved: entry })))
  const [newAttributeKind, setNewAttributeKind] = useState<MenuAttributeKind>("diet")
  const [newAttributeLabel, setNewAttributeLabel] = useState("")
  const [isCreatingAttribute, setIsCreatingAttribute] = useState(false)
  const [pending, setPending] = useState(false)
  const [mediaPending, setMediaPending] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState("")
  const mediaRef = useRef(media)
  mediaRef.current = media

  useEffect(() => {
    mediaRef.current.forEach((entry) => { if (entry.selected) URL.revokeObjectURL(entry.selected.previewUrl) })
    setItemId(item?.id ?? crypto.randomUUID())
    setCategoryId(item?.categoryId ?? initialCategoryId ?? categories[0]?.id ?? "")
    setName(item?.name ?? "")
    setDescription(item?.description ?? "")
    setIsVisible(item?.isVisible ?? true)
    setIsAvailable(item?.isAvailable ?? true)
    setPriceMode(item?.pricing.mode ?? "single")
    setSinglePrice(item?.pricing.mode === "single" ? formatMenuPriceCents(item.pricing.basePriceCents) : "")
    setVariants(toVariantDraft(item))
    setHighlights(item?.highlights.join(", ") ?? "")
    setItemAttributes(Object.fromEntries((item?.attributes ?? []).map((entry) => [entry.id, entry.qualifier])))
    setMedia((item?.media ?? []).map((entry) => ({ key: entry.id, saved: entry })))
    setError("")
  }, [item?.id, initialCategoryId, open])

  useEffect(() => () => {
    mediaRef.current.forEach((entry) => { if (entry.selected) URL.revokeObjectURL(entry.selected.previewUrl) })
  }, [])

  const usedAttributeIds = useMemo(() => new Set(Object.keys(itemAttributes)), [itemAttributes])
  const categoryOptions = useMemo<MenuComboboxOption[]>(() => categories.map((category) => ({ value: category.id, label: category.name })), [categories])

  async function addFiles(files: FileList | null) {
    if (!files) return
    setMediaPending(true)
    setError("")
    const incoming = Array.from(files).slice(0, Math.max(0, MENU_MAX_MEDIA_PER_ITEM - media.length))
    const selected: MediaDraft[] = []
    try {
      for (const file of incoming) {
        const draft = await inspectMenuFile(file)
        selected.push({ key: draft.key, selected: draft })
      }
      setMedia((current) => [...current, ...selected])
      if (incoming.length < files.length) setError("Um item pode ter até 6 mídias.")
    } catch (cause) {
      selected.forEach((entry) => { if (entry.selected) URL.revokeObjectURL(entry.selected.previewUrl) })
      const message = cause instanceof Error ? cause.message : "Não foi possível ler esta mídia."
      setError(message)
    } finally {
      setMediaPending(false)
    }
  }

  function removeMedia(key: string) {
    setMedia((current) => {
      const entry = current.find((candidate) => candidate.key === key)
      if (entry?.selected) URL.revokeObjectURL(entry.selected.previewUrl)
      return current.filter((candidate) => candidate.key !== key)
    })
  }

  async function createAttribute() {
    setIsCreatingAttribute(true)
    setError("")
    try {
      const result = await createMenuAttributeAction({ expectedRestaurantId: restaurantId, kind: newAttributeKind, label: newAttributeLabel })
      if (!result.ok) {
        setError("Não foi possível criar o atributo. Confira o nome e tente novamente.")
        return
      }
      setNewAttributeLabel("")
      router.refresh()
    } catch {
      setError("Não foi possível criar o atributo. Tente novamente.")
    } finally {
      setIsCreatingAttribute(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!categoryId) {
      setError("Crie uma categoria antes de adicionar itens.")
      return
    }
    if (!media.length) {
      setError("Adicione pelo menos uma foto ou vídeo ao item.")
      return
    }
    const highlightsList = [...new Set(highlights.split(/[\n,]/).map((entry) => entry.trim()).filter(Boolean))]
    if (highlightsList.length > 10 || highlightsList.some((highlight) => highlight.length > 30)) {
      setError("Use até 10 destaques, com no máximo 30 caracteres cada.")
      return
    }
    const attributesPayload = attributes.flatMap((attribute) => usedAttributeIds.has(attribute.id) ? [{
      id: attribute.id,
      kind: attribute.kind,
      qualifier: itemAttributes[attribute.id] ?? null,
    }] : [])
    const cents = parseMenuPriceCents(singlePrice)
    if (priceMode === "single" && cents === null) {
      setError("Informe um preço válido, por exemplo 24,90 (máximo R$ 999.999,99).")
      return
    }
    if (priceMode === "variants" && variants.some((variant) => !variant.name.trim() || parseMenuPriceCents(variant.price) === null)) {
      setError("Cada variação precisa de um nome e um preço válido até R$ 999.999,99.")
      return
    }
    if (priceMode === "variants" && (variants.length < 1 || variants.length > MENU_MAX_VARIANTS_PER_ITEM)) {
      setError("Adicione de 1 a 30 variações.")
      return
    }

    setPending(true)
    setError("")
    setProgress(0)
    const uploaded: UploadedMenuMedia[] = []
    try {
      const mediaPayload = []
      for (const entry of media) {
        if (entry.saved) {
          mediaPayload.push({
            id: entry.saved.id, kind: entry.saved.kind, storagePath: entry.saved.storagePath,
            posterPath: entry.saved.posterPath, altText: entry.saved.altText,
            width: entry.saved.width, height: entry.saved.height, durationMs: entry.saved.durationMs,
            position: mediaPayload.length,
          })
        } else {
          const result = await uploadMenuMedia({
            expectedRestaurantId: restaurantId,
            itemId,
            selected: entry.selected,
            onProgress: setProgress,
          })
          uploaded.push(result)
          const metadata = {
            id: result.id,
            kind: result.kind,
            storagePath: result.storagePath,
            posterPath: result.posterPath,
            altText: result.altText,
            width: result.width,
            height: result.height,
            durationMs: result.durationMs,
          }
          mediaPayload.push({ ...metadata, position: mediaPayload.length })
        }
      }

      const result = await saveMenuItemAction({
        expectedRestaurantId: restaurantId,
        itemId,
        categoryId,
        name,
        description,
        isVisible,
        isAvailable,
        pricing: priceMode === "single"
          ? { mode: "single", basePriceCents: cents }
          : { mode: "variants", variants: variants.map((variant) => ({
            id: variant.id,
            name: variant.name.trim(),
            priceCents: parseMenuPriceCents(variant.price) as number,
            isAvailable: variant.isAvailable,
          })) },
        highlights: highlightsList,
        attributes: attributesPayload,
        media: mediaPayload,
      })
      if (!result.ok) {
        await discardUploadedMenuMedia(restaurantId, uploaded)
        setError(result.code === "published_menu_empty"
          ? "Essa alteração deixaria o cardápio publicado sem itens públicos. Mantenha outro item visível com mídia ou despublique primeiro."
          : result.code === "invalid_media"
            ? "Uma mídia não foi confirmada. Remova e adicione o arquivo novamente."
            : "Não foi possível salvar o item. Revise os campos e tente novamente.")
        return
      }
      onOpenChange(false)
      onSaved()
    } catch (cause) {
      await discardUploadedMenuMedia(restaurantId, uploaded)
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o item.")
    } finally {
      setPending(false)
    }
  }

  function toggleAttribute(attribute: MenuAttributeDTO, checked: boolean) {
    setItemAttributes((current) => {
      const next = { ...current }
      if (checked) next[attribute.id] = attribute.kind === "allergen" ? "contains" : null
      else delete next[attribute.id]
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!pending) onOpenChange(next) }}>
      <DialogContent className="max-h-[94svh] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
        <div className="border-b border-border/70 bg-gradient-to-br from-primary/[0.08] via-card to-card px-5 py-5 sm:px-7">
          <DialogHeader>
            <span className="mb-1 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><LuImagePlus aria-hidden="true" /></span>
            <DialogTitle>{item ? "Editar item" : "Adicionar item"}</DialogTitle>
            <DialogDescription>Descrição, preço, atributos e mídia ficam organizados em um só lugar.</DialogDescription>
          </DialogHeader>
        </div>
        <form onSubmit={submit} className="space-y-6 px-5 py-5 sm:px-7">
          {categories.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="menu-item-category">Categoria</Label>
                <MenuComboboxField id="menu-item-category" value={categoryId} options={categoryOptions} onValueChange={setCategoryId} icon={<LuLayers2 aria-hidden="true" />} placeholder="Escolha uma categoria" />
              </div>
              <div className="space-y-1.5"><Label htmlFor="menu-item-name">Nome do item</Label><MenuIconInput id="menu-item-name" icon={<LuUtensils aria-hidden="true" />} autoFocus maxLength={120} value={name} onValueChange={setName} placeholder="Ex.: Risoto de cogumelos" /></div>
            </div>
          ) : <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Crie uma categoria antes de adicionar itens.</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="menu-item-description">Descrição</Label><MenuIconTextarea id="menu-item-description" icon={<LuAlignLeft aria-hidden="true" />} maxLength={600} value={description} onValueChange={setDescription} placeholder="Ingredientes, preparo ou detalhes que ajudam na escolha" /></div>
            <div className="space-y-3">
              <Label>Preço</Label>
              <div className="inline-flex rounded-lg border border-border/70 bg-muted/40 p-1">
                <Button type="button" size="sm" variant={priceMode === "single" ? "secondary" : "ghost"} onClick={() => setPriceMode("single")}>Preço único</Button>
                <Button type="button" size="sm" variant={priceMode === "variants" ? "secondary" : "ghost"} onClick={() => setPriceMode("variants")}>Variações</Button>
              </div>
              {priceMode === "single" ? (
                <MenuPriceInput aria-label="Preço em reais" value={singlePrice} onValueChange={setSinglePrice} />
              ) : (
                <div className="space-y-2">
                  {variants.map((variant, index) => <div key={variant.id} className="grid grid-cols-[minmax(0,1fr)_minmax(124px,0.62fr)_36px_32px] items-center gap-2"><MenuIconInput aria-label={`Nome da variação ${index + 1}`} icon={<LuTag aria-hidden="true" />} maxLength={60} value={variant.name} onValueChange={(value) => setVariants((current) => current.map((entry) => entry.id === variant.id ? { ...entry, name: value } : entry))} placeholder="Ex.: Individual" /><MenuPriceInput aria-label={`Preço da variação ${index + 1}`} value={variant.price} onValueChange={(value) => setVariants((current) => current.map((entry) => entry.id === variant.id ? { ...entry, price: value } : entry))} /><Switch checked={variant.isAvailable} aria-label={`${variant.name || `Variação ${index + 1}`} disponível`} onCheckedChange={(isAvailable) => setVariants((current) => current.map((entry) => entry.id === variant.id ? { ...entry, isAvailable } : entry))} /><Button type="button" size="icon-sm" variant="ghost" aria-label={`Remover variação ${variant.name || index + 1}`} onClick={() => setVariants((current) => current.filter((entry) => entry.id !== variant.id))}><LuTrash2 aria-hidden="true" /></Button></div>)}
                  <Button type="button" variant="outline" size="sm" disabled={variants.length >= MENU_MAX_VARIANTS_PER_ITEM} onClick={() => setVariants((current) => [...current, { id: crypto.randomUUID(), name: "", price: "", isAvailable: true }])}><LuPlus aria-hidden="true" />Adicionar variação</Button>
                </div>
              )}
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="flex flex-wrap items-center gap-2 text-sm font-medium">Mídia <Badge variant="secondary">Obrigatória</Badge><span className="font-normal text-muted-foreground">(1 a 6 fotos ou vídeos de até 15 s)</span></legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {media.map((entry) => {
                const src = entry.saved
                  ? entry.saved.kind === "image" ? entry.saved.url : entry.saved.posterUrl
                  : entry.selected.kind === "image" || entry.selected.poster ? entry.selected.previewUrl : null
                return <div key={entry.key} className="group relative aspect-square overflow-hidden rounded-xl border border-border/70 bg-muted">
                  {src ? <img src={src} alt="Prévia da mídia" className="size-full object-cover" /> : <div className="flex size-full items-center justify-center text-muted-foreground"><LuVideo aria-hidden="true" className="size-6" /></div>}
                  {entry.selected?.kind === "video" ? <Badge className="absolute bottom-1 left-1 bg-black/65 text-white">Vídeo</Badge> : null}
                  <Button type="button" size="icon-xs" variant="destructive" className="absolute right-1 top-1" aria-label="Remover mídia" onClick={() => removeMedia(entry.key)}><LuTrash2 aria-hidden="true" /></Button>
                </div>
              })}
              {media.length < MENU_MAX_MEDIA_PER_ITEM ? (
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/25 text-center text-xs text-muted-foreground transition-colors hover:bg-muted/60">
                  {mediaPending ? <LuLoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <LuImagePlus className="size-5" aria-hidden="true" />}
                  {mediaPending ? "Lendo mídia…" : "Adicionar foto ou vídeo"}
                  <input type="file" accept={[...MENU_MEDIA_LIMITS.image.mimes, ...MENU_MEDIA_LIMITS.video.mimes].join(",")} multiple className="sr-only" disabled={mediaPending || pending} onChange={(event) => { void addFiles(event.target.files); event.currentTarget.value = "" }} />
                </label>
              ) : null}
            </div>
            {pending && media.some((entry) => entry.selected) ? <div className="space-y-1"><p className="text-xs text-muted-foreground">Preparando e enviando mídia… {progress}%</p><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} /></div></div> : null}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="menu-item-highlights">Destaques</Label><MenuIconTextarea id="menu-item-highlights" icon={<LuSparkles aria-hidden="true" />} maxLength={320} value={highlights} onValueChange={setHighlights} placeholder="Separe por vírgula: feito na casa, acompanha salada" /><p className="text-xs text-muted-foreground">Texto livre. Dietas e alergênicos são configurados separadamente.</p></div>
            <div className="space-y-2">
              <Label>Atributos</Label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border/70 p-2">
                {attributes.map((attribute) => <div key={attribute.id} className="flex min-h-8 items-center gap-2">
                  <Checkbox checked={usedAttributeIds.has(attribute.id)} onCheckedChange={(checked) => toggleAttribute(attribute, checked === true)} aria-label={attribute.label} />
                  <span className="min-w-0 flex-1 text-xs">{attribute.label}</span>
                  {attribute.kind === "allergen" && usedAttributeIds.has(attribute.id) ? <MenuComboboxField id={`menu-item-qualifier-${attribute.id}`} ariaLabel={`Qualificador para ${attribute.label}`} className="h-8 w-36" value={itemAttributes[attribute.id] ?? "contains"} options={ALLERGEN_QUALIFIER_OPTIONS} onValueChange={(value) => setItemAttributes((current) => ({ ...current, [attribute.id]: value as "contains" | "may_contain" }))} icon={<LuShieldAlert aria-hidden="true" />} placeholder="Qualificador" /> : null}
                </div>)}
                {!attributes.length ? <p className="p-2 text-xs text-muted-foreground">Carregando atributos do restaurante…</p> : null}
              </div>
              <div className="flex gap-2">
                <MenuComboboxField id="menu-new-attribute-kind" ariaLabel="Tipo do novo atributo" className="h-8 w-36" value={newAttributeKind} options={ATTRIBUTE_KIND_OPTIONS} onValueChange={(value) => setNewAttributeKind(value as MenuAttributeKind)} icon={<LuTags aria-hidden="true" />} placeholder="Tipo" />
                <MenuIconInput aria-label="Nome do novo atributo" icon={<LuTag aria-hidden="true" />} maxLength={40} value={newAttributeLabel} onValueChange={setNewAttributeLabel} placeholder="Novo atributo" className="h-8 min-w-0 flex-1" />
                <Button type="button" size="icon" variant="outline" disabled={isCreatingAttribute || newAttributeLabel.trim().length < 2} aria-label="Criar atributo" onClick={() => void createAttribute()}>{isCreatingAttribute ? <LuLoaderCircle className="animate-spin" /> : <LuPlus />}</Button>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2"><span><span className="block text-sm font-medium">Visível</span><span className="text-xs text-muted-foreground">Pode aparecer no cardápio publicado.</span></span><input type="checkbox" checked={isVisible} onChange={(event) => setIsVisible(event.target.checked)} className="size-4 accent-primary" /></label>
            <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2"><span><span className="block text-sm font-medium">Disponível</span><span className="text-xs text-muted-foreground">Indisponível continua visível.</span></span><input type="checkbox" checked={isAvailable} onChange={(event) => setIsAvailable(event.target.checked)} className="size-4 accent-primary" /></label>
          </div>
          {error ? <p role="alert" className="flex gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-xs leading-5 text-destructive"><LuCircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{error}</p> : null}
          <DialogFooter className="sticky bottom-0 -mx-5 -mb-5 border-t border-border/70 bg-background/95 px-5 py-3 backdrop-blur sm:-mx-7 sm:-mb-5 sm:px-7">
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={pending || mediaPending || !categories.length || name.trim().length < 2}>
              {pending ? <LuLoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              {pending ? `Salvando${progress ? ` · ${progress}%` : "…"}` : item ? "Salvar alterações" : "Adicionar item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
