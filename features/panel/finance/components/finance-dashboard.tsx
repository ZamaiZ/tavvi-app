"use client"

import Link from "next/link"
import { MotionConfig, motion, useReducedMotion } from "motion/react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import {
  LuArrowDownLeft,
  LuArrowUpRight,
  LuBanknote,
  LuChartNoAxesCombined,
  LuCircleDollarSign,
  LuHandCoins,
  LuReceiptText,
  LuSettings2,
  LuWallet,
} from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { formatPaymentCents } from "@/features/panel/payments/lib/currency"
import { FinanceDateFilter } from "@/features/panel/finance/components/finance-date-filter"
import type { PanelFinanceDashboardDTO } from "@/features/panel/finance/model"

const EASE = [0.23, 1, 0.32, 1] as const

function formatCompactReais(value: number) {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value)
}

function dateLabel(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone }).format(new Date(`${value}T12:00:00Z`))
}

function StatCard({
  label,
  valueCents,
  icon: Icon,
  tone,
  detail,
  index,
}: {
  label: string
  valueCents: number
  icon: typeof LuWallet
  tone: string
  detail?: string
  index: number
}) {
  return <motion.div variants={itemVariants} custom={index}>
    <Card className="h-full rounded-2xl border-border/70 bg-card shadow-sm transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0">
      <CardContent className="flex min-h-32 items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 truncate text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">R$ {formatPaymentCents(valueCents)}</p>{detail ? <p className="mt-2 text-[0.68rem] leading-5 text-muted-foreground">{detail}</p> : null}</div>
        <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${tone}`}><Icon aria-hidden="true" className="size-5" /></span>
      </CardContent>
    </Card>
  </motion.div>
}

const itemVariants = {
  hidden: { opacity: 0, y: 7 },
  visible: (index: number) => ({ opacity: 1, y: 0, transition: { duration: 0.2, delay: Math.min(index * 0.045, 0.24), ease: EASE } }),
}

function BreakdownList({
  title,
  description,
  rows,
  emptyText,
  positive,
}: {
  title: string
  description: string
  rows: Array<{ label: string; amountCents: number }>
  emptyText: string
  positive?: boolean
}) {
  const maximum = Math.max(1, ...rows.map((row) => row.amountCents))
  return <Card className="rounded-3xl border-border/70 bg-card shadow-sm">
    <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6"><CardTitle className="text-base tracking-tight">{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
    <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
      {rows.length ? <ul className="space-y-4">{rows.slice(0, 8).map((row, index) => <li key={`${row.label}-${index}`} className="space-y-1.5">
        <div className="flex items-center justify-between gap-3 text-xs"><span className="min-w-0 truncate font-medium">{row.label}</span><span className="shrink-0 font-semibold tabular-nums">R$ {formatPaymentCents(row.amountCents)}</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-muted"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(2, (row.amountCents / maximum) * 100)}%` }} transition={{ duration: 0.45, delay: index * 0.045, ease: EASE }} className={`h-full rounded-full ${positive ? "bg-primary" : "bg-amber-500/80"}`} /></div>
      </li>)}</ul> : <div className="rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center"><p className="text-sm font-medium">{emptyText}</p><p className="mt-1 text-xs text-muted-foreground">Os lançamentos deste período aparecerão aqui.</p></div>}
    </CardContent>
  </Card>
}

export function FinanceDashboard({ data, today, settingsHref }: { data: PanelFinanceDashboardDTO; today: string; settingsHref: string }) {
  const prefersReducedMotion = useReducedMotion() === true
  const hasActivity = data.salesCents > 0 || data.receivedCents > 0 || data.expensesCents > 0 || data.cashInCents > 0 || data.cashOutCents > 0
  const chartData = data.daily.map((point) => ({
    day: point.day,
    label: dateLabel(point.day, data.timeZone),
    sales: point.salesCents / 100,
    received: point.receivedCents / 100,
  }))
  const chartConfig: ChartConfig = {
    sales: { label: "Vendas", color: "var(--primary)" },
    received: { label: "Recebimentos", color: "var(--chart-2)" },
  }
  const sequence = { hidden: {}, visible: { transition: { delayChildren: prefersReducedMotion ? 0 : 0.02, staggerChildren: prefersReducedMotion ? 0 : 0.035 } } }

  return <MotionConfig reducedMotion="user">
    <motion.main initial={prefersReducedMotion ? false : "hidden"} animate="visible" variants={sequence} className="mx-auto w-full max-w-[1320px] space-y-5 px-4 pb-32 sm:px-6 md:pb-10 lg:px-8">
      <motion.section variants={itemVariants} custom={0} className="flex flex-col gap-3 rounded-3xl border border-border/70 bg-gradient-to-br from-primary/[0.07] via-card to-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><LuChartNoAxesCombined aria-hidden="true" className="size-5" /></span><div><h2 className="text-sm font-semibold tracking-tight">Visão financeira</h2><p className="mt-0.5 text-xs text-muted-foreground">{dateLabel(data.from, data.timeZone)} – {dateLabel(data.to, data.timeZone)} · fuso {data.timeZone}</p></div></div>
        <Button render={<Link href={settingsHref} />} variant="outline" className="min-h-10 rounded-xl bg-background/75"><LuSettings2 aria-hidden="true" />Configurações de pagamento</Button>
      </motion.section>

      <motion.div variants={itemVariants} custom={1}>
        <FinanceDateFilter from={data.from} to={data.to} today={today} />
      </motion.div>

      <section aria-label="Indicadores financeiros" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={2} label="Vendas registradas" valueCents={data.salesCents} icon={LuChartNoAxesCombined} tone="bg-primary/10 text-primary" detail="Pedidos criados no intervalo" />
        <StatCard index={3} label="Recebimentos" valueCents={data.receivedCents} icon={LuHandCoins} tone="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" detail={`R$ ${formatPaymentCents(data.cashReceivedCents)} recebido em espécie`} />
        <StatCard index={4} label="Despesas" valueCents={data.expensesCents} icon={LuReceiptText} tone="bg-amber-500/10 text-amber-700 dark:text-amber-300" detail="Registradas por categoria e forma" />
        <StatCard index={5} label="Saldo pendente atual" valueCents={data.pendingCents} icon={LuCircleDollarSign} tone="bg-violet-500/10 text-violet-700 dark:text-violet-300" detail="Comandas ainda não quitadas" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.85fr)]">
        <motion.div variants={itemVariants} custom={6}>
          <Card className="h-full rounded-3xl border-border/70 bg-card shadow-sm">
            <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6"><CardTitle className="text-base tracking-tight">Vendas e recebimentos</CardTitle><CardDescription>Vendas acompanham a criação do pedido; recebimentos, o lançamento do pagamento.</CardDescription></CardHeader>
            <CardContent className="px-3 pb-4 sm:px-5 sm:pb-5">
              {hasActivity ? <ChartContainer config={chartConfig} className="h-[17rem] w-full aspect-auto sm:h-[20rem]">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={22} tickMargin={9} />
                  <YAxis tickLine={false} axisLine={false} width={45} tickFormatter={formatCompactReais} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(value) => `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />} />
                  <Line type="monotone" dataKey="sales" stroke="var(--color-sales)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="received" stroke="var(--color-received)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ChartContainer> : <div className="grid h-[17rem] place-items-center rounded-2xl border border-dashed border-border/70 text-center sm:h-[20rem]"><div><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground"><LuChartNoAxesCombined aria-hidden="true" className="size-5" /></span><p className="mt-3 text-sm font-medium">Sem movimentação neste intervalo</p><p className="mt-1 text-xs text-muted-foreground">As linhas de vendas e recebimentos aparecerão quando houver lançamentos.</p></div></div>}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} custom={7}>
          <Card className="h-full rounded-3xl border-border/70 bg-gradient-to-br from-muted/45 via-card to-card shadow-sm">
            <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6"><CardTitle className="text-base tracking-tight">Movimento de caixa</CardTitle><CardDescription>Operações em espécie ficam separadas de receita e despesa.</CardDescription></CardHeader>
            <CardContent className="space-y-3 px-5 pb-5 sm:px-6 sm:pb-6">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/75 p-4"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><LuArrowDownLeft aria-hidden="true" className="size-4" /></span><div><p className="text-xs font-medium">Reforços</p><p className="text-[0.68rem] text-muted-foreground">Dinheiro colocado no caixa</p></div></div><p className="text-sm font-semibold tabular-nums">R$ {formatPaymentCents(data.cashInCents)}</p></div>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/75 p-4"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300"><LuArrowUpRight aria-hidden="true" className="size-4" /></span><div><p className="text-xs font-medium">Retiradas</p><p className="text-[0.68rem] text-muted-foreground">Saídas sem categoria de despesa</p></div></div><p className="text-sm font-semibold tabular-nums">R$ {formatPaymentCents(data.cashOutCents)}</p></div>
              <div className="rounded-2xl border border-primary/15 bg-primary/[0.045] p-4"><div className="flex items-center gap-2 text-primary"><LuBanknote aria-hidden="true" className="size-4" /><p className="text-xs font-semibold">Espécie recebida no período</p></div><p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">R$ {formatPaymentCents(data.cashReceivedCents)}</p><p className="mt-1 text-[0.68rem] leading-5 text-muted-foreground">O esperado na gaveta também considera abertura, reforços, retiradas e despesas em dinheiro.</p></div>
              <div className="rounded-2xl border border-border/60 bg-background/75 p-4">
                <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold">Conferência do caixa</p><p className="mt-0.5 text-[0.68rem] text-muted-foreground">{data.cashClosingSessionsCount} {data.cashClosingSessionsCount === 1 ? "sessão encerrada" : "sessões encerradas"} no período</p></div><LuWallet aria-hidden="true" className="size-4 text-muted-foreground" /></div>
                {data.cashClosingSessionsCount > 0 ? <div className="mt-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-3 text-xs"><span className="text-muted-foreground">Esperado</span><span className="font-semibold tabular-nums">R$ {formatPaymentCents(data.cashClosingExpectedCents)}</span></div>
                  <div className="flex items-center justify-between gap-3 text-xs"><span className="text-muted-foreground">Contado</span><span className="font-semibold tabular-nums">R$ {formatPaymentCents(data.cashClosingCountedCents)}</span></div>
                  <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2 text-xs"><span className="text-muted-foreground">Diferenças somadas</span><span className={`font-semibold tabular-nums ${data.cashDifferenceSessionsCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>R$ {formatPaymentCents(data.cashClosingDifferenceCents)}</span></div>
                  {data.cashDifferenceSessionsCount > 0 ? <p className="text-[0.68rem] text-amber-700 dark:text-amber-300">Diferenças em {data.cashDifferenceSessionsCount} {data.cashDifferenceSessionsCount === 1 ? "sessão" : "sessões"}.</p> : <p className="text-[0.68rem] text-emerald-700 dark:text-emerald-300">Todas as sessões foram conferidas.</p>}
                  {data.cashOpenSessionsCount > 0 ? <p className="text-[0.68rem] text-muted-foreground">Há uma sessão aberta no período, aguardando fechamento.</p> : null}
                </div> : <p className="mt-3 text-xs leading-5 text-muted-foreground">{data.cashOpenSessionsCount > 0 ? "Há uma sessão aberta neste período; o fechamento ainda está pendente." : "Nenhuma sessão foi encerrada neste período."}</p>}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <motion.div variants={itemVariants} custom={8}><BreakdownList title="Recebimentos por forma" description="Valores efetivamente lançados no período." rows={data.receivedByMethod} emptyText="Sem recebimentos no período" positive /></motion.div>
        <motion.div variants={itemVariants} custom={9}><BreakdownList title="Despesas por categoria" description="Despesas categorizadas registradas no período." rows={data.expensesByCategory} emptyText="Sem despesas registradas" /></motion.div>
        <motion.div variants={itemVariants} custom={10}><BreakdownList title="Despesas por forma" description="Como as despesas foram pagas no período." rows={data.expensesByMethod} emptyText="Sem despesas por forma de pagamento" /></motion.div>
      </section>

      <motion.p variants={itemVariants} custom={11} className="px-1 text-[0.68rem] leading-5 text-muted-foreground">Reforços e retiradas não entram como receita ou despesa. Saldo pendente mostra o valor atual das comandas ainda abertas.</motion.p>
    </motion.main>
  </MotionConfig>
}
