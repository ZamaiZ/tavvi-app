"use client"

import { useMemo, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { LuArrowLeft, LuCircleAlert, LuMinus, LuPlus, LuTrash2 } from "react-icons/lu"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { MenuItemDTO } from "@/features/panel/menu/model"
import { formatMenuPriceCents, maskMenuPriceInput, parseMenuPriceCents } from "@/features/panel/menu/lib/currency"
import type { OrderAdditionInput, OrderDraftLine } from "@/features/panel/orders/model"
import { getOrderLineTotalCents } from "@/features/panel/orders/lib/order-total"

type AdditionDraft = {
  key: string
  name: string
  quantity: number
  price: string
}

export function OrderItemComposer({
  item,
  categoryName,
  canEdit,
  onClose,
  onAdd,
}: {
  item: MenuItemDTO
  categoryName: string
  canEdit: boolean
  onClose: () => void
  onAdd: (line: OrderDraftLine) => void
}) {
  const prefersReducedMotion = useReducedMotion()
  const reducedMotion = prefersReducedMotion === true
  const [quantity, setQuantity] = useState(1)
  const [variantId, setVariantId] = useState<string | null>(null)
  const [observations, setObservations] = useState("")
  const [additions, setAdditions] = useState<AdditionDraft[]>([])
  const [error, setError] = useState<string | null>(null)
  const media = item.media[0]
  const availableVariants = item.pricing.mode === "variants"
    ? item.pricing.variants.filter((variant) => variant.isAvailable)
    : []
  const selectedVariant = item.pricing.mode === "variants"
    ? item.pricing.variants.find((variant) => variant.id === variantId && variant.isAvailable) ?? null
    : null
  const unitPriceCents = item.pricing.mode === "single"
    ? item.pricing.basePriceCents
    : selectedVariant?.priceCents ?? 0
  const additionsValid = additions.every((addition) => {
    const price = addition.price.trim() ? parseMenuPriceCents(addition.price) : 0
    return addition.name.trim().length > 0 && price !== null
  })
  const canSubmit = canEdit
    && item.isAvailable
    && (item.pricing.mode === "single" || selectedVariant !== null)
    && additionsValid
    && additions.length <= 10

  const previewLine = useMemo<OrderDraftLine>(() => ({
    lineId: "preview",
    menuItemId: item.id,
    variantId,
    quantity,
    observations,
    additions: additions.flatMap((addition) => {
      const unitPrice = addition.price.trim() ? parseMenuPriceCents(addition.price) : 0
      return addition.name.trim() && unitPrice !== null
        ? [{ name: addition.name.trim(), quantity: addition.quantity, unitPriceCents: unitPrice }]
        : []
    }),
    categoryId: item.categoryId,
    categoryName,
    itemName: item.name,
    mediaUrl: media?.kind === "image" ? media.url : media?.posterUrl ?? null,
    mediaAlt: media?.altText || "Foto de " + item.name,
    variantName: selectedVariant?.name ?? null,
    unitPriceCents,
  }), [additions, categoryName, item, media, observations, quantity, selectedVariant, unitPriceCents, variantId])

  function changeQuantity(value: number) {
    setQuantity(Math.max(1, Math.min(99, value)))
  }

  function addAddition() {
    if (additions.length >= 10) return
    setAdditions((current) => [...current, {
      key: globalThis.crypto.randomUUID(),
      name: "",
      quantity: 1,
      price: "0,00",
    }])
    setError(null)
  }

  function updateAddition(key: string, patch: Partial<AdditionDraft>) {
    setAdditions((current) => current.map((addition) => addition.key === key ? { ...addition, ...patch } : addition))
    setError(null)
  }

  function handleAdd() {
    if (!canEdit) return
    if (!canSubmit) {
      setError(additions.some((addition) => !addition.name.trim())
        ? "Informe o nome de cada acréscimo ou remova a linha vazia."
        : item.pricing.mode === "variants" && !selectedVariant
        ? "Escolha uma variação disponível."
        : "Revise os valores e a disponibilidade do item.")
      return
    }
    const mappedAdditions: OrderAdditionInput[] = additions.map((addition) => ({
      name: addition.name.trim(),
      quantity: addition.quantity,
      unitPriceCents: addition.price.trim() ? parseMenuPriceCents(addition.price) as number : 0,
    }))
    onAdd({
      ...previewLine,
      lineId: globalThis.crypto.randomUUID(),
      observations: observations.trim(),
      additions: mappedAdditions,
    })
    onClose()
  }

  return (
    <motion.section
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 12 }}
      transition={{ duration: reducedMotion ? 0.12 : 0.2, ease: [0.23, 1, 0.32, 1] }}
      aria-label={"Configurar " + item.name}
      className="absolute inset-0 z-30 flex min-h-0 flex-col bg-background"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur-xl sm:px-6">
        <Button type="button" variant="ghost" size="icon" aria-label="Voltar ao cardápio" onClick={onClose} className="size-11 shrink-0 rounded-xl">
          <LuArrowLeft aria-hidden="true" className="size-5" />
        </Button>
        <div className="min-w-0">
          <p className="text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Personalizar item</p>
          <h2 className="truncate text-base font-semibold tracking-tight">{item.name}</h2>
        </div>
        <Badge variant="outline" className="ml-auto hidden max-w-48 truncate rounded-full sm:inline-flex">{categoryName}</Badge>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto grid w-full max-w-5xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(22rem,1.05fr)] lg:gap-8 lg:py-7">
          <div className="space-y-4">
            <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-border/60 bg-muted shadow-sm">
              {media?.kind === "image" ? (
                <img src={media.url} alt={media.altText || "Foto de " + item.name} className="size-full object-cover" />
              ) : media?.posterUrl ? (
                <img src={media.posterUrl} alt={media.altText || "Capa de " + item.name} className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center text-sm text-muted-foreground">{media?.kind === "video" ? "Vídeo do item" : "Sem imagem"}</div>
              )}
              {media?.kind === "video" ? <Badge className="absolute bottom-3 left-3 rounded-full bg-black/70 text-white">Vídeo</Badge> : null}
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full">{categoryName}</Badge>
                {item.isAvailable ? <Badge className="rounded-full bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300">Disponível</Badge> : <Badge variant="secondary" className="rounded-full">Esgotado</Badge>}
              </div>
              <h3 className="mt-3 text-xl font-semibold tracking-tight">{item.name}</h3>
              {item.description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p> : null}
              {item.highlights.length ? <div className="mt-3 flex flex-wrap gap-1.5">{item.highlights.map((highlight) => <Badge key={highlight} variant="secondary" className="rounded-full font-normal">{highlight}</Badge>)}</div> : null}
            </div>
          </div>

          <div className="space-y-5">
            {item.pricing.mode === "variants" ? (
              <fieldset className="space-y-2.5">
                <legend className="text-sm font-semibold">Escolha a variação</legend>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {item.pricing.variants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      disabled={!variant.isAvailable || !canEdit}
                      aria-pressed={variantId === variant.id}
                      onClick={() => { setVariantId(variant.id); setError(null) }}
                      className={"flex min-h-14 items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left outline-none transition-[border-color,background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 " + (variantId === variant.id ? "border-primary/45 bg-primary/[0.07] shadow-sm shadow-primary/5" : "border-border/70 bg-card hover:border-primary/25 hover:bg-muted/30")}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{variant.name}</span>
                        {!variant.isAvailable ? <span className="mt-0.5 block text-[0.68rem] text-muted-foreground">Indisponível</span> : null}
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">R$ {formatMenuPriceCents(variant.priceCents)}</span>
                    </button>
                  ))}
                </div>
                {!availableVariants.length ? <p className="text-xs text-muted-foreground">Nenhuma variação está disponível.</p> : null}
              </fieldset>
            ) : (
              <div className="flex items-center justify-between rounded-2xl border border-primary/15 bg-primary/[0.045] px-4 py-3">
                <span><span className="block text-xs text-muted-foreground">Preço unitário</span><span className="text-lg font-semibold tabular-nums">R$ {formatMenuPriceCents(item.pricing.basePriceCents)}</span></span>
                <Badge variant="outline" className="rounded-full">Preço fixo</Badge>
              </div>
            )}

            <section aria-labelledby="order-item-quantity-heading" className="flex items-center justify-between rounded-2xl border border-border/70 bg-card px-4 py-3">
              <div>
                <h3 id="order-item-quantity-heading" className="text-sm font-semibold">Quantidade</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Unidades deste item</p>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background p-1">
                <Button type="button" variant="ghost" size="icon" aria-label="Diminuir quantidade" disabled={quantity <= 1 || !canEdit} onClick={() => changeQuantity(quantity - 1)} className="size-10 rounded-lg"><LuMinus aria-hidden="true" /></Button>
                <span aria-live="polite" className="min-w-8 text-center text-sm font-semibold tabular-nums">{quantity}</span>
                <Button type="button" variant="ghost" size="icon" aria-label="Aumentar quantidade" disabled={quantity >= 99 || !canEdit} onClick={() => changeQuantity(quantity + 1)} className="size-10 rounded-lg"><LuPlus aria-hidden="true" /></Button>
              </div>
            </section>

            <section aria-labelledby="order-additions-heading" className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 id="order-additions-heading" className="text-sm font-semibold">Acréscimos</h3>
                  <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">Extras livres com valor próprio. Observações ficam separadas e não alteram o preço.</p>
                </div>
                <Button type="button" variant="outline" size="sm" disabled={!canEdit || additions.length >= 10} onClick={addAddition} className="min-h-10 shrink-0 rounded-xl">
                  <LuPlus aria-hidden="true" />Adicionar
                </Button>
              </div>

              {additions.length ? (
                <div className="space-y-2.5">
                  {additions.map((addition, index) => {
                    const nameId = "order-addition-name-" + index
                    const quantityId = "order-addition-quantity-" + index
                    const priceId = "order-addition-price-" + index
                    return (
                      <div key={addition.key} className="grid gap-2 rounded-xl border border-border/60 bg-background/70 p-3 sm:grid-cols-[minmax(0,1fr)_5.5rem_8.5rem_2.5rem] sm:items-end">
                        <div className="space-y-1.5">
                          <Label htmlFor={nameId} className="text-[0.68rem]">Nome do acréscimo</Label>
                          <Input id={nameId} value={addition.name} disabled={!canEdit} maxLength={80} placeholder="Ex.: Queijo extra" onChange={(event) => updateAddition(addition.key, { name: event.target.value })} className="h-10" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={quantityId} className="text-[0.68rem]">Por unidade</Label>
                          <Input id={quantityId} type="number" min={1} max={99} value={addition.quantity} disabled={!canEdit} onChange={(event) => updateAddition(addition.key, { quantity: Math.max(1, Math.min(99, Number(event.target.value) || 1)) })} className="h-10 text-center tabular-nums" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={priceId} className="text-[0.68rem]">Preço unitário</Label>
                          <div className="relative">
                            <span aria-hidden="true" className="absolute top-1/2 left-3 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                            <Input id={priceId} inputMode="decimal" value={addition.price} disabled={!canEdit} aria-invalid={Boolean(addition.price.trim() && parseMenuPriceCents(addition.price) === null)} onChange={(event) => updateAddition(addition.key, { price: maskMenuPriceInput(event.target.value) })} className="h-10 pl-9 tabular-nums" />
                          </div>
                        </div>
                        <Button type="button" variant="ghost" size="icon" aria-label="Remover acréscimo" disabled={!canEdit} onClick={() => setAdditions((current) => current.filter((entry) => entry.key !== addition.key))} className="size-10 justify-self-end rounded-xl text-muted-foreground hover:text-destructive sm:justify-self-center">
                          <LuTrash2 aria-hidden="true" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-border/70 px-3 py-3 text-xs text-muted-foreground">Nenhum acréscimo. Observações podem ser registradas abaixo.</p>
              )}
            </section>

            <section aria-labelledby="order-observations-heading" className="space-y-2 rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
              <div>
                <Label id="order-observations-heading" htmlFor="order-item-observations" className="text-sm font-semibold">Observações</Label>
                <p className="mt-1 text-xs text-muted-foreground">Instruções para preparar este item. Não alteram o valor.</p>
              </div>
              <Textarea id="order-item-observations" value={observations} disabled={!canEdit} maxLength={500} onChange={(event) => setObservations(event.target.value)} placeholder="Ex.: sem cebola, molho à parte" className="min-h-24 resize-y rounded-xl bg-background" />
              <p className="text-right text-[0.68rem] tabular-nums text-muted-foreground">{observations.length}/500</p>
            </section>

            {!canEdit ? (
              <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3.5 py-3 text-xs leading-5 text-amber-800 dark:text-amber-200">
                <LuCircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                Somente a pessoa que assumiu este chamado pode registrar o pedido.
              </div>
            ) : null}
            <AnimatePresence initial={false}>
              {error ? <motion.p initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/[0.05] px-3.5 py-3 text-xs leading-5 text-destructive"><LuCircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{error}</motion.p> : null}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-border/70 bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-6">
        <div className="min-w-0">
          <p className="text-[0.68rem] text-muted-foreground">{quantity} × {selectedVariant?.name ?? item.name}</p>
          <p className="truncate text-lg font-semibold tabular-nums">R$ {formatMenuPriceCents(getOrderLineTotalCents(previewLine))}</p>
        </div>
        <Button type="button" disabled={!canSubmit} onClick={handleAdd} className="min-h-12 min-w-44 rounded-xl px-5 font-semibold shadow-sm">
          <LuPlus aria-hidden="true" />Adicionar ao pedido
        </Button>
      </footer>
    </motion.section>
  )
}
