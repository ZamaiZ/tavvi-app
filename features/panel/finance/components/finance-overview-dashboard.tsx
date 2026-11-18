"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { LuArrowDownLeft, LuArrowUpRight, LuBanknote, LuChartNoAxesCombined, LuChevronDown, LuChevronUp, LuHandCoins, LuReceiptText, LuWallet } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { FinanceDateFilter } from "@/features/panel/finance/components/finance-date-filter"
import { getPanelFinanceDetailsAction } from "@/features/panel/finance/actions"
import type { PanelFinanceDashboardDTO, PanelFinanceOverviewDTO } from "@/features/panel/finance/model"
import { formatPaymentCents } from "@/features/panel/payments/lib/currency"

function dateLabel(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone }).format(new Date(`${value}T12:00:00Z`))
}

function compactReais(value: number) {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value)
}

function SummaryMetric({ title, valueCents, note, icon: Icon, tone }: { title: string; valueCents: number; note: string; icon: typeof LuChartNoAxesCombined; tone: string }) {
  return <Card className="rounded-2xl border-border/70 bg-card shadow-sm"><CardContent className="flex min-h-28 items-start justify-between gap-3 p-4 sm:p-5"><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">{title}</p><p className="mt-2 truncate text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">R$ {formatPaymentCents(valueCents)}</p><p className="mt-1 text-[0.68rem] leading-5 text-muted-foreground">{note}</p></div><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone}`}><Icon aria-hidden="true" className="size-5" /></span></CardContent></Card>
}

function Breakdown({ title, description, rows, emptyText }: { title: string; description: string; rows: Array<{ label: string; amountCents: number }>; emptyText: string }) {
  return <Card className="rounded-2xl border-border/70 bg-card shadow-sm"><CardHeader className="px-4 pt-4 sm:px-5 sm:pt-5"><CardTitle className="text-sm tracking-tight">{title}</CardTitle><CardDescription className="text-xs">{description}</CardDescription></CardHeader><CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">{rows.length ? <ul className="divide-y divide-border/50">{rows.slice(0, 6).map((row, index) => <li key={`${row.label}-${index}`} className="flex items-center justify-between gap-3 py-2.5 text-xs first:pt-0 last:pb-0"><span className="min-w-0 truncate text-muted-foreground">{row.label}</span><strong className="shrink-0 tabular-nums">R$ {formatPaymentCents(row.amountCents)}</strong></li>)}</ul> : <p className="rounded-xl border border-dashed border-border/70 px-3 py-5 text-center text-xs text-muted-foreground">{emptyText}</p>}</CardContent></Card>
}

export function FinanceOverviewDashboard({
  data,
  today,
  settingsHref,
  cashHref,
  restaurantId,
}: {
  data: PanelFinanceOverviewDTO
  today: string
  settingsHref: string
  cashHref: string
  restaurantId: string
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [details, setDetails] = useState<(PanelFinanceDashboardDTO & { tipsReceivedCents: number }) | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const detailsRequestVersion = useRef(0)
  const chartConfig: ChartConfig = {
    sales: { label: "Vendas", color: "var(--primary)" },
    received: { label: "Recebimentos", color: "var(--chart-2)" },
  }
  const chartData = data.daily.map((point) => ({
    label: dateLabel(point.day, data.timeZone),
    sales: point.salesCents / 100,
    received: point.receivedCents / 100,
  }))
  const hasActivity = data.salesCents > 0 || data.receivedCents > 0

  useEffect(() => {
    detailsRequestVersion.current += 1
    setDetails(null)
    setDetailsOpen(false)
    setLoading(false)
    setError("")
  }, [data.from, data.to])

  async function toggleDetails() {
    if (detailsOpen) {
      setDetailsOpen(false)
      return
    }
    setDetailsOpen(true)
    if (details || loading) return
    const requestVersion = ++detailsRequestVersion.current
    setLoading(true)
    setError("")
    try {
      const result = await getPanelFinanceDetailsAction({ expectedRestaurantId: restaurantId, from: data.from, to: data.to })
      if (requestVersion !== detailsRequestVersion.current) return
      if (!result.ok) {
        setError(result.code === "context_changed" ? "O restaurante ativo mudou. Atualize a página." : "Não foi possível carregar as análises. Tente novamente.")
        return
      }
      setDetails(result.data)
    } catch {
      if (requestVersion === detailsRequestVersion.current) setError("Não foi possível carregar as análises. Tente novamente.")
    } finally {
      if (requestVersion === detailsRequestVersion.current) setLoading(false)
    }
  }

  return <main className="mx-auto w-full max-w-[1320px] space-y-5 px-4 pb-24 sm:px-6 md:pb-10 lg:px-8">
    <section className="flex flex-col gap-3 rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] via-card to-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div><h2 className="text-sm font-semibold tracking-tight">Resumo financeiro</h2><p className="mt-1 text-xs text-muted-foreground">{dateLabel(data.from, data.timeZone)} – {dateLabel(data.to, data.timeZone)} · fuso {data.timeZone}</p></div>
      <div className="flex flex-wrap gap-2"><Button render={<Link href={cashHref} />} variant="outline" className="min-h-10 rounded-xl bg-background/75"><LuBanknote aria-hidden="true" />Movimentações de caixa</Button><Button render={<Link href={settingsHref} />} variant="outline" className="min-h-10 rounded-xl bg-background/75">Configurações financeiras</Button></div>
    </section>

    <FinanceDateFilter from={data.from} to={data.to} today={today} />

    <section aria-label="Indicadores do período" className="grid gap-3 sm:grid-cols-3">
      <SummaryMetric title="Vendas" valueCents={data.salesCents} note="Consumo registrado em pedidos" icon={LuChartNoAxesCombined} tone="bg-primary/10 text-primary" />
      <SummaryMetric title="Recebimentos" valueCents={data.receivedCents} note={`Inclui R$ ${formatPaymentCents(data.tipsReceivedCents)} em gorjetas aceitas`} icon={LuHandCoins} tone="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" />
      <SummaryMetric title="Despesas" valueCents={data.expensesCents} note="Despesas registradas no intervalo" icon={LuReceiptText} tone="bg-amber-500/10 text-amber-700 dark:text-amber-300" />
    </section>

    <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3.5 shadow-sm">
      <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-violet-500/10 text-violet-700 dark:text-violet-300"><LuWallet aria-hidden="true" className="size-4" /></span><div><p className="text-xs font-semibold">Saldo pendente atual</p><p className="text-[0.68rem] text-muted-foreground">Comandas em atendimento ou liquidação</p></div></div><p className="text-lg font-semibold tabular-nums">R$ {formatPaymentCents(data.pendingCents)}</p>
    </section>

    <Card className="rounded-3xl border-border/70 bg-card shadow-sm">
      <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6"><CardTitle className="text-base tracking-tight">Vendas e recebimentos</CardTitle><CardDescription>O gráfico resume o período selecionado. As análises por forma e categoria ficam abaixo.</CardDescription><div aria-label="Legenda do gráfico" className="mt-1 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-2"><span aria-hidden="true" className="size-2 rounded-full bg-primary" />Vendas</span><span className="inline-flex items-center gap-2"><span aria-hidden="true" className="size-2 rounded-full bg-[var(--chart-2)]" />Recebimentos</span></div></CardHeader>
      <CardContent className="px-3 pb-4 sm:px-5 sm:pb-5">{hasActivity ? <ChartContainer config={chartConfig} className="h-[17rem] w-full aspect-auto sm:h-[20rem]"><LineChart data={chartData} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={22} tickMargin={9} /><YAxis tickLine={false} axisLine={false} width={45} tickFormatter={compactReais} /><ChartTooltip content={<ChartTooltipContent formatter={(value) => `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />} /><Line type="monotone" dataKey="sales" stroke="var(--color-sales)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} /><Line type="monotone" dataKey="received" stroke="var(--color-received)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} /></LineChart></ChartContainer> : <div className="grid h-64 place-items-center rounded-2xl border border-dashed border-border/70 text-center"><div><span className="mx-auto grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground"><LuChartNoAxesCombined aria-hidden="true" className="size-5" /></span><p className="mt-3 text-sm font-medium">Sem movimentação neste intervalo</p><p className="mt-1 text-xs text-muted-foreground">O gráfico aparece quando houver vendas ou recebimentos.</p></div></div>}</CardContent>
    </Card>

    <section className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
      <button type="button" aria-expanded={detailsOpen} onClick={() => { void toggleDetails() }} className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5">
        <span><span className="block text-sm font-semibold">Análises detalhadas</span><span className="mt-0.5 block text-xs text-muted-foreground">Formas de recebimento, despesas e conferência do caixa</span></span>{detailsOpen ? <LuChevronUp aria-hidden="true" className="size-4 text-muted-foreground" /> : <LuChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />}
      </button>
      {detailsOpen ? <div className="space-y-4 border-t border-border/60 bg-muted/[0.12] p-4 sm:p-5">
        {loading ? <p role="status" className="rounded-xl border border-border/60 bg-background px-4 py-8 text-center text-sm text-muted-foreground">Carregando análises…</p> : null}
        {error ? <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/[0.05] px-4 py-3 text-sm text-destructive">{error}</p> : null}
        {details ? <>
          <section aria-label="Movimento em espécie" className="grid gap-3 sm:grid-cols-3">
            <SummaryMetric title="Espécie recebida" valueCents={details.cashReceivedCents} note="Incluída no total de recebimentos" icon={LuBanknote} tone="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" />
            <SummaryMetric title="Reforços" valueCents={details.cashInCents} note="Entradas manuais no caixa" icon={LuArrowDownLeft} tone="bg-primary/10 text-primary" />
            <SummaryMetric title="Retiradas" valueCents={details.cashOutCents} note="Saídas manuais do caixa" icon={LuArrowUpRight} tone="bg-amber-500/10 text-amber-700 dark:text-amber-300" />
          </section>
          <section className="grid gap-3 lg:grid-cols-3">
            <Breakdown title="Recebimentos por forma" description="Pagamentos lançados no período." rows={details.receivedByMethod.map((row) => ({ label: row.method, amountCents: row.amountCents }))} emptyText="Sem recebimentos no período." />
            <Breakdown title="Despesas por categoria" description="Categorias com valores registrados." rows={details.expensesByCategory.map((row) => ({ label: row.label, amountCents: row.amountCents }))} emptyText="Sem despesas no período." />
            <Breakdown title="Despesas por forma" description="Meios usados para pagar despesas." rows={details.expensesByMethod.map((row) => ({ label: row.label, amountCents: row.amountCents }))} emptyText="Sem despesas por forma." />
          </section>
          <section className="rounded-2xl border border-border/70 bg-background p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">Conferência do caixa</h3><p className="mt-1 text-xs text-muted-foreground">Sessões encerradas no intervalo · {details.cashClosingSessionsCount}</p></div><Button render={<Link href={cashHref} />} variant="outline" className="min-h-9 rounded-xl">Abrir movimentações</Button></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Esperado</p><p className="mt-1 text-sm font-semibold tabular-nums">R$ {formatPaymentCents(details.cashClosingExpectedCents)}</p></div><div><p className="text-xs text-muted-foreground">Contado</p><p className="mt-1 text-sm font-semibold tabular-nums">R$ {formatPaymentCents(details.cashClosingCountedCents)}</p></div><div><p className="text-xs text-muted-foreground">Diferenças somadas</p><p className="mt-1 text-sm font-semibold tabular-nums">R$ {formatPaymentCents(details.cashClosingDifferenceCents)}</p></div></div>
            {details.cashOpenSessionsCount > 0 ? <p className="mt-3 text-xs text-muted-foreground">Há uma sessão de caixa aberta no período.</p> : null}
          </section>
          <p className="px-1 text-xs leading-5 text-muted-foreground">Gorjetas aceitas já estão incluídas em recebimentos; não são somadas novamente às vendas nem às formas de pagamento.</p>
        </> : null}
      </div> : null}
    </section>
  </main>
}
