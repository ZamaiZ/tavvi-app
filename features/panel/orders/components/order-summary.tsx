"use client"

import { LuCircleAlert, LuLoaderCircle, LuMinus, LuPlus, LuShoppingBag, LuTrash2, LuX } from "react-icons/lu"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { OrderDraftLine } from "@/features/panel/orders/model"
import { getOrderLineTotalCents, getOrderTotalCents } from "@/features/panel/orders/lib/order-total"
import { formatMenuPriceCents } from "@/features/panel/menu/lib/currency"

export type OrderFeedback = {
  kind: "error" | "success"
  text: string
}

export function OrderSummary({
  items,
  canEdit,
  canConfirm,
  submitting,
  confirmLabel,
  lockedMessage,
  feedback,
  showBackButton = false,
  showCloseButton = false,
  onBack,
  onClose,
  onQuantityChange,
  onRemove,
  onConfirm,
}: {
  items: OrderDraftLine[]
  canEdit: boolean
  canConfirm: boolean
  submitting: boolean
  confirmLabel?: string
  lockedMessage?: string
  feedback: OrderFeedback | null
  showBackButton?: boolean
  showCloseButton?: boolean
  onBack?: () => void
  onClose?: () => void
  onQuantityChange: (lineId: string, quantity: number) => void
  onRemove: (lineId: string) => void
  onConfirm: () => void
}) {
  const totalCents = getOrderTotalCents(items)
  const totalUnits = items.reduce((total, item) => total + item.quantity, 0)

  return (
    <section aria-label="Resumo do pedido" className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-border/60 px-4 py-4 sm:px-5">
        {showBackButton ? (
          <Button type="button" variant="ghost" size="icon" aria-label="Voltar ao cardápio" onClick={onBack} className="size-10 rounded-xl">
            <LuShoppingBag aria-hidden="true" className="size-4" />
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold tracking-tight">Resumo do pedido</h2>
            <Badge variant="secondary" className="rounded-full px-2 tabular-nums">{items.length}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{totalUnits} {totalUnits === 1 ? "unidade" : "unidades"} no carrinho</p>
        </div>
        {showCloseButton ? <Button type="button" variant="ghost" size="icon" aria-label="Fechar pedido" onClick={onClose} className="size-10 shrink-0 rounded-xl"><LuX aria-hidden="true" className="size-4" /></Button> : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
        {items.length ? (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.lineId} className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm">
                <div className="flex gap-3">
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {item.mediaUrl ? <img src={item.mediaUrl} alt="" className="size-full object-cover" loading="lazy" /> : <span className="grid size-full place-items-center text-[0.6rem] text-muted-foreground">Item</span>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[0.625rem] font-medium text-muted-foreground">{item.categoryName}</p>
                        <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-5">{item.itemName}</h3>
                        {item.variantName ? <p className="mt-0.5 text-xs text-muted-foreground">{item.variantName}</p> : null}
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums">R$ {formatMenuPriceCents(getOrderLineTotalCents(item))}</p>
                    </div>
                  </div>
                </div>

                {item.additions.length ? (
                  <div className="mt-3 space-y-1 border-l-2 border-primary/20 pl-2.5">
                    <p className="text-[0.625rem] font-semibold tracking-wide text-muted-foreground uppercase">Acréscimos</p>
                    {item.additions.map((addition, additionIndex) => (
                      <p key={additionIndex} className="text-xs leading-5 text-foreground/80">
                        {addition.quantity > 1 ? addition.quantity + " × " : ""}{addition.name}
                        <span className="ml-1 text-muted-foreground">· R$ {formatMenuPriceCents(addition.unitPriceCents * addition.quantity)}</span>
                      </p>
                    ))}
                  </div>
                ) : null}
                {item.observations ? (
                  <div className="mt-3 rounded-lg bg-muted/55 px-2.5 py-2">
                    <p className="text-[0.625rem] font-semibold tracking-wide text-muted-foreground uppercase">Observação</p>
                    <p className="mt-0.5 text-xs leading-5 text-foreground/80">{item.observations}</p>
                  </div>
                ) : null}

                <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5">
                  <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-background p-0.5">
                    <Button type="button" variant="ghost" size="icon" aria-label={"Diminuir quantidade de " + item.itemName} disabled={!canEdit || item.quantity <= 1 || submitting} onClick={() => onQuantityChange(item.lineId, item.quantity - 1)} className="size-9 rounded-lg">
                      <LuMinus aria-hidden="true" className="size-3.5" />
                    </Button>
                    <span aria-live="polite" className="min-w-8 text-center text-xs font-semibold tabular-nums">{item.quantity}</span>
                    <Button type="button" variant="ghost" size="icon" aria-label={"Aumentar quantidade de " + item.itemName} disabled={!canEdit || item.quantity >= 99 || submitting} onClick={() => onQuantityChange(item.lineId, item.quantity + 1)} className="size-9 rounded-lg">
                      <LuPlus aria-hidden="true" className="size-3.5" />
                    </Button>
                  </div>
                  {canEdit ? (
                    <Button type="button" variant="ghost" size="sm" disabled={submitting} onClick={() => onRemove(item.lineId)} className="min-h-10 rounded-lg text-muted-foreground hover:text-destructive">
                      <LuTrash2 aria-hidden="true" />Remover
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-border/70 bg-card/50 px-5 text-center">
            <div className="max-w-xs">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/[0.08] text-primary"><LuShoppingBag aria-hidden="true" className="size-5" /></span>
              <h3 className="mt-3 text-sm font-semibold">Seu pedido começa aqui</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Escolha itens no cardápio. Observações e acréscimos podem ser personalizados em cada linha.</p>
            </div>
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-border/70 bg-background/95 px-4 pt-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-5">
        {feedback ? (
          <div role={feedback.kind === "error" ? "alert" : "status"} className={"mb-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs leading-5 " + (feedback.kind === "error" ? "border-destructive/20 bg-destructive/[0.05] text-destructive" : "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300")}>
            {feedback.kind === "error" ? <LuCircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : null}
            {feedback.text}
          </div>
        ) : null}
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Subtotal</p>
            <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">R$ {formatMenuPriceCents(totalCents)}</p>
          </div>
          <p className="pb-1 text-xs tabular-nums text-muted-foreground">{items.length} {items.length === 1 ? "item" : "itens"}</p>
        </div>
        {canConfirm ? (
          <Button type="button" disabled={!items.length || submitting} onClick={onConfirm} className="min-h-12 w-full rounded-xl text-sm font-semibold shadow-sm">
            {submitting ? <LuLoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <LuShoppingBag aria-hidden="true" />}
            {submitting ? "Enviando pedido…" : confirmLabel ?? "Confirmar pedido"}
          </Button>
        ) : (
          <p className="rounded-xl bg-muted/60 px-3 py-2.5 text-center text-xs leading-5 text-muted-foreground">{lockedMessage ?? "Apenas a pessoa responsável pelo chamado pode confirmar este pedido."}</p>
        )}
      </footer>
    </section>
  )
}
