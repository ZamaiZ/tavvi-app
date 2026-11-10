"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { LuAlignLeft, LuCheck, LuCircleAlert, LuCirclePlus, LuFolderPlus, LuLayers2, LuLoaderCircle, LuPlus, LuTrash2, LuUpload, LuUtensils } from "react-icons/lu"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { MENU_MAX_CATEGORIES_PER_BATCH, MENU_MAX_ITEMS_PER_BATCH, MENU_MAX_MEDIA_PER_ITEM, type MenuCategoryDTO } from "../model"
import { MenuComboboxField, MenuIconInput, MenuIconTextarea, MenuPriceInput, type MenuComboboxOption } from "./menu-fields"
import { normalizeMenuPriceInput, parseMenuPriceCents } from "../lib/currency"
import { saveMenuBatchAction } from "../actions"
import { batchDraftStore } from "../lib/batch-draft-store"
import type { MenuBatchDraft } from "../lib/batch-draft-schema"
import { discardUploadedMenuMedia, inspectMenuFile, uploadMenuMedia, type UploadedMenuMedia } from "../lib/media-prep"

type BatchCategory = { id: string; name: string; description: string }
type BatchItem = { id: string; categoryId: string; name: string; description: string; price: string; files: File[] }

function newItem(categoryId = ""): BatchItem {
  return { id: crypto.randomUUID(), categoryId, name: "", description: "", price: "", files: [] }
}

function draftFrom(value: MenuBatchDraft) {
  return { categories: value.categories, items: value.items }
}

export function MenuBatchWorkspace({
  restaurantId,
  categories: existingCategories,
  open,
  onOpenChange,
  onComplete,
}: {
  restaurantId: string
  categories: MenuCategoryDTO[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}) {
  const firstCategoryId = existingCategories[0]?.id ?? ""
  const [categories, setCategories] = useState<BatchCategory[]>([])
  const [items, setItems] = useState<BatchItem[]>([newItem(firstCategoryId)])
  const [restoreDraft, setRestoreDraft] = useState<MenuBatchDraft | null>(null)
  const [restoreHandled, setRestoreHandled] = useState(false)
  const [storageError, setStorageError] = useState("")
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
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
  const itemsWithMedia = items.filter((item) => item.files.length > 0).length
  const selectedFiles = items.reduce((total, item) => total + item.files.length, 0)

  useEffect(() => {
    if (!open) return
    let active = true
    setCategories([])
    setItems([newItem(firstCategoryId)])
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
    setItems(restored.items.map((item) => ({ ...item, price: normalizeMenuPriceInput(item.price) })))
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
      if (!item.categoryId || !allCategories.some((category) => category.id === item.categoryId)) nextRowErrors[item.id] = "Escolha uma categoria."
      else if (item.name.trim().length < 2) nextRowErrors[item.id] = "Informe o nome do item."
      else if (item.name.trim().length > 120 || item.description.trim().length > 600) nextRowErrors[item.id] = "Revise os limites de nome e descrição."
      else if (parseMenuPriceCents(item.price) === null) nextRowErrors[item.id] = "Informe um preço válido, por exemplo 24,90 (máximo R$ 999.999,99)."
      else if (itemNames.has(key)) nextRowErrors[item.id] = "Nome repetido nesta categoria."
      itemNames.add(key)
      if (item.files.length > MENU_MAX_MEDIA_PER_ITEM) nextRowErrors[item.id] = "Cada item pode ter até 6 mídias."
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
          priceCents: parseMenuPriceCents(item.price) as number,
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
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><DialogTitle className="text-lg sm:text-xl">Cadastro em lote</DialogTitle><Badge variant="secondary">{items.length} / {MENU_MAX_ITEMS_PER_BATCH} itens</Badge></div><DialogDescription className="mt-1 max-w-2xl">Preencha o essencial em sequência. Preços e categorias podem ser ajustados depois no editor completo.</DialogDescription></div>
              </div>
            </DialogHeader>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-7 sm:py-6">
            <div className="mx-auto w-full max-w-6xl space-y-4 pb-24">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-border/70 bg-card px-3 py-2.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{items.length} {items.length === 1 ? "item" : "itens"}</span>
                <span>{categories.length} {categories.length === 1 ? "categoria nova" : "categorias novas"}</span>
                <span>{selectedFiles} {selectedFiles === 1 ? "mídia selecionada" : "mídias selecionadas"}</span>
                {items.length - itemsWithMedia > 0 ? <span>{items.length - itemsWithMedia} {items.length - itemsWithMedia === 1 ? "item sem mídia" : "itens sem mídia"}; não estarão disponíveis no cardápio público.</span> : <span className="text-primary">Todos os itens têm mídia.</span>}
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

              <form id="menu-batch-form" onSubmit={submit} className="space-y-3">
                {items.map((item, index) => <section key={item.id} className="rounded-2xl border border-border/70 bg-card shadow-sm">
                  <header className="flex items-center justify-between border-b border-border/60 px-3 py-2.5 sm:px-4"><div className="flex items-center gap-2"><span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-[0.6875rem] font-semibold text-primary">{index + 1}</span><h2 className="text-xs font-semibold">Novo item</h2></div>{items.length > 1 ? <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remover item ${index + 1}`} onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}><LuTrash2 aria-hidden="true" /></Button> : null}</header>
                  <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(150px,0.7fr)_minmax(120px,0.45fr)]">
                    <div className="space-y-1"><Label htmlFor={`batch-name-${item.id}`}>Nome do item</Label><MenuIconInput id={`batch-name-${item.id}`} icon={<LuUtensils aria-hidden="true" />} maxLength={120} aria-invalid={Boolean(rowErrors[item.id])} value={item.name} onValueChange={(value) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, name: value } : entry))} placeholder="Ex.: Risoto de cogumelos" /></div>
                    <div className="space-y-1"><Label htmlFor={`batch-category-select-${item.id}`}>Categoria</Label><MenuComboboxField id={`batch-category-select-${item.id}`} value={item.categoryId} options={categoryOptions} onValueChange={(value) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, categoryId: value } : entry))} icon={<LuLayers2 aria-hidden="true" />} placeholder="Escolha uma categoria" emptyMessage="Crie ou adicione uma categoria para continuar." /></div>
                    <div className="space-y-1"><Label htmlFor={`batch-price-${item.id}`}>Preço</Label><MenuPriceInput id={`batch-price-${item.id}`} aria-invalid={Boolean(rowErrors[item.id])} value={item.price} onValueChange={(value) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, price: value } : entry))} /></div>
                    <div className="space-y-1 sm:col-span-2 lg:col-span-3"><Label htmlFor={`batch-description-${item.id}`}>Descrição <span className="font-normal text-muted-foreground">(opcional)</span></Label><MenuIconTextarea id={`batch-description-${item.id}`} icon={<LuAlignLeft aria-hidden="true" />} maxLength={600} value={item.description} onValueChange={(value) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, description: value } : entry))} placeholder="Ingredientes ou detalhes do prato" /></div>
                    <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-3">
                      <label className="inline-flex min-h-8 cursor-pointer items-center gap-2 rounded-lg border border-border/70 px-2.5 text-xs font-medium hover:bg-muted"><LuUpload aria-hidden="true" />Adicionar mídias<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm" className="sr-only" disabled={saving || item.files.length >= MENU_MAX_MEDIA_PER_ITEM} onChange={(event) => { const next = Array.from(event.target.files ?? []).slice(0, Math.max(0, MENU_MAX_MEDIA_PER_ITEM - item.files.length)); setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, files: [...entry.files, ...next] } : entry)); event.currentTarget.value = "" }} /></label>
                      <span className="text-xs text-muted-foreground">{item.files.length ? `${item.files.length} / 6` : "Mídia opcional; necessária para publicar o item."}</span>
                      {item.files.map((file, fileIndex) => <Badge key={`${file.name}-${file.lastModified}-${fileIndex}`} variant="secondary" className="max-w-48 gap-1"><span className="truncate">{file.name}</span><button type="button" className="ml-1 rounded-full hover:text-destructive" aria-label={`Remover ${file.name}`} onClick={() => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, files: entry.files.filter((_, index) => index !== fileIndex) } : entry))}>×</button></Badge>)}
                    </div>
                    {rowErrors[item.id] ? <p className="text-xs text-destructive sm:col-span-2 lg:col-span-3">{rowErrors[item.id]}</p> : null}
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
