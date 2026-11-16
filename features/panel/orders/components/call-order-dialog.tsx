"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react"
import {
  LuBell,
  LuCheck,
  LuLoaderCircle,
  LuSearch,
  LuShoppingBag,
  LuX,
} from "react-icons/lu"
import Link from "next/link"

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { PanelServiceCallDTO } from "@/features/panel/calls/model"
import { resolveServiceCallAction } from "@/features/panel/calls/actions"
import type { PanelMenuDTO, MenuCategoryDTO, MenuItemDTO } from "@/features/panel/menu/model"
import { formatMenuPriceCents } from "@/features/panel/menu/lib/currency"
import { OrderItemComposer } from "@/features/panel/orders/components/order-item-composer"
import { OrderMenuCatalog } from "@/features/panel/orders/components/order-menu-catalog"
import { OrderSummary, type OrderFeedback } from "@/features/panel/orders/components/order-summary"
import { recordPanelOrderAction } from "@/features/panel/orders/actions"
import type { OrderDraftLine } from "@/features/panel/orders/model"
import { getOrderTotalCents } from "@/features/panel/orders/lib/order-total"

const EASE = [0.23, 1, 0.32, 1] as const

function callFailureMessage(code: string) {
  if (code === "session_expired") return "Sua sessão expirou. Entre novamente para registrar o pedido."
  if (code === "context_changed") return "O restaurante ativo mudou. Atualize a página para continuar."
  if (code === "forbidden") return "Sua conta não tem acesso a este restaurante."
  if (code === "not_assignee") return "Somente a pessoa que assumiu este chamado pode registrar o pedido."
  if (code === "call_not_found" || code === "call_conflict") return "Este chamado mudou de estado. Atualize a fila antes de continuar."
  if (code === "item_not_available" || code === "variant_not_available") return "Um item ou uma variação ficou indisponível. Revise o pedido e tente novamente."
  if (code === "variant_required") return "Escolha uma variação para cada item que exige essa seleção."
  if (code === "request_conflict") return "Este envio já foi associado a outro pedido. Reabra o chamado para continuar."
  return "Não foi possível registrar o pedido. Confira a conexão e tente novamente."
}

function dateLabel(isoDate: string) {
  return new Date(isoDate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

function catalogCategories(menu: PanelMenuDTO): MenuCategoryDTO[] {
  return menu.categories
}

export function CallOrderDialog({
  open,
  call,
  restaurantId,
  viewerId,
  menu,
  cardapioHref,
  onOpenChange,
  onRefresh,
}: {
  open: boolean
  call: PanelServiceCallDTO
  restaurantId: string
  viewerId: string
  menu: PanelMenuDTO
  cardapioHref: string
  onOpenChange: (open: boolean) => void
  onRefresh: () => Promise<unknown>
}) {
  const reducedMotion = useReducedMotion() === true
  const categories = useMemo(() => catalogCategories(menu), [menu])
  const catalogHasItems = categories.some((category) => category.items.length > 0)
  const [activeCategory, setActiveCategory] = useState("all")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [items, setItems] = useState<OrderDraftLine[]>([])
  const [composer, setComposer] = useState<{ item: MenuItemDTO; categoryName: string } | null>(null)
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false)
  const [feedback, setFeedback] = useState<OrderFeedback | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [retryPending, setRetryPending] = useState(false)
  const [closeConfirmationOpen, setCloseConfirmationOpen] = useState(false)
  const [resolveConfirmationOpen, setResolveConfirmationOpen] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const requestId = useRef<string | null>(null)
  const isAssignee = call.status === "in_progress" && call.claimedBy === viewerId
  const canEdit = isAssignee && !retryPending
  const cartFull = items.length >= 100
  const totalCents = getOrderTotalCents(items)
  const totalQuantity = items.reduce((total, item) => total + item.quantity, 0)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim().toLocaleLowerCase("pt-BR")), 250)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    if (!categories.some((category) => category.id === activeCategory) && activeCategory !== "all") {
      setActiveCategory("all")
    }
  }, [activeCategory, categories])

  const filteredCategories = useMemo(() => {
    return categories
      .filter((category) => activeCategory === "all" || category.id === activeCategory)
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => {
          if (!debouncedSearch) return true
          const searchText = `${item.name} ${item.description} ${category.name}`.toLocaleLowerCase("pt-BR")
          return searchText.includes(debouncedSearch)
        }),
      }))
      .filter((category) => category.items.length > 0)
  }, [activeCategory, categories, debouncedSearch])

  function addLine(line: OrderDraftLine) {
    if (items.length >= 100) {
      setFeedback({ kind: "error", text: "Este pedido já atingiu o limite de 100 itens. Confirme o pedido antes de adicionar mais." })
      return
    }
    setItems((current) => [...current, line])
    setFeedback(null)
    setMobileSummaryOpen(false)
  }

  function updateQuantity(lineId: string, quantity: number) {
    setItems((current) => current.map((line) => line.lineId === lineId ? { ...line, quantity: Math.max(1, Math.min(99, quantity)) } : line))
    setFeedback(null)
  }

  function removeLine(lineId: string) {
    setItems((current) => current.filter((line) => line.lineId !== lineId))
    setFeedback(null)
  }

  function requestClose() {
    if (submitting) {
      setFeedback({ kind: "error", text: "Aguarde a confirmação deste envio antes de fechar o pedido." })
      setMobileSummaryOpen(true)
      return
    }
    if (retryPending) {
      setFeedback({ kind: "error", text: "O envio pode ter sido recebido. Tente novamente para confirmar o mesmo pedido antes de sair." })
      setMobileSummaryOpen(true)
      return
    }
    if (items.length > 0) {
      setCloseConfirmationOpen(true)
      return
    }
    onOpenChange(false)
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(true)
      return
    }
    requestClose()
  }

  const submitOrder = useCallback(async () => {
    if (!items.length || !isAssignee || submitting) return
    if (!requestId.current) requestId.current = globalThis.crypto.randomUUID()
    const thisRequestId = requestId.current
    setSubmitting(true)
    setFeedback(null)
    try {
      const result = await recordPanelOrderAction({
        expectedRestaurantId: restaurantId,
        callId: call.id,
        requestId: thisRequestId,
        items: items.map(({ menuItemId, variantId, quantity, observations, additions }) => ({ menuItemId, variantId, quantity, observations, additions })),
      })
      if (result.ok) {
        requestId.current = null
        setRetryPending(false)
        setItems([])
        setFeedback({ kind: "success", text: `Pedido de R$ ${formatMenuPriceCents(result.data.totalCents)} registrado. Comanda da mesa ${call.tableNumber} atualizada.` })
        void onRefresh().catch(() => undefined)
        return
      }

      const uncertain = result.code === "unavailable" || result.code === "database_error"
      setRetryPending(uncertain)
      if (!uncertain) requestId.current = null
      setFeedback({ kind: "error", text: callFailureMessage(result.code) })
      if (result.code === "call_conflict" || result.code === "call_not_found") void onRefresh().catch(() => undefined)
    } catch {
      setRetryPending(true)
      setFeedback({ kind: "error", text: "A conexão foi interrompida. Tente reenviar para confirmar este mesmo pedido." })
    } finally {
      setSubmitting(false)
    }
  }, [call.id, call.tableNumber, isAssignee, items, onRefresh, restaurantId, submitting])

  async function resolveCall() {
    if (!isAssignee || items.length > 0 || resolving) return
    setResolving(true)
    setResolveError(null)
    try {
      const result = await resolveServiceCallAction({ expectedRestaurantId: restaurantId, callId: call.id })
      if (result.ok) {
        setResolveConfirmationOpen(false)
        onOpenChange(false)
        void onRefresh().catch(() => undefined)
      } else {
        setResolveError(result.code === "not_assignee"
          ? "Somente a pessoa responsável pode concluir este chamado."
          : result.code === "session_expired"
          ? "Sua sessão expirou. Entre novamente para continuar."
          : result.code === "resolve_conflict"
          ? "Este atendimento já foi encerrado ou mudou de estado. A lista foi sincronizada."
          : "Não foi possível concluir o atendimento. Atualize os chamados e tente novamente.")
        if (result.code === "resolve_conflict") void onRefresh().catch(() => undefined)
      }
    } catch {
      setResolveError("A conexão falhou. O estado do atendimento será sincronizado novamente.")
      void onRefresh().catch(() => undefined)
    } finally {
      setResolving(false)
    }
  }

  function confirmDiscard() {
    setCloseConfirmationOpen(false)
    setItems([])
    setFeedback(null)
    onOpenChange(false)
  }

  const itemCountLabel = `${totalQuantity} ${totalQuantity === 1 ? "item" : "itens"}`

  return (
    <MotionConfig reducedMotion="user">
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="!fixed !inset-0 !top-0 !left-0 !h-dvh !w-screen !max-w-none !translate-x-0 !translate-y-0 !gap-0 !rounded-none !p-0 !ring-0 overflow-hidden bg-background text-foreground duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.99] data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.99] motion-reduce:duration-0"
        >
          <DialogTitle className="sr-only">Pedido da mesa {call.tableNumber}</DialogTitle>
          <DialogDescription className="sr-only">Escolha itens do cardápio e registre o pedido da mesa.</DialogDescription>

          <div className="relative flex h-full min-h-0 flex-col bg-background">
            <header className="relative z-10 flex shrink-0 items-center gap-3 border-b border-border/70 bg-background/95 px-3 pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5 backdrop-blur-xl sm:px-6 sm:py-3">
              <Button type="button" variant="ghost" size="icon" aria-label="Fechar pedido" onClick={requestClose} className="size-11 shrink-0 rounded-xl">
                <LuX aria-hidden="true" className="size-5" />
              </Button>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">Mesa {call.tableNumber}</h1>
                  <Badge variant="outline" className="hidden h-6 shrink-0 gap-1.5 rounded-full border-emerald-500/25 bg-emerald-500/[0.07] px-2 text-[0.65rem] text-emerald-700 sm:inline-flex dark:text-emerald-300"><LuCheck aria-hidden="true" className="size-3" />Em atendimento</Badge>
                </div>
                <p className="mt-0.5 truncate text-[0.68rem] text-muted-foreground">Chamado aberto às {dateLabel(call.createdAt)}{call.claimedAt ? ` · assumido às ${dateLabel(call.claimedAt)}` : ""}</p>
              </div>
              <div className="hidden items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2 sm:flex">
                <LuBell aria-hidden="true" className="size-4 text-primary" />
                <span className="text-xs font-medium">Atendimento em andamento</span>
              </div>
              {isAssignee ? <Button type="button" variant="outline" disabled={items.length > 0 || resolving} onClick={() => setResolveConfirmationOpen(true)} className="hidden min-h-10 shrink-0 rounded-xl px-3 text-xs lg:inline-flex"><LuCheck aria-hidden="true" />Encerrar</Button> : null}
              <Button type="button" variant="outline" onClick={() => setMobileSummaryOpen(true)} className="min-h-10 shrink-0 gap-2 rounded-xl px-3 lg:hidden">
                <LuShoppingBag aria-hidden="true" className="size-4" />
                <span className="text-xs font-semibold">Pedido</span>
                {totalQuantity > 0 ? <Badge variant="secondary" className="h-5 min-w-5 justify-center rounded-full px-1 text-[0.6rem] tabular-nums">{totalQuantity}</Badge> : null}
              </Button>
            </header>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(21rem,27rem)]">
              <section aria-label="Cardápio para pedido" className="flex min-h-0 min-w-0 flex-col">
                <div className="shrink-0 space-y-3 border-b border-border/60 px-4 py-3 sm:px-6 sm:py-4">
                  <div className="flex items-center gap-3">
                    <div className="relative min-w-0 flex-1">
                      <LuSearch aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar no cardápio" aria-label="Buscar itens do cardápio" className="h-11 rounded-xl border-border/70 bg-card/85 pl-10 pr-10 text-sm shadow-sm focus-visible:ring-primary/25" />
                      {search ? <Button type="button" variant="ghost" size="icon" aria-label="Limpar pesquisa" onClick={() => setSearch("")} className="absolute top-1/2 right-1 -translate-y-1/2 size-9 rounded-lg text-muted-foreground"><LuX aria-hidden="true" className="size-4" /></Button> : null}
                    </div>
                    <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:block">{filteredCategories.reduce((total, category) => total + category.items.length, 0)} opções</span>
                  </div>

                  {catalogHasItems ? (
                    <Tabs value={activeCategory} onValueChange={setActiveCategory} aria-label="Filtrar itens por categoria" className="min-w-0">
                      <TabsList className="h-10 max-w-full justify-start gap-1 overflow-x-auto rounded-xl bg-muted/55 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <TabsTrigger value="all" className="h-8 flex-none rounded-lg px-3 text-xs data-active:bg-background data-active:shadow-sm">Tudo</TabsTrigger>
                        {categories.map((category) => <TabsTrigger key={category.id} value={category.id} className="h-8 max-w-52 flex-none rounded-lg px-3 text-xs data-active:bg-background data-active:shadow-sm"><span className="truncate">{category.name}</span>{!category.isVisible ? <span className="text-[0.6rem] text-muted-foreground">oculta</span> : null}</TabsTrigger>)}
                      </TabsList>
                    </Tabs>
                  ) : null}
                </div>

                <div className="relative min-h-0 flex-1">
                  <AnimatePresence mode="wait" initial={false}>
                    {composer ? (
                      <OrderItemComposer key={composer.item.id} item={composer.item} categoryName={composer.categoryName} canEdit={canEdit} onClose={() => setComposer(null)} onAdd={addLine} />
                    ) : filteredCategories.length ? (
                      <motion.div key={`${activeCategory}:${debouncedSearch}`} initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: reducedMotion ? 0.12 : 0.18, ease: EASE }} className="absolute inset-0">
                        <OrderMenuCatalog
                          categories={filteredCategories}
                          reducedMotion={reducedMotion}
                          canSelect={!retryPending && !cartFull}
                          onSelectItem={(item, categoryName) => { setFeedback(null); setComposer({ item, categoryName }) }}
                        />
                      </motion.div>
                    ) : (
                      <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid h-full place-items-center overflow-y-auto px-5 py-8 text-center">
                        <div className="max-w-sm">
                          <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-border/70 bg-card text-muted-foreground shadow-sm"><LuSearch aria-hidden="true" className="size-5" /></span>
                          <h2 className="mt-4 text-base font-semibold tracking-tight">{catalogHasItems ? activeCategory !== "all" && !debouncedSearch ? "Esta categoria ainda não tem itens" : "Nenhum item encontrado" : "Seu cardápio ainda não tem itens"}</h2>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{catalogHasItems ? "Tente outro termo ou escolha uma categoria diferente." : "Adicione itens ao cardápio para começar a registrar pedidos."}</p>
                          {catalogHasItems ? <Button type="button" variant="outline" onClick={() => { setSearch(""); setActiveCategory("all") }} className="mt-4 min-h-10 rounded-xl">Limpar filtros</Button> : <Link href={cardapioHref} className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:bg-muted">Abrir criação do cardápio</Link>}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {retryPending ? <div role="status" className="shrink-0 border-t border-amber-500/20 bg-amber-500/[0.06] px-4 py-2.5 text-center text-xs text-amber-800 dark:text-amber-200">Reenvie o pedido para confirmar o mesmo registro. O carrinho está bloqueado para evitar duplicidade.</div> : cartFull ? <div role="status" className="shrink-0 border-t border-amber-500/20 bg-amber-500/[0.06] px-4 py-2.5 text-center text-xs text-amber-800 dark:text-amber-200">Limite de 100 itens atingido. Confirme este pedido para continuar.</div> : null}
              </section>

              <aside className="hidden min-h-0 border-l border-border/70 bg-muted/20 lg:flex">
                <OrderSummary
                  items={items}
                  canEdit={canEdit}
                  canConfirm={isAssignee}
                  submitting={submitting}
                  confirmLabel={retryPending ? "Tentar envio novamente" : "Confirmar pedido"}
                  lockedMessage={retryPending ? "O carrinho está protegido até confirmarmos o envio." : undefined}
                  feedback={feedback}
                  onQuantityChange={updateQuantity}
                  onRemove={removeLine}
                  onConfirm={() => void submitOrder()}
                />
              </aside>
            </div>

            {!isAssignee ? <div role="status" className="shrink-0 border-t border-amber-500/20 bg-amber-500/[0.06] px-4 py-2.5 text-center text-xs text-amber-800 dark:text-amber-200">Você pode consultar o cardápio. Só quem assumiu este chamado pode registrar o pedido.</div> : null}
            <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border/70 bg-background/95 px-4 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-6 lg:hidden">
              <div className="min-w-0"><p className="text-[0.65rem] text-muted-foreground">{itemCountLabel}</p><p className="truncate text-base font-semibold tabular-nums">R$ {formatMenuPriceCents(totalCents)}</p></div>
              <div className="flex shrink-0 items-center gap-2">
                {isAssignee ? <Button type="button" variant="outline" disabled={items.length > 0 || resolving} onClick={() => setResolveConfirmationOpen(true)} className="min-h-11 rounded-xl px-3 text-xs">{resolving ? <LuLoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <LuCheck aria-hidden="true" />}Concluir</Button> : null}
                <Button type="button" disabled={!items.length} onClick={() => setMobileSummaryOpen(true)} className="min-h-11 min-w-36 rounded-xl px-3 font-semibold shadow-sm"><LuShoppingBag aria-hidden="true" />Revisar pedido{totalQuantity ? <Badge className="ml-1 h-5 min-w-5 justify-center rounded-full bg-primary-foreground/20 px-1 text-[0.6rem] text-primary-foreground">{totalQuantity}</Badge> : null}</Button>
              </div>
            </footer>

            <AnimatePresence>
              {mobileSummaryOpen ? (
                <motion.div key="mobile-summary" initial={{ opacity: 0, y: reducedMotion ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reducedMotion ? 0 : 8 }} transition={{ duration: reducedMotion ? 0.12 : 0.18, ease: EASE }} className="absolute inset-0 z-40 flex bg-background lg:hidden">
                  <OrderSummary
                    items={items}
                    canEdit={canEdit}
                    canConfirm={isAssignee}
                    submitting={submitting}
                    confirmLabel={retryPending ? "Tentar envio novamente" : "Confirmar pedido"}
                    lockedMessage={retryPending ? "O carrinho está protegido até confirmarmos o envio." : undefined}
                    feedback={feedback}
                    showBackButton
                    showCloseButton
                    onBack={() => setMobileSummaryOpen(false)}
                    onClose={requestClose}
                    onQuantityChange={updateQuantity}
                    onRemove={removeLine}
                    onConfirm={() => void submitOrder()}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>

          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={closeConfirmationOpen} onOpenChange={setCloseConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar o pedido em andamento?</AlertDialogTitle>
            <AlertDialogDescription>Os {items.length} itens que você adicionou ainda não foram enviados para a comanda.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-10 rounded-xl">Continuar pedido</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDiscard} className="min-h-10 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">Descartar e fechar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resolveConfirmationOpen} onOpenChange={setResolveConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar o atendimento da mesa {call.tableNumber}?</AlertDialogTitle>
            <AlertDialogDescription>A comanda continua disponível no Caixa. Você pode reabrir o atendimento gerando um novo chamado na mesa.</AlertDialogDescription>
          </AlertDialogHeader>
          {resolveError ? <p role="alert" className="rounded-xl bg-destructive/[0.06] px-3 py-2 text-xs leading-5 text-destructive">{resolveError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resolving} className="min-h-10 rounded-xl">Voltar</AlertDialogCancel>
            <AlertDialogAction disabled={resolving} onClick={(event) => { event.preventDefault(); void resolveCall() }} className="min-h-10 rounded-xl">
              {resolving ? <LuLoaderCircle aria-hidden="true" className="animate-spin" /> : null}{resolving ? "Encerrando…" : "Encerrar atendimento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MotionConfig>
  )
}
