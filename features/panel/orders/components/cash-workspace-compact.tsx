"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LuBanknote, LuCheck, LuClock3, LuLoaderCircle, LuPackage, LuPlus, LuReceiptText, LuSearch, LuShoppingBag, LuTable2 } from "react-icons/lu"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { formatPaymentCents } from "@/features/panel/payments/lib/currency"
import { getPanelPaymentOptions, type PanelPaymentConfiguration } from "@/features/panel/payments/model"
import { ComandaConsumptionDialog } from "@/features/panel/orders/components/comanda-consumption-dialog"
import { ComandaPaymentDialog } from "@/features/panel/orders/components/comanda-payment-dialog"
import { CounterOrderDialog } from "@/features/panel/orders/components/counter-order-dialog"
import { getPanelComandaDetailAction, getPanelCounterOrderMenuAction } from "@/features/panel/orders/actions"
import type { PanelComandaDTO, PanelComandaSummaryDTO, PanelComandasPage } from "@/features/panel/orders/model"
import type { PanelCashStateDTO } from "@/features/panel/cash/model"
import type { PanelMenuDTO } from "@/features/panel/menu/model"

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
}

function locationLabel(comanda: PanelComandaSummaryDTO) {
  if (comanda.tableNumber !== null) return `Mesa ${comanda.tableNumber}`
  if (comanda.latestOrder?.displayNumber !== null && comanda.latestOrder?.displayNumber !== undefined) return `Balcão #${comanda.latestOrder.displayNumber}`
  return "Comanda de balcão"
}

function statusLabel(status: PanelComandaSummaryDTO["status"]) {
  return status === "open" ? "Aberta" : status === "pending" ? "Em liquidação" : "Encerrada"
}

function SummaryCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof LuTable2 }) {
  return <Card className="rounded-2xl border-border/70 bg-card shadow-sm"><CardContent className="flex min-h-24 items-center justify-between gap-3 p-4 sm:px-5">
    <div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 truncate text-2xl font-semibold tracking-tight tabular-nums">{value}</p><p className="mt-0.5 text-[0.68rem] text-muted-foreground">{detail}</p></div>
    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon aria-hidden="true" className="size-5" /></span>
  </CardContent></Card>
}

function ComandaDetails({ comanda }: { comanda: PanelComandaDTO }) {
  return <div className="space-y-3 border-t border-border/60 bg-muted/10 px-4 py-4 sm:px-5">
    {comanda.orders.map((order, index) => <section key={order.id} className="rounded-xl border border-border/60 bg-background/80 p-3.5">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary"><LuShoppingBag aria-hidden="true" className="size-3.5" /></span><h3 className="text-sm font-semibold">{order.displayNumber !== null ? `Pedido #${order.displayNumber}` : `Pedido ${comanda.orders.length - index}`}</h3></div><span className="text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</span></header>
      <ul className="divide-y divide-border/50">{order.items.map((item) => <li key={item.id} className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0"><div className="min-w-0"><p className="text-sm font-medium">{item.quantity}× {item.itemName}{item.variantName ? <span className="ml-1 text-xs font-normal text-muted-foreground">{item.variantName}</span> : null}</p>{item.additions.length ? <p className="mt-1 text-xs text-muted-foreground">+ {item.additions.map((addition) => `${addition.quantity > 1 ? `${addition.quantity}× ` : ""}${addition.name}`).join(", ")}</p> : null}{item.observations ? <p className="mt-1 text-xs text-muted-foreground">{item.observations}</p> : null}</div><span className="shrink-0 text-sm font-medium tabular-nums">R$ {formatPaymentCents(item.totalCents)}</span></li>)}</ul>
      <footer className="mt-3 border-t border-border/50 pt-2 text-right text-xs text-muted-foreground">Pedido <strong className="ml-2 text-foreground">R$ {formatPaymentCents(order.totalCents)}</strong></footer>
    </section>)}
    {comanda.tipCents > 0 ? <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3.5 py-3 text-sm"><span className="text-muted-foreground">Gorjeta aceita</span><strong className="tabular-nums">R$ {formatPaymentCents(comanda.tipCents)}</strong></div> : null}
    <section className="rounded-xl border border-border/60 bg-background/80 p-3.5">
      <header className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Pagamentos</h3><span className="text-xs text-muted-foreground">{comanda.payments.length} {comanda.payments.length === 1 ? "lançamento" : "lançamentos"}</span></header>
      {comanda.payments.length ? <ul className="mt-2 divide-y divide-border/50">{comanda.payments.map((payment) => <li key={payment.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 last:pb-0"><span className="text-xs text-muted-foreground">{payment.createdByName} · {formatDateTime(payment.createdAt)} · {payment.splits.map((split) => split.methodLabel).join(" + ")}</span><strong className="text-sm tabular-nums">R$ {formatPaymentCents(payment.amountCents)}</strong></li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">Nenhum pagamento registrado.</p>}
    </section>
    <div className="grid grid-cols-3 rounded-xl bg-primary/[0.045] p-3.5 text-xs"><div><p className="text-muted-foreground">Consumo</p><p className="mt-1 font-semibold tabular-nums">R$ {formatPaymentCents(comanda.subtotalCents)}</p></div><div className="border-l border-border/60 pl-3"><p className="text-muted-foreground">Pago</p><p className="mt-1 font-semibold tabular-nums">R$ {formatPaymentCents(comanda.paidCents)}</p></div><div className="border-l border-border/60 pl-3"><p className="text-muted-foreground">Saldo</p><p className="mt-1 font-semibold tabular-nums">R$ {formatPaymentCents(comanda.balanceCents)}</p></div></div>
  </div>
}

export function CashWorkspaceCompact({
  initialData,
  status,
  paymentConfiguration,
  cashState,
  restaurantId,
  cardapioHref,
  financeiroHref,
}: {
  initialData: PanelComandasPage
  status: "open" | "closed"
  paymentConfiguration: PanelPaymentConfiguration
  cashState: PanelCashStateDTO
  restaurantId: string
  cardapioHref: string
  financeiroHref: string
}) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, PanelComandaDTO>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [detailError, setDetailError] = useState("")
  const [selectedComanda, setSelectedComanda] = useState<PanelComandaDTO | null>(null)
  const [consumptionComanda, setConsumptionComanda] = useState<PanelComandaSummaryDTO | null>(null)
  const [menu, setMenu] = useState<PanelMenuDTO | null>(null)
  const [menuError, setMenuError] = useState("")
  const [menuPending, startMenuTransition] = useTransition()
  const closed = status === "closed"
  const paymentMethods = useMemo(() => getPanelPaymentOptions(paymentConfiguration), [paymentConfiguration])
  useEffect(() => {
    setDetails({})
    setDetailError("")
  }, [initialData])
  const query = search.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  const filteredComandas = initialData.comandas.filter((comanda) => {
    if (!query) return true
    const latest = comanda.latestOrder
    const searchText = [locationLabel(comanda), latest?.customerName ?? "", latest?.displayNumber ? `pedido ${latest.displayNumber}` : "", latest?.fulfillmentType === "takeaway" ? "para viagem" : "no local"].join(" ")
    return searchText.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(query)
  })
  const totalOpenBalance = initialData.comandas.reduce((sum, comanda) => sum + comanda.balanceCents, 0)
  const orderCount = initialData.comandas.reduce((sum, comanda) => sum + comanda.orderCount, 0)
  const pageCount = Math.max(1, Math.ceil(initialData.totalRows / 25))

  async function loadDetail(comandaId: string) {
    if (details[comandaId]) return details[comandaId]
    setLoadingId(comandaId)
    setDetailError("")
    try {
      const result = await getPanelComandaDetailAction({ expectedRestaurantId: restaurantId, comandaId })
      if (!result.ok || !result.data) {
        setDetailError(result.ok ? "Esta comanda não está mais disponível." : "Não foi possível carregar os detalhes. Atualize e tente novamente.")
        return null
      }
      setDetails((current) => ({ ...current, [comandaId]: result.data as PanelComandaDTO }))
      return result.data
    } catch {
      setDetailError("Não foi possível carregar os detalhes. Atualize e tente novamente.")
      return null
    } finally {
      setLoadingId((current) => current === comandaId ? null : current)
    }
  }

  async function toggleDetails(comandaId: string) {
    if (expandedId === comandaId) {
      setExpandedId(null)
      setDetailError("")
      return
    }
    setExpandedId(comandaId)
    await loadDetail(comandaId)
  }

  async function openPayment(comandaId: string) {
    const detail = await loadDetail(comandaId)
    if (detail) setSelectedComanda(detail)
  }

  function openCounterOrder() {
    setMenuError("")
    startMenuTransition(async () => {
      try {
        const result = await getPanelCounterOrderMenuAction({ expectedRestaurantId: restaurantId })
        if (!result.ok) {
          setMenuError(result.code === "context_changed" ? "O restaurante ativo mudou. Atualize a página." : "Não foi possível carregar o cardápio agora.")
          return
        }
        setMenu(result.data)
      } catch {
        setMenuError("Não foi possível carregar o cardápio agora.")
      }
    })
  }

  return <main className="min-h-svh">
    <div className="mx-auto w-full max-w-[1320px] space-y-5 px-4 pb-24 sm:px-6 md:pb-10 lg:px-8">
      <section className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-3"><span className={`grid size-9 place-items-center rounded-xl ${cashState.session?.status === "open" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}><LuBanknote aria-hidden="true" className="size-4" /></span><div><p className="text-sm font-semibold">{cashState.session?.status === "open" ? "Caixa aberto" : "Caixa fechado"}</p><p className="text-xs text-muted-foreground">{cashState.session?.status === "open" ? `Esperado em espécie · R$ ${formatPaymentCents(cashState.session.expectedAmountCents)}` : "Abertura, fechamento e movimentações no Financeiro"}</p></div></div>
        <Button render={<Link href={financeiroHref} />} variant="outline" className="min-h-9 rounded-xl">Gerenciar caixa</Button>
      </section>

      {!closed ? <section aria-label="Resumo das comandas abertas" className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Em atendimento" value={String(initialData.comandas.length)} detail="Comandas abertas e em liquidação" icon={LuTable2} />
        <SummaryCard label="Pedidos" value={String(orderCount)} detail="Pedidos vinculados às comandas" icon={LuShoppingBag} />
        <SummaryCard label="Saldo em aberto" value={`R$ ${formatPaymentCents(totalOpenBalance)}`} detail="Consumo e gorjetas aceitas" icon={LuReceiptText} />
      </section> : null}

      <section aria-label="Comandas" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label="Situação das comandas" className="inline-grid w-full grid-cols-2 rounded-xl border border-border/70 bg-muted/40 p-1 sm:w-auto">
            <Link href="?status=open" aria-current={!closed ? "page" : undefined} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium ${!closed ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><LuTable2 aria-hidden="true" className="size-4" />Abertas</Link>
            <Link href="?status=closed&page=1" aria-current={closed ? "page" : undefined} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium ${closed ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><LuCheck aria-hidden="true" className="size-4" />Encerradas</Link>
          </nav>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="relative w-full sm:w-72"><LuSearch aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={closed ? "Buscar nesta página" : "Mesa, pedido ou nome"} aria-label={closed ? "Buscar comanda nesta página" : "Buscar mesa, pedido ou nome"} className="h-10 rounded-xl bg-background pl-10" /></div>
            {!closed ? <Button type="button" onClick={openCounterOrder} disabled={menuPending} className="min-h-10 rounded-xl px-4 font-semibold shadow-sm">{menuPending ? <LuLoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <LuPlus aria-hidden="true" />}Novo pedido</Button> : null}
          </div>
        </div>
        {menuError ? <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/[0.05] px-3.5 py-3 text-xs text-destructive">{menuError}</p> : null}
        {filteredComandas.length ? <div className="grid gap-3 lg:grid-cols-2">{filteredComandas.map((comanda) => {
          const expanded = expandedId === comanda.id
          const detailsValue = details[comanda.id]
          const latest = comanda.latestOrder
          const location = locationLabel(comanda)
          const fulfillment = latest?.fulfillmentType === "takeaway" ? "Para viagem" : "No local"
          return <article key={comanda.id} className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
            <button type="button" aria-expanded={expanded} onClick={() => { void toggleDetails(comanda.id) }} className="flex min-h-24 w-full items-center gap-3 p-4 text-left outline-none transition-colors hover:bg-muted/25 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5">
              <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${closed ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>{closed ? <LuCheck aria-hidden="true" className="size-5" /> : comanda.tableNumber !== null ? <LuTable2 aria-hidden="true" className="size-5" /> : <LuPackage aria-hidden="true" className="size-5" />}</span>
              <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="text-base font-semibold tracking-tight">{location}</span><Badge variant="outline" className="h-6 rounded-full px-2 text-[0.65rem]">{statusLabel(comanda.status)}</Badge></span><span className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground"><span>{comanda.orderCount} {comanda.orderCount === 1 ? "pedido" : "pedidos"}</span><span aria-hidden="true" className="size-1 rounded-full bg-border" /><span>{comanda.itemCount} {comanda.itemCount === 1 ? "item" : "itens"}</span>{latest ? <><span aria-hidden="true" className="size-1 rounded-full bg-border" /><span>{fulfillment}</span>{latest.customerName ? <span className="max-w-32 truncate">· {latest.customerName}</span> : null}</> : null}<span className="inline-flex items-center gap-1"><LuClock3 aria-hidden="true" className="size-3" />{formatDateTime(closed && comanda.closedAt ? comanda.closedAt : comanda.openedAt)}</span></span></span>
              <span className="hidden shrink-0 text-right sm:block"><span className="block text-[0.65rem] text-muted-foreground">{closed ? "Recebido" : "Em aberto"}</span><span className="mt-1 block text-base font-semibold tabular-nums">R$ {formatPaymentCents(closed ? comanda.paidCents : comanda.balanceCents)}</span></span>
            </button>
            {expanded ? <div>{loadingId === comanda.id ? <p role="status" className="border-t border-border/60 px-4 py-5 text-center text-xs text-muted-foreground">Carregando detalhes da comanda…</p> : detailError && !detailsValue ? <div role="alert" className="border-t border-border/60 px-4 py-4 text-xs text-destructive">{detailError}</div> : detailsValue ? <ComandaDetails comanda={detailsValue} /> : null}</div> : null}
            {!closed ? <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-3 sm:px-5">
              <span className="text-xs text-muted-foreground">{comanda.balanceCents === 0 ? "Sem saldo pendente" : `Saldo · R$ ${formatPaymentCents(comanda.balanceCents)}`}</span>
              <div className="flex gap-2">{comanda.balanceCents > 0 ? <Button type="button" variant="outline" onClick={() => { void openPayment(comanda.id) }} disabled={loadingId === comanda.id} className="min-h-9 rounded-xl"><LuReceiptText aria-hidden="true" className="size-4" />Receber</Button> : null}{comanda.status !== "closed" && (comanda.status === "open" || comanda.tipDecision === null) ? <Button type="button" onClick={() => setConsumptionComanda(comanda)} className="min-h-9 rounded-xl"><LuCheck aria-hidden="true" className="size-4" />{comanda.status === "open" ? "Encerrar consumo" : "Resolver gorjeta"}</Button> : null}</div>
            </footer> : null}
          </article>
        })}</div> : <div className="rounded-3xl border border-dashed border-border/80 bg-card/55 px-5 py-12 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/[0.08] text-primary"><LuReceiptText aria-hidden="true" className="size-5" /></span><h2 className="mt-4 text-base font-semibold tracking-tight">{initialData.comandas.length ? "Nenhuma comanda encontrada" : closed ? "Ainda não há comandas encerradas" : "Ainda não há comandas abertas"}</h2><p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{initialData.comandas.length ? "Ajuste a busca para localizar outra mesa, pedido ou cliente." : closed ? "O histórico aparece aqui depois que uma comanda é quitada." : "Registre um pedido no Caixa ou confirme um pedido em Chamados para iniciar."}</p></div>}
        {closed && pageCount > 1 ? <nav aria-label="Paginação de comandas encerradas" className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">Página <strong className="text-foreground">{initialData.page}</strong> de <strong className="text-foreground">{pageCount}</strong> · {initialData.totalRows} comandas</p><div className="flex gap-2"><Link href={`?status=closed&page=${Math.max(1, initialData.page - 1)}`} aria-disabled={initialData.page <= 1} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border/70 px-4 text-sm aria-disabled:pointer-events-none aria-disabled:opacity-45">Anterior</Link><Link href={`?status=closed&page=${Math.min(pageCount, initialData.page + 1)}`} aria-disabled={initialData.page >= pageCount} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border/70 px-4 text-sm aria-disabled:pointer-events-none aria-disabled:opacity-45">Próxima</Link></div></nav> : null}
      </section>
    </div>

    {selectedComanda ? <ComandaPaymentDialog open onOpenChange={(open) => { if (!open) setSelectedComanda(null) }} comanda={selectedComanda} expectedRestaurantId={restaurantId} paymentMethods={paymentMethods} tipPolicy={paymentConfiguration.tipPolicy} cashSessionOpen={cashState.session?.status === "open"} cashManagementHref={financeiroHref} onRefresh={() => router.refresh()} onSuccess={() => { setSelectedComanda(null); router.refresh() }} /> : null}
    {consumptionComanda ? <ComandaConsumptionDialog open onOpenChange={(open) => { if (!open) setConsumptionComanda(null) }} comanda={consumptionComanda} expectedRestaurantId={restaurantId} tipPolicy={paymentConfiguration.tipPolicy} onSuccess={() => { setConsumptionComanda(null); router.refresh() }} /> : null}
    {menu ? <CounterOrderDialog open={menuPending === false && menuError === ""} restaurantId={restaurantId} menu={menu} cardapioHref={cardapioHref} onOpenChange={(open) => { if (!open) setMenu(null) }} onOrderCompleted={() => { setMenu(null); router.refresh() }} /> : null}
  </main>
}
