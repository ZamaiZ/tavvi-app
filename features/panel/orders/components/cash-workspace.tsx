"use client"

import { createContext, useContext, useEffect, useMemo, useState, useTransition, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react"
import {
  LuBanknote,
  LuCheck,
  LuClock3,
  LuCreditCard,
  LuHandshake,
  LuReceiptText,
  LuRefreshCw,
  LuSearch,
  LuShoppingBag,
  LuTable2,
  LuWalletCards,
  LuWifi,
  LuWifiOff,
} from "react-icons/lu"
import type { REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { formatPaymentCents } from "@/features/panel/payments/lib/currency"
import { PANEL_PAYMENT_METHODS, type PanelPaymentMethod } from "@/features/panel/payments/model"
import { ComandaPaymentSheet } from "@/features/panel/orders/components/comanda-payment-sheet"
import type { PanelComandaDTO, PanelComandasPage } from "@/features/panel/orders/model"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

const EASE = [0.23, 1, 0.32, 1] as const
const PAGE_SIZE = 25

type CashRealtimeValue = { connected: boolean; refresh: () => void }
const CashRealtimeContext = createContext<CashRealtimeValue>({ connected: false, refresh: () => undefined })

export function CashRealtimeProvider({ restaurantId, children }: { restaurantId: string; children: ReactNode }) {
  const router = useRouter()
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let active = true
    let refreshTimer: number | null = null
    const supabase = createSupabaseBrowserClient("panel")
    const channel = supabase
      .channel(`comandas:${restaurantId}`, { config: { private: true } })
      .on("broadcast", { event: "INSERT" }, scheduleRefresh)
      .on("broadcast", { event: "UPDATE" }, scheduleRefresh)
      .on("broadcast", { event: "DELETE" }, scheduleRefresh)
      .subscribe((status: REALTIME_SUBSCRIBE_STATES) => {
        if (!active) return
        setConnected(status === "SUBSCRIBED")
        if (status === "SUBSCRIBED") router.refresh()
      })

    function scheduleRefresh() {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null
        if (active) router.refresh()
      }, 180)
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") router.refresh()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      active = false
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      void supabase.removeChannel(channel)
    }
  }, [restaurantId, router])

  const value = useMemo(() => ({ connected, refresh: () => router.refresh() }), [connected, router])
  return <CashRealtimeContext.Provider value={value}>{children}</CashRealtimeContext.Provider>
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date)
}

const methodIcons = {
  cash: LuBanknote,
  debit: LuCreditCard,
  credit: LuCreditCard,
  meal_voucher: LuWalletCards,
  food_voucher: LuWalletCards,
  partnership: LuHandshake,
}

function methodLabel(method: PanelPaymentMethod) {
  return PANEL_PAYMENT_METHODS.find((entry) => entry.value === method)?.label ?? method
}

function ComandaCard({
  comanda,
  index,
  closed,
  reducedMotion,
  onRegisterPayment,
  onClosePaid,
}: {
  comanda: PanelComandaDTO
  index: number
  closed: boolean
  reducedMotion: boolean
  onRegisterPayment: () => void
  onClosePaid: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const orderCountLabel = `${comanda.orderCount} ${comanda.orderCount === 1 ? "pedido" : "pedidos"}`
  const paid = comanda.paidCents > 0

  return (
    <motion.article
      layout={!reducedMotion}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -5 }}
      transition={{ duration: reducedMotion ? 0.12 : 0.2, delay: reducedMotion ? 0 : Math.min(index * 0.035, 0.2), ease: EASE }}
      className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-primary/20 hover:shadow-md"
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        className="group flex min-h-28 w-full items-center gap-3 p-4 text-left outline-none transition-colors hover:bg-muted/25 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:gap-5 sm:px-5"
      >
        <span className={`grid size-12 shrink-0 place-items-center rounded-2xl border sm:size-14 ${closed ? "border-border/70 bg-muted/70 text-muted-foreground" : "border-primary/15 bg-primary/[0.07] text-primary"}`}>
          {closed ? <LuCheck aria-hidden="true" className="size-5" /> : <LuTable2 aria-hidden="true" className="size-6" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold tracking-tight sm:text-lg">Mesa {comanda.tableNumber}</span>
            <Badge variant="outline" className={closed ? "h-6 gap-1.5 rounded-full border-border/70 bg-muted/40 px-2 text-[0.65rem] text-muted-foreground" : "h-6 gap-1.5 rounded-full border-emerald-500/20 bg-emerald-500/[0.06] px-2 text-[0.65rem] text-emerald-700 dark:text-emerald-300"}>
              <span aria-hidden="true" className={`size-1.5 rounded-full ${closed ? "bg-muted-foreground/60" : "bg-emerald-500"}`} />{closed ? "Encerrada" : "Aberta"}
            </Badge>
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.68rem] text-muted-foreground sm:gap-x-3 sm:text-xs">
            <span>{orderCountLabel}</span><span aria-hidden="true" className="size-1 rounded-full bg-border" />
            <span>{comanda.itemCount} {comanda.itemCount === 1 ? "item" : "itens"}</span>
            <span className="inline-flex items-center gap-1"><LuClock3 aria-hidden="true" className="size-3.5" />{closed && comanda.closedAt ? "Encerrada" : "Desde"} {formatDateTime(closed && comanda.closedAt ? comanda.closedAt : comanda.openedAt)}</span>
          </span>
        </span>
        <span className="hidden shrink-0 text-right sm:block">
          <span className="block text-[0.65rem] text-muted-foreground">{closed ? "Total pago" : "Total da comanda"}</span>
          <span className="mt-1 block text-lg font-semibold tabular-nums">R$ {formatPaymentCents(closed ? comanda.paidCents : comanda.totalCents)}</span>
        </span>
      </button>

      {closed ? (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-y border-border/60 bg-muted/15 px-4 py-2.5 text-[0.68rem] text-muted-foreground sm:px-5">
          <span className="inline-flex items-center gap-1.5"><LuReceiptText aria-hidden="true" className="size-3.5" />{comanda.payments.length} {comanda.payments.length === 1 ? "lançamento de pagamento" : "lançamentos de pagamento"}</span>
          <span>Abra para consultar formas, valores e responsável.</span>
        </div>
      ) : null}

      {!closed ? (
        <div className="grid grid-cols-3 border-y border-border/60 bg-muted/15 px-4 py-3 sm:px-5">
          <div><p className="text-[0.62rem] font-medium text-muted-foreground sm:text-[0.65rem]">Total</p><p className="mt-0.5 text-sm font-semibold tabular-nums">R$ {formatPaymentCents(comanda.totalCents)}</p></div>
          <div className="border-l border-border/60 pl-3 sm:pl-4"><p className="text-[0.62rem] font-medium text-muted-foreground sm:text-[0.65rem]">Pago</p><p className="mt-0.5 text-sm font-semibold tabular-nums">R$ {formatPaymentCents(comanda.paidCents)}</p></div>
          <div className="border-l border-border/60 pl-3 sm:pl-4"><p className="text-[0.62rem] font-medium text-muted-foreground sm:text-[0.65rem]">Em aberto</p><p className={`mt-0.5 text-sm font-semibold tabular-nums ${comanda.balanceCents === 0 ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>R$ {formatPaymentCents(comanda.balanceCents)}</p></div>
        </div>
      ) : null}

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reducedMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.12 : 0.2, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-border/70 bg-muted/15 px-4 py-4 sm:px-5 sm:py-5">
              {comanda.orders.map((order, orderIndex) => (
                <section key={order.id} className="rounded-xl border border-border/60 bg-background/80 p-3.5 sm:p-4">
                  <header className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                    <div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-primary/[0.08] text-primary"><LuShoppingBag aria-hidden="true" className="size-3.5" /></span><h3 className="text-sm font-semibold">Pedido {comanda.orders.length - orderIndex}</h3></div>
                    <span className="text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</span>
                  </header>
                  <ul className="space-y-3">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex flex-col gap-2 border-b border-border/40 pb-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-[0.65rem] font-medium text-muted-foreground">{item.categoryName}</p>
                          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2"><h4 className="text-sm font-medium">{item.quantity}× {item.itemName}</h4>{item.variantName ? <span className="text-xs text-muted-foreground">{item.variantName}</span> : null}</div>
                          {item.additions.length ? <div className="mt-2 space-y-1 border-l-2 border-primary/20 pl-2.5"><p className="text-[0.6rem] font-semibold tracking-wide text-muted-foreground uppercase">Acréscimos</p>{item.additions.map((addition) => <p key={addition.id} className="text-xs text-foreground/80">{addition.quantity > 1 ? `${addition.quantity}× ` : ""}{addition.name}<span className="ml-1 text-muted-foreground">· R$ {formatPaymentCents(addition.quantity * addition.unitPriceCents)}</span></p>)}</div> : null}
                          {item.observations ? <div className="mt-2 rounded-lg bg-muted/55 px-2.5 py-2"><p className="text-[0.6rem] font-semibold tracking-wide text-muted-foreground uppercase">Observação</p><p className="mt-0.5 text-xs leading-5 text-foreground/80">{item.observations}</p></div> : null}
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums sm:pt-3">R$ {formatPaymentCents(item.totalCents)}</span>
                      </li>
                    ))}
                  </ul>
                  <footer className="mt-3 flex justify-end border-t border-border/50 pt-2.5"><span className="text-xs text-muted-foreground">Total deste pedido <strong className="ml-2 text-sm font-semibold tabular-nums text-foreground">R$ {formatPaymentCents(order.totalCents)}</strong></span></footer>
                </section>
              ))}

              <section aria-label="Histórico de pagamentos" className="rounded-xl border border-border/60 bg-background/80 p-3.5 sm:p-4">
                <header className="mb-3 flex items-center justify-between gap-3 border-b border-border/50 pb-2.5">
                  <div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><LuReceiptText aria-hidden="true" className="size-3.5" /></span><h3 className="text-sm font-semibold">Pagamentos registrados</h3></div>
                  <span className="text-xs tabular-nums text-muted-foreground">{comanda.payments.length} {comanda.payments.length === 1 ? "lançamento" : "lançamentos"}</span>
                </header>
                {comanda.payments.length ? (
                  <ol className="space-y-3">
                    {comanda.payments.map((payment) => (
                      <li key={payment.id} className="rounded-lg border border-border/50 bg-card/70 px-3 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                          <div><p className="text-xs font-semibold">{payment.createdByName}</p><p className="mt-0.5 text-[0.68rem] text-muted-foreground">{formatDateTime(payment.createdAt)} · registro manual</p></div>
                          <p className="text-sm font-semibold tabular-nums">R$ {formatPaymentCents(payment.amountCents)}</p>
                        </div>
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {payment.splits.map((split) => {
                            const Icon = methodIcons[split.method]
                            return <li key={split.id} className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-2.5 py-1 text-[0.68rem] text-muted-foreground"><Icon aria-hidden="true" className="size-3.5" />{methodLabel(split.method)} · R$ {formatPaymentCents(split.amountCents)}</li>
                          })}
                        </ul>
                      </li>
                    ))}
                  </ol>
                ) : <p className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground">Nenhum pagamento registrado.</p>}
              </section>

              <p className="flex items-center justify-between rounded-xl bg-primary/[0.055] px-4 py-3"><span className="text-sm font-medium">Total da comanda</span><strong className="text-lg font-semibold tabular-nums">R$ {formatPaymentCents(comanda.totalCents)}</strong></p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!closed ? (
        <footer className="flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
          <p className="flex items-center gap-1.5 text-[0.68rem] text-muted-foreground"><LuReceiptText aria-hidden="true" className="size-3.5" />{paid ? `${comanda.payments.length} lançamento${comanda.payments.length === 1 ? "" : "s"} · ` : "Sem pagamentos · "}{comanda.balanceCents === 0 ? "saldo quitado" : "pagamentos parciais permitidos"}</p>
          <div className="flex gap-2">
            {comanda.balanceCents === 0 ? (
              <Button type="button" onClick={onClosePaid} className="min-h-11 flex-1 rounded-xl px-4 sm:flex-none"><LuCheck aria-hidden="true" />Encerrar comanda</Button>
            ) : (
              <Button type="button" onClick={onRegisterPayment} className="min-h-11 flex-1 rounded-xl px-4 sm:flex-none"><LuReceiptText aria-hidden="true" />Registrar pagamento</Button>
            )}
          </div>
        </footer>
      ) : null}
    </motion.article>
  )
}

export function CashWorkspace({
  initialData,
  status,
  enabledMethods,
  restaurantId,
}: {
  initialData: PanelComandasPage
  status: "open" | "closed"
  enabledMethods: PanelPaymentMethod[]
  restaurantId: string
}) {
  const reducedMotion = useReducedMotion() === true
  const { connected, refresh } = useContext(CashRealtimeContext)
  const [refreshPending, startTransition] = useTransition()
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<{ id: string; closeOnly: boolean } | null>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => setQuery(search.trim().toLocaleLowerCase("pt-BR")), 200)
    return () => window.clearTimeout(timeout)
  }, [search])

  const filteredComandas = useMemo(() => initialData.comandas.filter((comanda) => !query || String(comanda.tableNumber).includes(query)), [initialData.comandas, query])
  const selectedComanda = selected ? initialData.comandas.find((comanda) => comanda.id === selected.id) ?? null : null
  const orderCount = initialData.comandas.reduce((total, comanda) => total + comanda.orderCount, 0)
  const sumTotal = initialData.comandas.reduce((total, comanda) => total + comanda.totalCents, 0)
  const sumPaid = initialData.comandas.reduce((total, comanda) => total + comanda.paidCents, 0)
  const sumBalance = initialData.comandas.reduce((total, comanda) => total + comanda.balanceCents, 0)
  const pageCount = Math.max(1, Math.ceil(initialData.totalRows / PAGE_SIZE))
  const closed = status === "closed"

  function actionSuccess() {
    setSelected(null)
    refresh()
  }

  return (
    <MotionConfig reducedMotion="user">
      <main className="min-h-svh">
        <div className="mx-auto w-full max-w-[1320px] space-y-5 px-4 pb-32 sm:px-6 md:pb-10 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/65 px-3.5 py-2.5 text-xs shadow-sm">
            <p className="text-muted-foreground">Acompanhe as comandas, registre pagamentos e consulte encerramentos.</p>
            <span className={`inline-flex items-center gap-1.5 font-medium ${connected ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}`} role="status">
              {connected ? <LuWifi aria-hidden="true" className="size-3.5" /> : <LuWifiOff aria-hidden="true" className="size-3.5" />}
              {connected ? "Atualização ao vivo ativa" : "Atualização automática"}
            </span>
          </div>

          <section aria-label="Resumo do caixa" className="grid gap-3 sm:grid-cols-3">
            <Card className="rounded-2xl border-border/70 bg-gradient-to-br from-primary/[0.08] via-card to-card shadow-sm"><CardContent className="flex items-center justify-between gap-3 p-4 sm:p-5"><div><p className="text-xs font-medium text-muted-foreground">{closed ? "Comandas encerradas" : "Comandas abertas"}</p><p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{closed ? initialData.totalRows : initialData.comandas.length}</p></div><span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><LuTable2 aria-hidden="true" className="size-5" /></span></CardContent></Card>
            <Card className="rounded-2xl border-border/70 bg-card shadow-sm"><CardContent className="flex items-center justify-between gap-3 p-4 sm:p-5"><div><p className="text-xs font-medium text-muted-foreground">{closed ? "Recebido nesta página" : "Pedidos registrados"}</p><p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{closed ? `R$ ${formatPaymentCents(sumPaid)}` : orderCount}</p></div><span className="grid size-11 place-items-center rounded-2xl bg-muted text-foreground/75"><LuShoppingBag aria-hidden="true" className="size-5" /></span></CardContent></Card>
            <Card className="rounded-2xl border-border/70 bg-card shadow-sm"><CardContent className="flex items-center justify-between gap-3 p-4 sm:p-5"><div><p className="text-xs font-medium text-muted-foreground">{closed ? "Total das comandas desta página" : "Saldo em aberto"}</p><p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">R$ {formatPaymentCents(closed ? sumTotal : sumBalance)}</p></div><span className={`grid size-11 place-items-center rounded-2xl ${closed ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}><LuReceiptText aria-hidden="true" className="size-5" /></span></CardContent></Card>
          </section>

          <section aria-label="Lista de comandas" className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <nav aria-label="Situação das comandas" className="inline-grid w-full grid-cols-2 rounded-xl border border-border/70 bg-muted/40 p-1 sm:w-auto">
                <Link href="?status=open" aria-current={!closed ? "page" : undefined} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none ${!closed ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><LuTable2 aria-hidden="true" className="size-4" />Abertas</Link>
                <Link href="?status=closed&page=1" aria-current={closed ? "page" : undefined} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none ${closed ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><LuCheck aria-hidden="true" className="size-4" />Encerradas</Link>
              </nav>
              <div className="relative w-full sm:w-64"><LuSearch aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar mesa" aria-label="Buscar mesa" inputMode="numeric" className="h-10 rounded-xl bg-background pl-10" /></div>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h2 className="text-base font-semibold tracking-tight">{closed ? "Comandas encerradas" : "Comandas abertas"}</h2><p className="mt-0.5 text-xs text-muted-foreground">{closed ? "Pagamentos e detalhes continuam disponíveis para consulta." : "Os pedidos de cada mesa aparecem agrupados aqui."}</p></div>
              <Button type="button" variant="outline" disabled={refreshPending} onClick={() => startTransition(() => refresh())} className="min-h-10 rounded-xl px-3"><LuRefreshCw aria-hidden="true" className={refreshPending ? "size-4 animate-spin motion-reduce:animate-none" : "size-4"} />Atualizar</Button>
            </div>

            {filteredComandas.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                <AnimatePresence initial={false} mode="popLayout">
                  {filteredComandas.map((comanda, index) => <ComandaCard key={comanda.id} comanda={comanda} index={index} closed={closed} reducedMotion={reducedMotion} onRegisterPayment={() => setSelected({ id: comanda.id, closeOnly: false })} onClosePaid={() => setSelected({ id: comanda.id, closeOnly: true })} />)}
                </AnimatePresence>
              </div>
            ) : (
              <motion.div initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-dashed border-border/80 bg-card/55 px-5 py-12 text-center sm:px-8">
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/[0.08] text-primary"><LuReceiptText aria-hidden="true" className="size-5" /></span>
                <h3 className="mt-4 text-base font-semibold tracking-tight">{initialData.comandas.length ? "Nenhuma mesa encontrada" : closed ? "Ainda não há comandas encerradas" : "Ainda não há comandas abertas"}</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{initialData.comandas.length ? "Confira o número da mesa e tente novamente." : closed ? "As comandas encerradas e seus pagamentos aparecerão aqui para consulta." : "Quando um pedido for confirmado em Chamados, a comanda da mesa aparecerá aqui."}</p>
                {initialData.comandas.length ? <Button type="button" variant="outline" onClick={() => setSearch("")} className="mt-4 min-h-10 rounded-xl">Limpar pesquisa</Button> : null}
              </motion.div>
            )}

            {closed && pageCount > 1 ? (
              <nav aria-label="Paginação de comandas encerradas" className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">Página <strong className="text-foreground">{initialData.page}</strong> de <strong className="text-foreground">{pageCount}</strong> · {initialData.totalRows} comandas</p>
                <div className="flex gap-2">
                  <Link aria-disabled={initialData.page <= 1} tabIndex={initialData.page <= 1 ? -1 : undefined} href={`?status=closed&page=${Math.max(1, initialData.page - 1)}`} className={`inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-border/70 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none ${initialData.page <= 1 ? "pointer-events-none opacity-45" : "hover:bg-muted/60"}`}>Anterior</Link>
                  <Link aria-disabled={initialData.page >= pageCount} tabIndex={initialData.page >= pageCount ? -1 : undefined} href={`?status=closed&page=${Math.min(pageCount, initialData.page + 1)}`} className={`inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-border/70 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none ${initialData.page >= pageCount ? "pointer-events-none opacity-45" : "hover:bg-muted/60"}`}>Próxima</Link>
                </div>
              </nav>
            ) : null}
          </section>
        </div>
      </main>

      {selectedComanda ? (
        <ComandaPaymentSheet
          key={`${selectedComanda.id}:${selected?.closeOnly ? "close" : "payment"}`}
          open
          onOpenChange={(nextOpen) => { if (!nextOpen) setSelected(null) }}
          comanda={selectedComanda}
          expectedRestaurantId={restaurantId}
          enabledMethods={enabledMethods}
          closeOnly={selected?.closeOnly === true}
          onRefresh={refresh}
          onSuccess={actionSuccess}
        />
      ) : null}
    </MotionConfig>
  )
}
