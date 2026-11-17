"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { MotionConfig, motion, useReducedMotion } from "motion/react"
import { useRouter } from "next/navigation"
import {
  LuArrowDownLeft,
  LuArrowUpRight,
  LuBanknote,
  LuCalendarDays,
  LuCheck,
  LuCircleAlert,
  LuClock3,
  LuLoaderCircle,
  LuLockKeyhole,
  LuPlus,
  LuReceiptText,
  LuWallet,
} from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatPaymentCents, maskPaymentAmountInput, parsePaymentAmountCents } from "@/features/panel/payments/lib/currency"
import type { PanelPaymentMethodOption } from "@/features/panel/payments/model"
import { CASH_EXPENSE_CATEGORIES, type CashExpenseCategory, type CashMovementKind, type PanelCashMovementDTO, type PanelCashStateDTO } from "@/features/panel/cash/model"
import { closePanelCashSessionAction, openPanelCashSessionAction, recordPanelFinancialMovementAction } from "@/features/panel/cash/actions"

const EASE = [0.23, 1, 0.32, 1] as const

function parseCentsAllowZero(value: string): number | null {
  const digits = value.replace(/\D/g, "")
  if (!digits) return null
  const cents = Number(digits)
  return Number.isSafeInteger(cents) ? cents : null
}

function dateLabel(value: string) {
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}

function formatDateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(value))
}

function categoryLabel(category: CashExpenseCategory | null) {
  return CASH_EXPENSE_CATEGORIES.find((item) => item.value === category)?.label ?? "Movimentação"
}

function movementLabel(kind: CashMovementKind | "payment") {
  if (kind === "payment") return "Recebimento"
  if (kind === "cash_in") return "Reforço de caixa"
  if (kind === "cash_out") return "Retirada de caixa"
  return "Despesa"
}

function errorLabel(code: string) {
  const labels: Record<string, string> = {
    invalid_input: "Confira os valores e tente novamente.",
    session_expired: "Sua sessão expirou. Entre novamente para continuar.",
    context_changed: "O restaurante ativo mudou. Atualize o Caixa.",
    session_already_open: "Já existe uma sessão de caixa aberta.",
    session_already_closed_today: "O caixa deste dia já foi encerrado.",
    cash_session_required: "Abra o caixa do dia primeiro.",
    cash_session_closed: "Esta sessão já foi encerrada.",
    open_comandas: "Há comandas em atendimento. Você pode mantê-las pendentes no próximo caixa.",
    reason_required: "Informe a justificativa para encerrar com comandas pendentes.",
    difference_reason_required: "Informe a justificativa da diferença entre esperado e contado.",
    payment_method_disabled: "Essa forma de pagamento está desativada nas configurações.",
    forbidden: "Seu acesso ao restaurante mudou. Atualize a página.",
    request_conflict: "A operação mudou enquanto era processada. Atualize o Caixa.",
    amount_overflow: "O valor excede o limite permitido.",
    unavailable: "Não foi possível confirmar agora. Tente novamente.",
    database_error: "Não foi possível concluir a operação. Atualize e tente novamente.",
  }
  return labels[code] ?? "Não foi possível concluir a operação."
}

function MovementRow({ movement, timeZone }: { movement: PanelCashMovementDTO; timeZone: string }) {
  const expense = movement.kind === "expense"
  const negative = movement.kind === "cash_out" || expense
  return (
    <li className="flex items-start gap-3 border-t border-border/60 py-3 first:border-0 first:pt-0 last:pb-0">
      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${negative ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}>
        {movement.kind === "cash_in" ? <LuArrowDownLeft aria-hidden="true" className="size-4" /> : movement.kind === "cash_out" ? <LuArrowUpRight aria-hidden="true" className="size-4" /> : movement.kind === "payment" ? <LuBanknote aria-hidden="true" className="size-4" /> : <LuReceiptText aria-hidden="true" className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{movement.description}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.68rem] text-muted-foreground">
          <span>{expense ? categoryLabel(movement.category) : movementLabel(movement.kind)}</span>
          {movement.paymentMethodLabel ? <><span aria-hidden="true">·</span><span>{movement.paymentMethodLabel}</span></> : null}
          <span aria-hidden="true">·</span><span>{movement.createdByName} · {formatDateTime(movement.createdAt, timeZone)}</span>
        </span>
      </span>
      <span className={`shrink-0 pt-0.5 text-sm font-semibold tabular-nums ${negative ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>
        {negative ? "−" : "+"} R$ {formatPaymentCents(movement.amountCents)}
      </span>
    </li>
  )
}

export function CashSessionPanel({
  initialState,
  restaurantId,
  paymentMethods,
}: {
  initialState: PanelCashStateDTO
  restaurantId: string
  paymentMethods: PanelPaymentMethodOption[]
}) {
  const router = useRouter()
  const reducedMotion = useReducedMotion() === true
  const [state, setState] = useState(initialState)
  const [dialog, setDialog] = useState<"open" | "movement" | "close" | null>(null)
  const [movementKind, setMovementKind] = useState<CashMovementKind>("cash_in")
  const [amountValue, setAmountValue] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<CashExpenseCategory>("supplies")
  const [method, setMethod] = useState(paymentMethods[0]?.value ?? "cash")
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const [openComandas, setOpenComandas] = useState(0)
  const [expectedOnClose, setExpectedOnClose] = useState<number | null>(null)
  const [differenceOnClose, setDifferenceOnClose] = useState<number | null>(null)
  const [notice, setNotice] = useState("")
  const [pending, startTransition] = useTransition()
  const [requestId, setRequestId] = useState<string | null>(null)

  useEffect(() => setState(initialState), [initialState])

  const session = state.session
  const openSession = session?.status === "open"
  const activeMethods = useMemo(() => paymentMethods.filter((option) => openSession || option.kind === "electronic"), [paymentMethods, openSession])
  const selectedMethod = activeMethods.find((option) => option.value === method) ?? activeMethods[0]
  const countedCents = parseCentsAllowZero(amountValue)
  const forceClose = openComandas > 0
  const currentDifference = dialog === "close" && session && countedCents !== null
    ? countedCents - (expectedOnClose ?? session.expectedAmountCents)
    : differenceOnClose

  function resetDialog() {
    setDialog(null)
    setAmountValue("")
    setDescription("")
    setReason("")
    setError("")
    setOpenComandas(0)
    setExpectedOnClose(null)
    setDifferenceOnClose(null)
    setRequestId(null)
  }

  function openDialog(next: "open" | "movement" | "close", kind?: CashMovementKind) {
    if (kind) setMovementKind(kind)
    setAmountValue("")
    setDescription("")
    setReason("")
    setError("")
    setOpenComandas(0)
    setExpectedOnClose(null)
    setDifferenceOnClose(null)
    setRequestId(null)
    setDialog(next)
  }

  function completeAction(message: string) {
    setNotice(message)
    resetDialog()
    router.refresh()
  }

  function submitOpen() {
    const openingCents = countedCents
    if (openingCents === null) return setError("Informe o valor de abertura. Digite 0,00 se não houver troco inicial.")
    const operationId = requestId ?? crypto.randomUUID()
    setRequestId(operationId)
    setError("")
    startTransition(async () => {
      const result = await openPanelCashSessionAction({ expectedRestaurantId: restaurantId, requestId: operationId, openingAmountCents: openingCents })
      if (!result.ok) return setError(errorLabel(result.code))
      completeAction("Caixa aberto. Registre reforços, retiradas e despesas por aqui.")
    })
  }

  function submitMovement() {
    const cents = parsePaymentAmountCents(amountValue)
    if (cents === null) return setError("Informe um valor maior que zero.")
    if (description.trim().length < 2) return setError("Descreva o motivo da movimentação.")
    const expense = movementKind === "expense"
    const sessionId = openSession && session ? session.id : null
    const operationId = requestId ?? crypto.randomUUID()
    setRequestId(operationId)
    setError("")
    startTransition(async () => {
      const result = await recordPanelFinancialMovementAction({
        expectedRestaurantId: restaurantId,
        sessionId,
        requestId: operationId,
        kind: movementKind,
        amountCents: cents,
        expenseCategory: expense ? category : null,
        paymentMethod: expense ? (selectedMethod?.value ?? null) : null,
        description: description.trim(),
      })
      if (!result.ok) return setError(errorLabel(result.code))
      completeAction(expense ? "Despesa registrada no Financeiro." : movementKind === "cash_in" ? "Reforço registrado." : "Retirada registrada.")
    })
  }

  function submitClose() {
    if (!session || countedCents === null) return setError("Informe o total contado no caixa, incluindo zero se aplicável.")
    if ((forceClose || countedCents !== (expectedOnClose ?? session.expectedAmountCents)) && reason.trim().length < 3) return setError("Informe uma justificativa de pelo menos 3 caracteres.")
    const operationId = requestId ?? crypto.randomUUID()
    setRequestId(operationId)
    setError("")
    startTransition(async () => {
      const result = await closePanelCashSessionAction({
        expectedRestaurantId: restaurantId,
        sessionId: session.id,
        requestId: operationId,
        countedAmountCents: countedCents,
        reason: reason.trim(),
        force: forceClose,
      })
      if (!result.ok) {
        setError(errorLabel(result.code))
        if (result.openComandas !== undefined) setOpenComandas(result.openComandas)
        if (result.expectedCents !== undefined) setExpectedOnClose(result.expectedCents)
        if (result.differenceCents !== undefined) setDifferenceOnClose(result.differenceCents)
        return
      }
      completeAction(result.data.pendingComandas ? `Caixa encerrado. ${result.data.pendingComandas} comanda(s) ficaram pendentes para o próximo caixa.` : `Caixa encerrado. Diferença registrada: R$ ${formatPaymentCents(Math.abs(result.data.differenceCents))}.`)
    })
  }

  const sequence = {
    hidden: {},
    visible: { transition: { delayChildren: reducedMotion ? 0 : 0.02, staggerChildren: reducedMotion ? 0 : 0.045 } },
  }
  const item = {
    hidden: reducedMotion ? { opacity: 0 } : { opacity: 0, y: 7 },
    visible: { opacity: 1, y: 0, transition: { duration: reducedMotion ? 0.12 : 0.2, ease: EASE } },
  }

  return (
    <MotionConfig reducedMotion="user">
      <motion.section variants={sequence} initial={reducedMotion ? false : "hidden"} animate="visible" aria-label="Sessão de caixa do dia" className="space-y-3">
        <motion.div variants={item}>
          <Card className={`overflow-hidden rounded-3xl border-border/70 shadow-sm ${openSession ? "bg-gradient-to-br from-emerald-500/[0.09] via-card to-card" : session ? "bg-gradient-to-br from-muted/70 via-card to-card" : "bg-gradient-to-br from-primary/[0.09] via-card to-card"}`}>
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-3.5">
                  <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${openSession ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-primary/10 text-primary"}`}>
                    {openSession ? <LuWallet aria-hidden="true" className="size-5" /> : session ? <LuLockKeyhole aria-hidden="true" className="size-5" /> : <LuBanknote aria-hidden="true" className="size-5" />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold tracking-tight">Caixa do dia</h2>
                      <span className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-[0.65rem] font-semibold ${openSession ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : session ? "bg-muted text-muted-foreground" : "bg-amber-500/10 text-amber-800 dark:text-amber-300"}`}>
                        <span aria-hidden="true" className={`size-1.5 rounded-full ${openSession ? "bg-emerald-500" : session ? "bg-muted-foreground/60" : "bg-amber-500"}`} />
                        {openSession ? "Aberto" : session ? "Encerrado" : "Ainda não aberto"}
                      </span>
                    </div>
                    {session ? <p className="mt-1 text-xs text-muted-foreground">{dateLabel(session.businessDate)} · aberto por {session.openedByName}{session.closedAt ? ` · encerrado às ${formatDateTime(session.closedAt, session.timeZone)}` : ""}</p> : <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">Abra a sessão com o valor inicial em espécie. Almoço e jantar ficam no mesmo caixa.</p>}
                  </div>
                </div>
                {openSession ? (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => openDialog("movement", "cash_in")} className="min-h-10 rounded-xl"><LuArrowDownLeft aria-hidden="true" />Reforço</Button>
                    <Button type="button" variant="outline" onClick={() => openDialog("movement", "cash_out")} className="min-h-10 rounded-xl"><LuArrowUpRight aria-hidden="true" />Retirada</Button>
                    <Button type="button" variant="outline" onClick={() => openDialog("movement", "expense")} disabled={activeMethods.length === 0} className="min-h-10 rounded-xl"><LuReceiptText aria-hidden="true" />Despesa</Button>
                    <Button type="button" onClick={() => openDialog("close")} className="min-h-10 rounded-xl"><LuLockKeyhole aria-hidden="true" />Fechar caixa</Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {!session ? <Button type="button" onClick={() => openDialog("open")} className="min-h-11 rounded-xl px-4"><LuPlus aria-hidden="true" />Abrir caixa</Button> : null}
                    {activeMethods.length > 0 ? <Button type="button" variant="outline" onClick={() => openDialog("movement", "expense")} className="min-h-11 rounded-xl"><LuReceiptText aria-hidden="true" />Registrar despesa</Button> : null}
                  </div>
                )}
              </div>
              {session ? (
                <div className="mt-5 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3"><p className="text-[0.68rem] font-medium text-muted-foreground">Abertura</p><p className="mt-1 text-lg font-semibold tabular-nums">R$ {formatPaymentCents(session.openingAmountCents)}</p></div>
                  <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3"><p className="text-[0.68rem] font-medium text-muted-foreground">Esperado em espécie</p><p className="mt-1 text-lg font-semibold tabular-nums">R$ {formatPaymentCents(session.expectedAmountCents)}</p></div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </motion.div>

        {notice ? <motion.p variants={item} role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.055] px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">{notice}</motion.p> : null}

        {session ? <motion.div variants={item}>
          <Card className="rounded-2xl border-border/70 bg-card/80 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold tracking-tight">Movimentações do caixa</h3><p className="mt-0.5 text-xs text-muted-foreground">Últimos lançamentos desta sessão, com responsável e horário.</p></div><span className="grid size-9 place-items-center rounded-xl bg-muted text-muted-foreground"><LuCalendarDays aria-hidden="true" className="size-4" /></span></div>
              {state.movements.length ? <ul className="divide-y-0">{state.movements.map((movement) => <MovementRow key={movement.id} movement={movement} timeZone={session.timeZone} />)}</ul> : <div className="rounded-xl border border-dashed border-border/70 px-4 py-7 text-center"><p className="text-sm font-medium">Nenhuma movimentação registrada</p><p className="mt-1 text-xs text-muted-foreground">Pagamentos e operações financeiras aparecerão aqui.</p></div>}
            </CardContent>
          </Card>
        </motion.div> : null}
      </motion.section>

      <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open && !pending) resetDialog() }}>
        <DialogContent className="max-h-[min(92dvh,42rem)] overflow-y-auto rounded-3xl border-border/70 bg-background/95 p-0 shadow-2xl backdrop-blur-2xl sm:max-w-lg">
          <DialogHeader className="border-b border-border/60 bg-gradient-to-br from-primary/[0.07] via-background to-background px-5 py-5 sm:px-6">
            <DialogTitle>{dialog === "open" ? "Abrir caixa" : dialog === "close" ? "Fechar caixa" : movementKind === "cash_in" ? "Reforço de caixa" : movementKind === "cash_out" ? "Retirada de caixa" : "Registrar despesa"}</DialogTitle>
            <DialogDescription>{dialog === "open" ? "Informe o valor inicial em espécie para troco e operações do dia." : dialog === "close" ? "Confira o valor esperado, conte o dinheiro disponível e registre o fechamento." : dialog === "movement" && movementKind === "expense" && !openSession ? "Com o caixa fechado, registre despesas pagas por meios eletrônicos. Elas entram no Financeiro sem alterar a sessão encerrada." : dialog === "movement" && movementKind === "expense" ? "Registre a despesa uma única vez. Se pagar em espécie, ela já reduz o esperado do caixa; não lance também uma retirada." : "Registre o valor, o motivo e os detalhes para manter o histórico financeiro completo."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-5 py-5 sm:px-6">
            {dialog === "close" && session ? <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border/70 bg-muted/20 p-3.5"><div><p className="text-xs text-muted-foreground">Esperado</p><p className="mt-1 text-base font-semibold tabular-nums">R$ {formatPaymentCents(expectedOnClose ?? session.expectedAmountCents)}</p></div><div className="border-l border-border/60 pl-3"><p className="text-xs text-muted-foreground">Diferença estimada</p><p className="mt-1 text-base font-semibold tabular-nums">{currentDifference === null ? "—" : `R$ ${formatPaymentCents(currentDifference)}`}</p></div></div> : null}

            {dialog === "movement" && movementKind === "expense" ? <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5 text-xs font-medium">Categoria<select value={category} onChange={(event) => setCategory(event.target.value as CashExpenseCategory)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"><option value="supplies">Compras e insumos</option><option value="utilities">Contas e serviços</option><option value="maintenance">Manutenção</option><option value="transport">Transporte</option><option value="payroll">Equipe</option><option value="fees">Taxas</option><option value="other">Outros</option></select></label><label className="space-y-1.5 text-xs font-medium">Forma de pagamento<select value={selectedMethod?.value ?? ""} onChange={(event) => setMethod(event.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">{activeMethods.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div> : null}

            <label className="block space-y-1.5 text-xs font-medium">{dialog === "open" ? "Valor inicial em espécie" : dialog === "close" ? "Total contado" : "Valor"}<Input inputMode="decimal" value={amountValue} onChange={(event) => setAmountValue(maskPaymentAmountInput(event.target.value))} placeholder="0,00" className="h-12 rounded-xl bg-background text-base tabular-nums" aria-label={dialog === "open" ? "Valor de abertura" : dialog === "close" ? "Valor contado no fechamento" : "Valor da movimentação"} /></label>

            {dialog === "movement" ? <label className="block space-y-1.5 text-xs font-medium">Descrição<Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={300} placeholder={movementKind === "cash_in" ? "Ex.: troco extra para a operação" : movementKind === "cash_out" ? "Ex.: retirada para depósito" : "Ex.: compra de insumos"} className="min-h-20 rounded-xl bg-background" /></label> : null}

            {dialog === "close" ? <>
              {openComandas > 0 ? <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3.5 text-sm"><p className="font-semibold text-amber-900 dark:text-amber-200">{openComandas} comanda(s) ainda estão em atendimento.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Ao continuar, elas serão movidas para pendentes, sem mesa, para recebimento no próximo caixa.</p></div> : null}
              <label className="block space-y-1.5 text-xs font-medium">Justificativa {forceClose || (currentDifference !== null && currentDifference !== 0) ? "(obrigatória)" : "(opcional)"}<Textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder={forceClose ? "Explique por que as comandas seguem pendentes" : "Informe a causa de uma diferença, se houver"} className="min-h-20 rounded-xl bg-background" /></label>
            </> : null}

            {error ? <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/[0.045] px-3.5 py-3 text-xs leading-5 text-destructive"><LuCircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{error}</p> : null}
          </div>
          <DialogFooter className="border-t border-border/60 bg-background/85 px-5 py-4 sm:px-6">
            <Button type="button" variant="ghost" disabled={pending} onClick={resetDialog} className="min-h-10 rounded-xl">Cancelar</Button>
            <Button type="button" disabled={pending || (dialog === "movement" && movementKind === "expense" && activeMethods.length === 0)} onClick={dialog === "open" ? submitOpen : dialog === "close" ? submitClose : submitMovement} className="min-h-10 rounded-xl px-4">
              {pending ? <LuLoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : dialog === "open" ? <LuPlus aria-hidden="true" /> : dialog === "close" ? <LuCheck aria-hidden="true" /> : <LuReceiptText aria-hidden="true" />}
              {pending ? "Salvando" : dialog === "open" ? "Abrir caixa" : dialog === "close" ? forceClose ? "Fechar e manter pendentes" : "Confirmar fechamento" : "Registrar movimentação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MotionConfig>
  )
}
