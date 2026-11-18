"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { LuCheck, LuCircleAlert, LuHandCoins, LuLoaderCircle } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatPaymentCents } from "@/features/panel/payments/lib/currency"
import type { PanelTipPolicy } from "@/features/panel/payments/model"
import { closePanelComandaConsumptionAction, resolvePanelComandaTipAction } from "@/features/panel/orders/actions"
import type { PanelComandaSummaryDTO, PanelPaymentFailureCode } from "@/features/panel/orders/model"

type PendingConsumptionAttempt = { requestId: string; tipDecision: "accepted" | "declined" | null }

function readPendingConsumptionAttempt(key: string): PendingConsumptionAttempt | null {
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return null
    const candidate = JSON.parse(raw) as Partial<PendingConsumptionAttempt>
    if (typeof candidate.requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(candidate.requestId)
      || (candidate.tipDecision !== null && candidate.tipDecision !== "accepted" && candidate.tipDecision !== "declined")) return null
    return { requestId: candidate.requestId, tipDecision: candidate.tipDecision ?? null }
  } catch {
    return null
  }
}

function persistPendingConsumptionAttempt(key: string, attempt: PendingConsumptionAttempt) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(attempt))
  } catch {
    // The mounted dialog still retains the request ID for an immediate retry.
  }
}

function clearPendingConsumptionAttempt(key: string) {
  try {
    window.sessionStorage.removeItem(key)
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

function failureMessage(code: PanelPaymentFailureCode) {
  const messages: Partial<Record<PanelPaymentFailureCode, string>> = {
    invalid_input: "Confira os dados e tente novamente.",
    session_expired: "Sua sessão expirou. Entre novamente para continuar.",
    context_changed: "O restaurante ativo mudou. Atualize a página.",
    unavailable: "Não foi possível confirmar o encerramento. Tente novamente.",
    database_error: "Não foi possível confirmar os dados. Atualize a página e tente novamente.",
    forbidden: "Seu acesso ao restaurante mudou. Atualize a página.",
    comanda_not_found: "Esta comanda não está mais disponível.",
    comanda_conflict: "A comanda mudou. Atualize o Caixa e tente novamente.",
    tip_decision_required: "Escolha se o cliente aceita ou recusa a gorjeta.",
    tip_decision_conflict: "A decisão de gorjeta já foi registrada com outra opção.",
    amount_overflow: "O total excede o limite suportado. Atualize a comanda e confira os valores.",
  }
  return messages[code] ?? "Não foi possível encerrar o consumo. Atualize o Caixa e tente novamente."
}

export function ComandaConsumptionDialog({
  open,
  onOpenChange,
  comanda,
  expectedRestaurantId,
  tipPolicy,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  comanda: PanelComandaSummaryDTO
  expectedRestaurantId: string
  tipPolicy: PanelTipPolicy
  onSuccess: () => void
}) {
  const [tipDecision, setTipDecision] = useState<"accepted" | "declined" | null>(null)
  const [error, setError] = useState("")
  const [retryNotice, setRetryNotice] = useState("")
  const [uncertainAttempt, setUncertainAttempt] = useState(false)
  const [pending, startTransition] = useTransition()
  const requestIdRef = useRef<string | null>(null)
  const pendingAttemptKey = `tavvi:panel:comanda-consumption:${expectedRestaurantId}:${comanda.id}`
  const suggestedTipCents = tipPolicy.mode === "percentage"
    ? Math.round(comanda.subtotalCents * tipPolicy.percentageBps / 10000)
    : tipPolicy.mode === "fixed" ? tipPolicy.fixedCents : 0
  const needsDecision = tipPolicy.mode !== "disabled" && comanda.tipDecision === null
  const label = comanda.tableNumber === null ? "Comanda de balcão" : `Mesa ${comanda.tableNumber}`
  const consumptionIsOpen = comanda.status === "open"

  useEffect(() => {
    if (!open) return
    const pendingAttempt = readPendingConsumptionAttempt(pendingAttemptKey)
    setTipDecision(pendingAttempt?.tipDecision ?? null)
    setError("")
    setUncertainAttempt(Boolean(pendingAttempt))
    setRetryNotice(pendingAttempt ? "Há um encerramento sem resposta anterior. Reenvie a mesma decisão para confirmar sem duplicar." : "")
    requestIdRef.current = pendingAttempt?.requestId ?? null
  }, [open, pendingAttemptKey])

  function confirm() {
    if (pending || (needsDecision && tipDecision === null)) return
    const requestId = requestIdRef.current ?? crypto.randomUUID()
    requestIdRef.current = requestId
    persistPendingConsumptionAttempt(pendingAttemptKey, { requestId, tipDecision })
    setError("")
    startTransition(async () => {
      try {
        const input = { expectedRestaurantId, comandaId: comanda.id, requestId, tipDecision }
        const result = comanda.status === "open"
          ? await closePanelComandaConsumptionAction(input)
          : await resolvePanelComandaTipAction(input)
        if (!result.ok) {
          setError(failureMessage(result.code))
          const uncertain = result.code === "unavailable" || result.code === "database_error"
          setUncertainAttempt(uncertain)
          if (!uncertain) {
            clearPendingConsumptionAttempt(pendingAttemptKey)
            requestIdRef.current = null
            setRetryNotice("")
          } else {
            setRetryNotice("Mantenha a mesma decisão e tente novamente. O identificador deste encerramento evita duplicidade.")
          }
          return
        }
        clearPendingConsumptionAttempt(pendingAttemptKey)
        requestIdRef.current = null
        setUncertainAttempt(false)
        setRetryNotice("")
        onOpenChange(false)
        onSuccess()
      } catch {
        setUncertainAttempt(true)
        setError(failureMessage("unavailable"))
        setRetryNotice("Mantenha a mesma decisão e tente novamente. O identificador deste encerramento evita duplicidade.")
      }
    })
  }

  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!pending && !uncertainAttempt) onOpenChange(nextOpen) }}>
    <DialogContent className="max-w-md rounded-3xl border-border/70 p-0 shadow-2xl" showCloseButton={!pending && !uncertainAttempt}>
      <DialogHeader className="border-b border-border/60 bg-gradient-to-br from-primary/[0.07] via-background to-background px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3 pr-8">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><LuHandCoins aria-hidden="true" className="size-5" /></span>
          <div><DialogTitle className="text-base tracking-tight">{consumptionIsOpen ? "Encerrar consumo" : "Resolver gorjeta"}</DialogTitle><DialogDescription className="mt-1 text-xs leading-5">{consumptionIsOpen ? `${label} · novos pedidos serão bloqueados; o saldo poderá ser quitado depois.` : `${label} · o consumo já está encerrado. Confirme a gorjeta para atualizar o saldo.`}</DialogDescription></div>
        </div>
      </DialogHeader>
      <div className="space-y-4 px-5 py-5 sm:px-6">
        <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-card px-4 py-3">
          <span className="text-xs font-medium text-muted-foreground">Consumo até agora</span>
          <strong className="text-sm tabular-nums">R$ {formatPaymentCents(comanda.subtotalCents)}</strong>
        </div>
        {needsDecision ? <section className="space-y-3 rounded-2xl border border-primary/15 bg-primary/[0.035] p-4">
          <div><h3 className="text-sm font-semibold">Gorjeta opcional</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Confirme a escolha do cliente. A sugestão pode ser aceita ou recusada.</p></div>
          <p className="text-xl font-semibold tabular-nums">R$ {formatPaymentCents(suggestedTipCents)} <span className="text-xs font-normal text-muted-foreground">sugeridos</span></p>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={tipDecision === "accepted" ? "default" : "outline"} aria-pressed={tipDecision === "accepted"} disabled={pending || uncertainAttempt} onClick={() => { if (tipDecision !== "accepted") requestIdRef.current = null; setTipDecision("accepted") }} className="min-h-10 rounded-xl">Aceitar gorjeta</Button>
            <Button type="button" variant={tipDecision === "declined" ? "default" : "outline"} aria-pressed={tipDecision === "declined"} disabled={pending || uncertainAttempt} onClick={() => { if (tipDecision !== "declined") requestIdRef.current = null; setTipDecision("declined") }} className="min-h-10 rounded-xl">Sem gorjeta</Button>
          </div>
        </section> : tipPolicy.mode === "disabled" ? <p className="rounded-xl bg-muted/45 px-3.5 py-3 text-xs leading-5 text-muted-foreground">Gorjeta desabilitada nas configurações deste restaurante. Nenhum valor será adicionado.</p> : <p className="rounded-xl bg-muted/45 px-3.5 py-3 text-xs leading-5 text-muted-foreground">Decisão de gorjeta registrada: {comanda.tipDecision === "accepted" ? `aceita, R$ ${formatPaymentCents(comanda.tipCents)}` : "recusada"}.</p>}
        {retryNotice ? <p role="status" className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3.5 py-3 text-xs leading-5 text-amber-800 dark:text-amber-200">{retryNotice}</p> : null}
        {error ? <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/[0.05] px-3.5 py-3 text-xs leading-5 text-destructive"><LuCircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{error}</p> : null}
      </div>
      <DialogFooter className="border-t border-border/60 px-5 py-4 sm:px-6">
        <Button type="button" onClick={confirm} disabled={pending || (needsDecision && tipDecision === null)} className="min-h-11 w-full rounded-xl sm:w-auto">
          {pending ? <LuLoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <LuCheck aria-hidden="true" className="size-4" />}
          {pending ? consumptionIsOpen ? "Encerrando consumo" : "Salvando decisão" : uncertainAttempt ? "Tentar confirmar novamente" : consumptionIsOpen ? "Confirmar encerramento" : "Confirmar decisão"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
