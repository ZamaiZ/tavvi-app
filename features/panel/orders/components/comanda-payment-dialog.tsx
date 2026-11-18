"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import {
  LuBanknote,
  LuCheck,
  LuCircleAlert,
  LuCreditCard,
  LuCircleDollarSign,
  LuHandshake,
  LuLoaderCircle,
  LuPlus,
  LuQrCode,
  LuReceiptText,
  LuTrash2,
  LuWalletCards,
} from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Combobox as ComboboxRoot, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { PANEL_PAYMENT_METHOD_VALUES, type PanelPaymentMethodOption, type PanelTipPolicy, type PaymentSplitInput } from "@/features/panel/payments/model"
import { formatPaymentCents, parsePaymentAmountCents } from "@/features/panel/payments/lib/currency"
import { PaymentAmountInput } from "@/features/panel/payments/components/payment-amount-input"
import { recordPanelComandaPaymentAction } from "@/features/panel/orders/actions"
import type { PanelComandaDTO, PanelPaymentFailureCode } from "@/features/panel/orders/model"

const EASE = [0.23, 1, 0.32, 1] as const

const methodIcons: Record<string, typeof LuBanknote> = {
  cash: LuBanknote,
  debit: LuCreditCard,
  credit: LuCreditCard,
  pix: LuQrCode,
  meal_voucher: LuWalletCards,
  food_voucher: LuWalletCards,
  partnership: LuHandshake,
}

type PaymentDraft = { id: string; method: string; value: string; cashReceivedValue: string; touched: boolean }
type PendingPaymentAttempt = { requestId: string; splits: PaymentSplitInput[]; closeIfPaid: boolean; tipDecision: "accepted" | "declined" | null }

function readPendingPaymentAttempt(key: string): PendingPaymentAttempt | null {
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return null
    const candidate = JSON.parse(raw) as Partial<PendingPaymentAttempt>
    if (!candidate.requestId || !/^[0-9a-f-]{36}$/i.test(candidate.requestId)
      || typeof candidate.closeIfPaid !== "boolean"
      || (candidate.tipDecision !== undefined && candidate.tipDecision !== null && candidate.tipDecision !== "accepted" && candidate.tipDecision !== "declined")
      || !Array.isArray(candidate.splits)
      || candidate.splits.length < 1
      || candidate.splits.length > PANEL_PAYMENT_METHOD_VALUES.length + 20) return null

    const seenMethods = new Set<string>()
    const splits: PaymentSplitInput[] = []
    for (const split of candidate.splits) {
      if (!split || typeof split.method !== "string"
        || !(PANEL_PAYMENT_METHOD_VALUES.includes(split.method as (typeof PANEL_PAYMENT_METHOD_VALUES)[number]) || /^custom:[0-9a-f-]{36}$/i.test(split.method))
        || !Number.isSafeInteger(split.amountCents)
        || split.amountCents <= 0
        || seenMethods.has(split.method)) return null
      if (split.cashReceivedCents !== undefined && (!Number.isSafeInteger(split.cashReceivedCents) || split.cashReceivedCents < split.amountCents)) return null
      seenMethods.add(split.method)
      splits.push({ method: split.method, amountCents: split.amountCents, ...(split.cashReceivedCents === undefined ? {} : { cashReceivedCents: split.cashReceivedCents }) })
    }

    return { requestId: candidate.requestId, splits, closeIfPaid: candidate.closeIfPaid, tipDecision: candidate.tipDecision ?? null }
  } catch {
    return null
  }
}

function persistPendingPaymentAttempt(key: string, attempt: PendingPaymentAttempt) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(attempt))
  } catch {
    // The mounted form still retains the request ID and values for an immediate retry.
  }
}

function clearPendingPaymentAttempt(key: string) {
  try {
    window.sessionStorage.removeItem(key)
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

function paymentErrorMessage(code: PanelPaymentFailureCode) {
  const messages: Partial<Record<PanelPaymentFailureCode, string>> = {
    invalid_input: "Confira os valores informados e tente novamente.",
    session_expired: "Sua sessão expirou. Entre novamente para continuar.",
    context_changed: "O restaurante ativo mudou. Atualize o Caixa antes de continuar.",
    unavailable: "Não foi possível confirmar o lançamento. Tente novamente; a repetição segura evita duplicidade.",
    database_error: "Não foi possível confirmar os dados do pagamento. Reenvie os mesmos valores para verificar o resultado.",
    forbidden: "Seu acesso ao restaurante mudou. Atualize a página e tente novamente.",
    comanda_not_found: "Esta comanda não está mais disponível.",
    comanda_conflict: "A comanda mudou desde que você abriu este formulário. Atualize os valores e tente novamente.",
    request_conflict: "Este lançamento foi alterado enquanto estava pendente. Atualize o Caixa antes de tentar de novo.",
    payment_method_disabled: "Uma das formas foi desativada nas configurações. Atualize o Caixa e revise o pagamento.",
    balance_already_paid: "O saldo já foi quitado. Feche a comanda sem registrar outro pagamento.",
    payment_exceeds_balance: "O valor ultrapassa o saldo atual. Atualize o Caixa e ajuste o lançamento.",
    close_requires_full_payment: "Para fechar junto com o pagamento, o valor precisa quitar todo o saldo.",
    balance_remaining: "Ainda há saldo em aberto. Não é possível encerrar esta comanda.",
    tip_decision_required: "Confirme se o cliente aceita ou recusa a gorjeta antes do pagamento.",
    tip_decision_conflict: "A decisão registrada para a gorjeta mudou. Atualize os dados da comanda.",
    amount_overflow: "O total excede o limite suportado. Atualize a comanda e confira os valores.",
  }
  messages.cash_session_required = "Abra o caixa do dia antes de registrar pagamentos."
  messages.cash_session_closed = "O caixa foi fechado. Atualize a página para continuar."
  return messages[code] ?? "Não foi possível concluir esta operação."
}

export function ComandaPaymentDialog({
  open,
  onOpenChange,
  comanda,
  expectedRestaurantId,
  paymentMethods,
  tipPolicy,
  cashSessionOpen,
  cashManagementHref,
  onRefresh,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  comanda: PanelComandaDTO
  expectedRestaurantId: string
  paymentMethods: PanelPaymentMethodOption[]
  tipPolicy: PanelTipPolicy
  cashSessionOpen: boolean
  cashManagementHref: string
  onRefresh: () => void
  onSuccess: () => void
}) {
  const reducedMotion = useReducedMotion() === true
  const latestOrder = comanda.orders[0] ?? null
  const comandaLabel = comanda.tableNumber !== null
    ? `Mesa ${comanda.tableNumber}`
    : latestOrder?.displayNumber !== null && latestOrder?.displayNumber !== undefined
      ? `Balcão #${latestOrder.displayNumber}`
      : "Comanda de balcão"
  const orderContext = latestOrder
    ? `${latestOrder.fulfillmentType === "takeaway" ? "para viagem" : "no local"}${latestOrder.customerName ? ` · ${latestOrder.customerName}` : ""}`
    : ""
  const [rows, setRows] = useState<PaymentDraft[]>(() => [{ id: "split-0", method: paymentMethods[0]?.value ?? "cash", value: "", cashReceivedValue: "", touched: false }])
  const [closeIfPaid, setCloseIfPaid] = useState(false)
  const [tipDecision, setTipDecision] = useState<"accepted" | "declined" | null>(comanda.tipDecision === "accepted" || comanda.tipDecision === "declined" ? comanda.tipDecision : null)
  const [error, setError] = useState("")
  const [refreshAvailable, setRefreshAvailable] = useState(false)
  const [uncertainAttempt, setUncertainAttempt] = useState(false)
  const [retryNotice, setRetryNotice] = useState("")
  const [pending, startTransition] = useTransition()
  const [nextRowId, setNextRowId] = useState(1)
  const requestIdRef = useRef<string | null>(null)
  const pendingAttemptKey = `tavvi:panel:comanda-payment:${expectedRestaurantId}:${comanda.id}`

  useEffect(() => {
    if (!open) return
    const pendingAttempt = readPendingPaymentAttempt(pendingAttemptKey)
    if (pendingAttempt) {
      setRows(pendingAttempt.splits.map((split, index) => ({
        id: `split-${index}`,
        method: split.method,
        value: formatPaymentCents(split.amountCents),
        cashReceivedValue: split.cashReceivedCents === undefined ? "" : formatPaymentCents(split.cashReceivedCents),
        touched: false,
      })))
      setCloseIfPaid(pendingAttempt.closeIfPaid)
      setTipDecision(pendingAttempt.tipDecision)
      setNextRowId(pendingAttempt.splits.length)
      requestIdRef.current = pendingAttempt.requestId
      setUncertainAttempt(true)
      setRetryNotice("Há um lançamento sem resposta anterior. Reenvie os mesmos valores para confirmar o resultado sem duplicar.")
    }
  }, [open, pendingAttemptKey])

  const methodByValue = new Map(paymentMethods.map((method) => [method.value, method]))
  const parsedRows = rows.map((row) => {
    const amountCents = parsePaymentAmountCents(row.value)
    const methodOption = methodByValue.get(row.method)
    const receivedCents = methodOption?.kind === "cash"
      ? row.cashReceivedValue.trim() ? parsePaymentAmountCents(row.cashReceivedValue) : amountCents
      : null
    return { ...row, amountCents, receivedCents, methodOption }
  })
  const paymentCents = parsedRows.reduce((total, row) => total + (row.amountCents ?? 0), 0)
  const suggestedTipCents = tipPolicy.mode === "percentage"
    ? Math.round(comanda.subtotalCents * tipPolicy.percentageBps / 10000)
    : tipPolicy.mode === "fixed" ? tipPolicy.fixedCents : 0
  const needsTipChoice = comanda.status === "pending" && comanda.tipDecision === null && tipPolicy.mode !== "disabled"
  const effectiveTipCents = comanda.tipDecision === "accepted" ? comanda.tipCents : needsTipChoice && tipDecision === "accepted" ? suggestedTipCents : 0
  const effectiveTotalCents = comanda.subtotalCents + effectiveTipCents
  const effectiveBalanceCents = Math.max(0, effectiveTotalCents - comanda.paidCents)
  const submittedTipDecision = comanda.tipDecision === "accepted" || comanda.tipDecision === "declined" ? comanda.tipDecision : tipDecision
  const balanceAfterCents = Math.max(0, effectiveBalanceCents - paymentCents)
  const exactBalance = paymentCents > 0 && paymentCents === effectiveBalanceCents
  const exceedsBalance = !uncertainAttempt && paymentCents > effectiveBalanceCents
  const allRowsValid = parsedRows.every((row) => row.amountCents !== null && (row.methodOption?.kind !== "cash" || (row.receivedCents !== null && row.receivedCents >= row.amountCents)))
  const methodsValid = rows.every((row) => paymentMethods.some((method) => method.value === row.method))
  const canSubmit = allRowsValid && paymentCents > 0 && (uncertainAttempt || (!exceedsBalance && methodsValid)) && (!needsTipChoice || tipDecision !== null || uncertainAttempt) && paymentMethods.length > 0 && (cashSessionOpen || uncertainAttempt)
  const usedMethods = useMemo(() => new Set(rows.map((row) => row.method)), [rows])

  function invalidateAttempt() {
    requestIdRef.current = null
    clearPendingPaymentAttempt(pendingAttemptKey)
    setError("")
    setRefreshAvailable(false)
    setRetryNotice("")
  }

  function updateRow(id: string, patch: Partial<PaymentDraft>) {
    invalidateAttempt()
    setCloseIfPaid(false)
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row))
  }

  function markRowTouched(id: string) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, touched: true } : row))
  }

  function addRow() {
    if (rows.length >= paymentMethods.length || pending || uncertainAttempt) return
    const method = paymentMethods.find((entry) => !usedMethods.has(entry.value))?.value
    if (!method) return
    invalidateAttempt()
    setCloseIfPaid(false)
    setRows((current) => [...current, { id: `split-${nextRowId}`, method, value: "", cashReceivedValue: "", touched: false }])
    setNextRowId((current) => current + 1)
  }

  function removeRow(id: string) {
    if (rows.length <= 1 || pending || uncertainAttempt) return
    invalidateAttempt()
    setCloseIfPaid(false)
    setRows((current) => current.filter((row) => row.id !== id))
  }

  function submitPayment() {
    if (!canSubmit || pending) return
    const splits = parsedRows.map((row) => ({
      method: row.method,
      amountCents: row.amountCents as number,
      ...(row.methodOption?.kind === "cash" && row.receivedCents !== null ? { cashReceivedCents: row.receivedCents } : {}),
    })) as PaymentSplitInput[]
    const requestId = requestIdRef.current ?? crypto.randomUUID()
    requestIdRef.current = requestId
    setError("")
    setRefreshAvailable(false)
    setRetryNotice("")
    const closeAfterPayment = uncertainAttempt ? closeIfPaid : comanda.status === "pending" && exactBalance
    persistPendingPaymentAttempt(pendingAttemptKey, { requestId, splits, closeIfPaid: closeAfterPayment, tipDecision: submittedTipDecision })

    startTransition(async () => {
      try {
        const result = await recordPanelComandaPaymentAction({
          expectedRestaurantId,
          comandaId: comanda.id,
          requestId,
          splits,
          closeIfPaid: closeAfterPayment,
          tipDecision: submittedTipDecision,
        })
        if (!result.ok) {
          setError(paymentErrorMessage(result.code))
          const uncertain = result.code === "unavailable" || result.code === "database_error"
          setUncertainAttempt(uncertain)
          if (uncertain) {
            setRetryNotice("Mantenha os mesmos valores e tente novamente. O identificador deste lançamento evita duplicidade.")
          } else {
            clearPendingPaymentAttempt(pendingAttemptKey)
            setRetryNotice("")
          }
          setRefreshAvailable(["comanda_conflict", "payment_method_disabled", "balance_already_paid", "payment_exceeds_balance"].includes(result.code))
          return
        }
        clearPendingPaymentAttempt(pendingAttemptKey)
        setUncertainAttempt(false)
        setRetryNotice("")
        onOpenChange(false)
        onSuccess()
      } catch {
        setUncertainAttempt(true)
        setError(paymentErrorMessage("unavailable"))
        setRetryNotice("Mantenha os mesmos valores e tente novamente. O identificador deste lançamento evita duplicidade.")
      }
    })
  }

  const sequence = {
    hidden: {},
    visible: { transition: { delayChildren: reducedMotion ? 0 : 0.015, staggerChildren: reducedMotion ? 0 : 0.035 } },
  }
  const rowVariants = {
    hidden: reducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 },
    visible: { opacity: 1, y: 0, transition: { duration: reducedMotion ? 0.12 : 0.17, ease: EASE } },
  }

  return (
    <MotionConfig reducedMotion="user">
      <Dialog open={open} onOpenChange={(nextOpen) => { if (!pending) onOpenChange(nextOpen) }}>
        <DialogContent
          className="fixed inset-0 top-0 left-0 z-50 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-background/95 p-0 shadow-none backdrop-blur-2xl motion-reduce:transition-none sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[min(92dvh,48rem)] sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[1.5rem] sm:border sm:border-border/70 sm:shadow-2xl"
          showCloseButton={!pending}
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <DialogHeader className="shrink-0 border-b border-border/60 bg-gradient-to-br from-primary/[0.07] via-background to-background px-5 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-5 sm:px-7 sm:pt-5">
              <div className="flex items-start gap-3 pr-9">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-primary/15 bg-primary/10 text-primary shadow-sm"><LuReceiptText aria-hidden="true" className="size-5" /></span>
                <div className="min-w-0">
                  <DialogTitle className="text-lg font-semibold tracking-tight">Registrar pagamento</DialogTitle>
                  <DialogDescription className="mt-1 text-xs leading-5">{comandaLabel}{orderContext ? ` · ${orderContext}` : ""} · lançamento manual, sem confirmação por intermediário.</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">
              <section aria-label="Resumo da comanda" className="grid grid-cols-3 gap-2 rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm sm:p-4">
                <div><p className="text-[0.65rem] font-medium text-muted-foreground">Total</p><p className="mt-1 text-sm font-semibold tabular-nums">R$ {formatPaymentCents(effectiveTotalCents)}</p></div>
                <div className="border-l border-border/60 pl-3"><p className="text-[0.65rem] font-medium text-muted-foreground">Pago</p><p className="mt-1 text-sm font-semibold tabular-nums">R$ {formatPaymentCents(comanda.paidCents)}</p></div>
                <div className="border-l border-border/60 pl-3"><p className="text-[0.65rem] font-medium text-muted-foreground">Em aberto</p><p className="mt-1 text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-300">R$ {formatPaymentCents(effectiveBalanceCents)}</p></div>
              </section>

              <section className="space-y-3">
                  {needsTipChoice ? <section className="space-y-3 rounded-2xl border border-primary/15 bg-primary/[0.035] p-4">
                    <div><h3 className="text-sm font-semibold">Gorjeta opcional</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Confirme a escolha do cliente antes de registrar o primeiro pagamento desta comanda.</p></div>
                    <p className="text-lg font-semibold tabular-nums">R$ {formatPaymentCents(suggestedTipCents)} <span className="text-xs font-normal text-muted-foreground">sugeridos</span></p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button type="button" variant={tipDecision === "accepted" ? "default" : "outline"} aria-pressed={tipDecision === "accepted"} disabled={pending || uncertainAttempt} onClick={() => { invalidateAttempt(); setTipDecision("accepted") }} className="min-h-10 rounded-xl">Aceitar gorjeta</Button>
                      <Button type="button" variant={tipDecision === "declined" ? "default" : "outline"} aria-pressed={tipDecision === "declined"} disabled={pending || uncertainAttempt} onClick={() => { invalidateAttempt(); setTipDecision("declined") }} className="min-h-10 rounded-xl">Sem gorjeta</Button>
                    </div>
                  </section> : null}
                  <div className="flex items-end justify-between gap-3">
                    <div><h3 className="text-sm font-semibold tracking-tight">Dividir entre formas</h3><p className="mt-0.5 text-xs text-muted-foreground">Cada linha registra uma forma e seu valor.</p></div>
                    <span className="shrink-0 text-[0.65rem] font-medium text-muted-foreground">{rows.length} de {paymentMethods.length}</span>
                  </div>

                  <motion.div variants={sequence} initial={reducedMotion ? false : "hidden"} animate="visible" className="space-y-3">
                    <AnimatePresence initial={false}>
                      {rows.map((row, index) => {
                        const choices = paymentMethods.filter((method) => method.value === row.method || !usedMethods.has(method.value))
                        const method = methodByValue.get(row.method)
                        const Icon = methodIcons[row.method] ?? LuCircleDollarSign
                        const choiceOptions = choices.some((option) => option.value === row.method) ? choices : [method, ...choices].filter((option): option is PanelPaymentMethodOption => option !== undefined)
                        const choiceItems = ComboboxPrimitive.createItems(choiceOptions, {
                          getValue: (option) => option.value,
                          getLabel: (option) => option.label,
                        })
                        return (
                          <motion.div key={row.id} variants={rowVariants} initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: reducedMotion ? 1 : 0.98 }} layout={!reducedMotion} className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm sm:p-4">
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-2 text-xs font-semibold"><span className="grid size-7 place-items-center rounded-lg bg-primary/[0.08] text-primary"><Icon aria-hidden="true" className="size-3.5" /></span>Forma {index + 1}{method ? ` · ${method.label}` : ""}</span>
                              {rows.length > 1 ? <Button type="button" size="icon" variant="ghost" aria-label={`Remover forma ${index + 1}`} disabled={pending || uncertainAttempt} onClick={() => removeRow(row.id)} className="size-9 rounded-lg text-muted-foreground hover:text-destructive"><LuTrash2 aria-hidden="true" /></Button> : null}
                            </div>
                            <div className="grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:items-start">
                              <Field>
                                <FieldLabel htmlFor={`payment-method-${row.id}`}>Forma de pagamento</FieldLabel>
                                <ComboboxRoot items={choiceItems} value={row.method} onValueChange={(value) => { if (typeof value === "string") updateRow(row.id, { method: value }) }}>
                                  <ComboboxInput id={`payment-method-${row.id}`} placeholder="Selecione uma forma" className="h-11 w-full rounded-xl bg-background/80 text-sm" autoComplete="off" disabled={pending || uncertainAttempt} aria-label={`Forma de pagamento ${index + 1}`} />
                                  <ComboboxContent className="border border-border/70 bg-popover/95 shadow-xl">
                                    <ComboboxEmpty>Nenhuma forma disponível.</ComboboxEmpty>
                                    <ComboboxList>
                                      {choiceOptions.map((choice) => {
                                        const ChoiceIcon = methodIcons[choice.value] ?? LuCircleDollarSign
                                        return <ComboboxItem key={choice.value} value={choice.value} disabled={!paymentMethods.some((option) => option.value === choice.value)} className="min-h-10 rounded-lg text-sm"><ChoiceIcon aria-hidden="true" className="size-4 text-muted-foreground" />{choice.label}</ComboboxItem>
                                      })}
                                    </ComboboxList>
                                  </ComboboxContent>
                                </ComboboxRoot>
                              </Field>
                              <PaymentAmountInput
                                id={`payment-amount-${row.id}`}
                                label="Valor aplicado"
                                value={row.value}
                                onValueChange={(value) => updateRow(row.id, { value, touched: false })}
                                onBlur={() => markRowTouched(row.id)}
                                disabled={pending || uncertainAttempt}
                                error={row.touched && parsePaymentAmountCents(row.value) === null ? "Informe um valor maior que zero." : undefined}
                              />
                              {method?.kind === "cash" ? <PaymentAmountInput
                                id={`payment-cash-received-${row.id}`}
                                label="Dinheiro recebido"
                                value={row.cashReceivedValue}
                                onValueChange={(value) => updateRow(row.id, { cashReceivedValue: value, touched: false })}
                                onBlur={() => markRowTouched(row.id)}
                                disabled={pending || uncertainAttempt}
                                error={row.touched && row.cashReceivedValue.trim() !== "" && (parsedRows[index]?.receivedCents === null || (parsedRows[index]?.amountCents !== null && parsedRows[index]?.receivedCents !== null && (parsedRows[index]?.receivedCents ?? 0) < (parsedRows[index]?.amountCents ?? 0))) ? "O valor recebido precisa cobrir o valor aplicado." : undefined}
                              /> : null}
                              {method?.kind === "cash" && row.cashReceivedValue.trim() !== "" && parsedRows[index]?.receivedCents !== null && parsedRows[index]?.amountCents !== null && (parsedRows[index]?.receivedCents ?? 0) > (parsedRows[index]?.amountCents ?? 0) ? <p className="text-xs font-medium text-muted-foreground sm:col-span-2">Troco: <span className="tabular-nums text-foreground">R$ {formatPaymentCents((parsedRows[index]?.receivedCents ?? 0) - (parsedRows[index]?.amountCents ?? 0))}</span></p> : null}
                            </div>
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>
                  </motion.div>

                  <Button type="button" variant="outline" disabled={pending || uncertainAttempt || rows.length >= paymentMethods.length} onClick={addRow} className="min-h-11 w-full rounded-xl border-dashed bg-background/50">
                    <LuPlus aria-hidden="true" className="size-4" />Adicionar forma de pagamento
                  </Button>
              </section>

              <section aria-live="polite" className={`rounded-2xl border p-4 transition-colors ${exceedsBalance || (!methodsValid && !uncertainAttempt) ? "border-destructive/25 bg-destructive/[0.045]" : exactBalance ? "border-emerald-500/20 bg-emerald-500/[0.045]" : "border-primary/15 bg-primary/[0.04]"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div><p className="text-xs font-medium text-muted-foreground">Este pagamento</p><p className="mt-1 text-xl font-semibold tabular-nums">R$ {formatPaymentCents(paymentCents)}</p></div>
                    <div className="text-right"><p className="text-xs font-medium text-muted-foreground">Saldo após lançamento</p><p className={`mt-1 text-sm font-semibold tabular-nums ${exceedsBalance ? "text-destructive" : balanceAfterCents === 0 && paymentCents > 0 ? "text-emerald-700 dark:text-emerald-300" : ""}`}>R$ {formatPaymentCents(exceedsBalance ? 0 : balanceAfterCents)}</p></div>
                  </div>
                  <p className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${exceedsBalance ? "text-destructive" : exactBalance ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}`}>
                    {uncertainAttempt ? "Tentativa pendente; reenvie sem alterar para confirmar o resultado." : !methodsValid ? <><LuCircleAlert aria-hidden="true" className="size-3.5" />Uma forma foi desativada. Escolha uma opção ativa.</> : exceedsBalance ? <><LuCircleAlert aria-hidden="true" className="size-3.5" />O valor ultrapassa o saldo.</> : exactBalance ? <><LuCheck aria-hidden="true" className="size-3.5" />Saldo quitado{comanda.status === "pending" ? "; a comanda será encerrada." : "."}</> : paymentCents > 0 ? comanda.status === "pending" ? "Pagamento parcial; a comanda permanece em liquidação." : "Pagamento parcial; a comanda permanece aberta." : "Informe o valor de cada forma."}
                  </p>
              </section>

              {!cashSessionOpen ? <div role="status" className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3.5 py-3 text-xs leading-5 text-amber-800 dark:text-amber-200"><p>Abra o caixa do dia antes de registrar pagamentos.</p><Link href={cashManagementHref} className="mt-1.5 inline-flex min-h-8 items-center font-semibold underline underline-offset-4">Abrir caixa no Financeiro</Link></div> : null}
              {retryNotice ? <p role="status" className="rounded-xl border border-primary/15 bg-primary/[0.045] px-3.5 py-3 text-xs leading-5 text-foreground/80">{retryNotice}</p> : null}

              {error ? (
                <motion.div initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} role="alert" className="rounded-xl border border-destructive/20 bg-destructive/[0.045] px-3.5 py-3 text-xs leading-5 text-destructive">
                  <p className="flex items-start gap-2"><LuCircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{error}</p>
                  {refreshAvailable ? <Button type="button" variant="outline" onClick={() => { setError(""); setRefreshAvailable(false); onRefresh() }} disabled={pending} className="mt-3 min-h-10 rounded-lg border-destructive/20 bg-background/70 px-3 text-destructive hover:bg-destructive/[0.06] hover:text-destructive">Atualizar dados da comanda</Button> : null}
                </motion.div>
              ) : null}
            </div>

            <DialogFooter className="sticky bottom-0 z-10 mt-auto shrink-0 flex-col border-t border-border/70 bg-background/90 px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-4">
              <p className="text-[0.65rem] leading-5 text-muted-foreground sm:max-w-[13rem]">Registro interno para controle da equipe. O pagamento não é processado pelo Tavvi.</p>
              <Button type="button" onClick={submitPayment} disabled={!canSubmit || pending} className="min-h-11 w-full rounded-xl px-4 sm:w-auto">
                {pending ? <LuLoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <LuReceiptText aria-hidden="true" className="size-4" />}
                {pending ? uncertainAttempt ? "Confirmando resultado" : "Registrando pagamento" : uncertainAttempt ? "Reenviar com segurança" : "Registrar pagamento"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </MotionConfig>
  )
}
