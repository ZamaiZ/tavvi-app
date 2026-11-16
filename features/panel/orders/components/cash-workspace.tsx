"use client"

import { createContext, useContext, useEffect, useMemo, useState, useTransition, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react"
import { LuClock3, LuLoaderCircle, LuReceiptText, LuRefreshCw, LuSearch, LuShoppingBag, LuTable2, LuWifi, LuWifiOff } from "react-icons/lu"
import type { REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { formatMenuPriceCents } from "@/features/panel/menu/lib/currency"
import type { PanelComandaDTO } from "@/features/panel/orders/model"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

const EASE = [0.23, 1, 0.32, 1] as const

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

function ComandaCard({ comanda, index, reducedMotion }: { comanda: PanelComandaDTO; index: number; reducedMotion: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const orderCountLabel = `${comanda.orderCount} ${comanda.orderCount === 1 ? "pedido" : "pedidos"}`

  return (
    <motion.article
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0.12 : 0.2, delay: reducedMotion ? 0 : Math.min(index * 0.035, 0.2), ease: EASE }}
      className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-primary/20 hover:shadow-md"
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        className="group flex min-h-28 w-full items-center gap-4 p-4 text-left outline-none transition-colors hover:bg-muted/25 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:gap-5 sm:px-5"
      >
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-primary/15 bg-primary/[0.07] text-primary sm:size-16">
          <LuTable2 aria-hidden="true" className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">Mesa {comanda.tableNumber}</span>
            <Badge variant="outline" className="h-6 gap-1.5 rounded-full border-emerald-500/20 bg-emerald-500/[0.06] px-2 text-[0.65rem] text-emerald-700 dark:text-emerald-300"><span className="size-1.5 rounded-full bg-emerald-500" />Aberta</Badge>
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{orderCountLabel}</span><span aria-hidden="true" className="size-1 rounded-full bg-border" />
            <span>{comanda.itemCount} {comanda.itemCount === 1 ? "item" : "itens"}</span>
            <span className="inline-flex items-center gap-1"><LuClock3 aria-hidden="true" className="size-3.5" />Desde {formatDateTime(comanda.openedAt)}</span>
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[0.65rem] text-muted-foreground">Total da comanda</span>
          <span className="mt-1 block text-lg font-semibold tabular-nums sm:text-xl">R$ {formatMenuPriceCents(comanda.totalCents)}</span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
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
                          {item.additions.length ? <div className="mt-2 space-y-1 border-l-2 border-primary/20 pl-2.5"><p className="text-[0.6rem] font-semibold tracking-wide text-muted-foreground uppercase">Acréscimos</p>{item.additions.map((addition) => <p key={addition.id} className="text-xs text-foreground/80">{addition.quantity > 1 ? `${addition.quantity}× ` : ""}{addition.name}<span className="ml-1 text-muted-foreground">· R$ {formatMenuPriceCents(addition.quantity * addition.unitPriceCents)}</span></p>)}</div> : null}
                          {item.observations ? <div className="mt-2 rounded-lg bg-muted/55 px-2.5 py-2"><p className="text-[0.6rem] font-semibold tracking-wide text-muted-foreground uppercase">Observação</p><p className="mt-0.5 text-xs leading-5 text-foreground/80">{item.observations}</p></div> : null}
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums sm:pt-3">R$ {formatMenuPriceCents(item.totalCents)}</span>
                      </li>
                    ))}
                  </ul>
                  <footer className="mt-3 flex justify-end border-t border-border/50 pt-2.5"><span className="text-xs text-muted-foreground">Total deste pedido <strong className="ml-2 text-sm font-semibold tabular-nums text-foreground">R$ {formatMenuPriceCents(order.totalCents)}</strong></span></footer>
                </section>
              ))}
              <p className="flex items-center justify-between rounded-xl bg-primary/[0.055] px-4 py-3"><span className="text-sm font-medium">Total da comanda</span><strong className="text-lg font-semibold tabular-nums">R$ {formatMenuPriceCents(comanda.totalCents)}</strong></p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  )
}

export function CashWorkspace({ initialComandas }: { initialComandas: PanelComandaDTO[] }) {
  const reducedMotion = useReducedMotion() === true
  const { connected, refresh } = useContext(CashRealtimeContext)
  const [refreshPending, startTransition] = useTransition()
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")

  useEffect(() => {
    const timeout = window.setTimeout(() => setQuery(search.trim().toLocaleLowerCase("pt-BR")), 200)
    return () => window.clearTimeout(timeout)
  }, [search])

  const filteredComandas = useMemo(() => initialComandas.filter((comanda) => !query || String(comanda.tableNumber).includes(query)), [initialComandas, query])
  const orderCount = initialComandas.reduce((total, comanda) => total + comanda.orderCount, 0)
  const totalCents = initialComandas.reduce((total, comanda) => total + comanda.totalCents, 0)

  return (
    <MotionConfig reducedMotion="user">
      <main className="min-h-svh">
        <div className="mx-auto w-full max-w-[1320px] space-y-5 px-4 pb-32 sm:px-6 md:pb-10 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/75 px-3.5 py-2.5 shadow-sm sm:px-4">
            <div className="flex items-center gap-2.5"><span className={`size-2 rounded-full ${connected ? "bg-emerald-500 shadow-[0_0_0_3px] shadow-emerald-500/10" : "bg-muted-foreground/45"}`} /><p className="text-xs font-medium text-muted-foreground">{connected ? "Atualizado em tempo real" : "Sincronização ao abrir a página"}</p></div>
            <div className="flex items-center gap-1.5"><span className="hidden items-center gap-1.5 text-[0.65rem] text-muted-foreground sm:inline-flex">{connected ? <LuWifi aria-hidden="true" className="size-3.5" /> : <LuWifiOff aria-hidden="true" className="size-3.5" />}Comandas das mesas atuais</span><Button type="button" variant="ghost" size="sm" onClick={() => startTransition(refresh)} disabled={refreshPending} aria-label="Atualizar comandas" title="Atualizar comandas agora" className="min-h-9 rounded-lg px-2.5 text-xs">{refreshPending ? <LuLoaderCircle aria-hidden="true" className="size-3.5 animate-spin motion-reduce:animate-none" /> : <LuRefreshCw aria-hidden="true" className="size-3.5" />}<span className="sm:hidden">{refreshPending ? "Atualizando" : "Atualizar"}</span></Button></div>
          </div>

          <section aria-label="Resumo do caixa" className="grid gap-3 sm:grid-cols-3">
            <Card className="rounded-2xl border-border/70 bg-gradient-to-br from-primary/[0.08] via-card to-card shadow-sm"><CardContent className="flex items-center justify-between gap-3 p-4 sm:p-5"><div><p className="text-xs font-medium text-muted-foreground">Mesas com comanda aberta</p><p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{initialComandas.length}</p></div><span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><LuTable2 aria-hidden="true" className="size-5" /></span></CardContent></Card>
            <Card className="rounded-2xl border-border/70 bg-card shadow-sm"><CardContent className="flex items-center justify-between gap-3 p-4 sm:p-5"><div><p className="text-xs font-medium text-muted-foreground">Pedidos registrados</p><p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{orderCount}</p></div><span className="grid size-11 place-items-center rounded-2xl bg-muted text-foreground/75"><LuShoppingBag aria-hidden="true" className="size-5" /></span></CardContent></Card>
            <Card className="rounded-2xl border-border/70 bg-card shadow-sm"><CardContent className="flex items-center justify-between gap-3 p-4 sm:p-5"><div><p className="text-xs font-medium text-muted-foreground">Total nas comandas</p><p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">R$ {formatMenuPriceCents(totalCents)}</p></div><span className="grid size-11 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><LuReceiptText aria-hidden="true" className="size-5" /></span></CardContent></Card>
          </section>

          <section aria-labelledby="cash-tables-heading" className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h2 id="cash-tables-heading" className="text-base font-semibold tracking-tight">Comandas abertas</h2><p className="mt-0.5 text-xs text-muted-foreground">Os pedidos de cada mesa aparecem agrupados aqui.</p></div>
              <div className="relative w-full sm:w-64"><LuSearch aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar mesa" aria-label="Buscar mesa" inputMode="numeric" className="h-10 rounded-xl bg-background pl-10" /></div>
            </div>

            {filteredComandas.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                <AnimatePresence initial={false} mode="popLayout">
                  {filteredComandas.map((comanda, index) => <ComandaCard key={comanda.id} comanda={comanda} index={index} reducedMotion={reducedMotion} />)}
                </AnimatePresence>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0, y: reducedMotion ? 0 : 5 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-dashed border-border/80 bg-card/55 px-5 py-12 text-center sm:px-8">
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/[0.08] text-primary"><LuReceiptText aria-hidden="true" className="size-5" /></span>
                <h3 className="mt-4 text-base font-semibold tracking-tight">{initialComandas.length ? "Nenhuma mesa encontrada" : "Ainda não há comandas abertas"}</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{initialComandas.length ? "Confira o número da mesa e tente novamente." : "Quando um pedido for confirmado em Chamados, a comanda da mesa aparecerá aqui."}</p>
                {initialComandas.length ? <Button type="button" variant="outline" onClick={() => setSearch("")} className="mt-4 min-h-10 rounded-xl">Limpar pesquisa</Button> : null}
              </motion.div>
            )}
          </section>
        </div>
      </main>
    </MotionConfig>
  )
}
