"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { MotionConfig, motion, useReducedMotion } from "motion/react"
import {
  LuBanknote,
  LuCreditCard,
  LuHandshake,
  LuHandCoins,
  LuLoaderCircle,
  LuPlus,
  LuQrCode,
  LuSave,
  LuTrash2,
  LuWalletCards,
} from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { PANEL_PAYMENT_METHODS, type PanelCustomPaymentMethodDTO, type PanelPaymentMethod, type PanelTipPolicy, type PaymentMethodKind } from "@/features/panel/payments/model"
import { updatePanelPaymentMethodsAction } from "@/features/panel/settings/actions"

const EASE = [0.23, 1, 0.32, 1] as const

type CustomMethodDraft = Omit<PanelCustomPaymentMethodDTO, "id"> & { id: string | null }

function parseTipAmountCents(value: string): number | null {
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(value.trim())
  if (!match || match[1].length > 16) return null
  const cents = BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? "").padEnd(2, "0") || "0")
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null
}

const methodIcons = {
  cash: LuBanknote,
  debit: LuCreditCard,
  credit: LuCreditCard,
  pix: LuQrCode,
  meal_voucher: LuWalletCards,
  food_voucher: LuWalletCards,
  partnership: LuHandshake,
}

const methodDescriptions: Record<PanelPaymentMethod, string> = {
  cash: "Valor aplicado em dinheiro. Entra na conferência física do caixa.",
  debit: "Pagamentos feitos no débito.",
  credit: "Pagamentos feitos no crédito.",
  pix: "PIX registrado manualmente pela equipe.",
  meal_voucher: "Vale-alimentação.",
  food_voucher: "Vale-refeição.",
  partnership: "Valores pagos por convênio ou parceria.",
}

export function PaymentSettingsPage({
  expectedRestaurantId,
  initialEnabledMethods,
  initialCustomMethods,
  initialTipPolicy,
}: {
  expectedRestaurantId: string
  initialEnabledMethods: PanelPaymentMethod[]
  initialCustomMethods: PanelCustomPaymentMethodDTO[]
  initialTipPolicy: PanelTipPolicy
}) {
  const router = useRouter()
  const reducedMotion = useReducedMotion() === true
  const [enabledMethods, setEnabledMethods] = useState<PanelPaymentMethod[]>(initialEnabledMethods)
  const [savedMethods, setSavedMethods] = useState<PanelPaymentMethod[]>(initialEnabledMethods)
  const [customMethods, setCustomMethods] = useState<CustomMethodDraft[]>(initialCustomMethods)
  const [savedCustomMethods, setSavedCustomMethods] = useState<PanelCustomPaymentMethodDTO[]>(initialCustomMethods)
  const [tipMode, setTipMode] = useState<PanelTipPolicy["mode"]>(initialTipPolicy.mode)
  const [tipPercentage, setTipPercentage] = useState(initialTipPolicy.mode === "percentage" ? String(initialTipPolicy.percentageBps / 100) : "10")
  const [tipFixedAmount, setTipFixedAmount] = useState(initialTipPolicy.mode === "fixed" ? (initialTipPolicy.fixedCents / 100).toFixed(2) : "")
  const [savedTipPolicy, setSavedTipPolicy] = useState<PanelTipPolicy>(initialTipPolicy)
  const [newLabel, setNewLabel] = useState("")
  const [newKind, setNewKind] = useState<PaymentMethodKind>("electronic")
  const [message, setMessage] = useState("")
  const [messageKind, setMessageKind] = useState<"success" | "error">("success")
  const [pending, startTransition] = useTransition()

  const parsedTipAmountCents = parseTipAmountCents(tipMode === "percentage" ? tipPercentage : tipFixedAmount)
  const tipPolicyDraft: PanelTipPolicy | null = tipMode === "disabled"
    ? { mode: "disabled" }
    : tipMode === "percentage"
      ? parsedTipAmountCents !== null && parsedTipAmountCents >= 1 && parsedTipAmountCents <= 10000
        ? { mode: "percentage", percentageBps: parsedTipAmountCents }
        : null
      : parsedTipAmountCents !== null && parsedTipAmountCents >= 1
        ? { mode: "fixed", fixedCents: parsedTipAmountCents }
        : null
  const tipPolicyValid = tipPolicyDraft !== null
  const dirty = useMemo(
    () => JSON.stringify(enabledMethods) !== JSON.stringify(savedMethods)
      || JSON.stringify(customMethods) !== JSON.stringify(savedCustomMethods)
      || tipPolicyDraft === null
      || JSON.stringify(tipPolicyDraft) !== JSON.stringify(savedTipPolicy),
    [enabledMethods, savedMethods, customMethods, savedCustomMethods, tipPolicyDraft, savedTipPolicy],
  )
  const noMethodsEnabled = enabledMethods.length === 0 && !customMethods.some((method) => method.isActive)

  const sequence = {
    hidden: {},
    visible: { transition: { delayChildren: reducedMotion ? 0 : 0.02, staggerChildren: reducedMotion ? 0 : 0.045 } },
  }
  const item = {
    hidden: reducedMotion ? { opacity: 0 } : { opacity: 0, y: 7 },
    visible: { opacity: 1, y: 0, transition: { duration: reducedMotion ? 0.12 : 0.19, ease: EASE } },
  }

  function toggleMethod(method: PanelPaymentMethod, checked: boolean) {
    setMessage("")
    setEnabledMethods((current) => checked
      ? PANEL_PAYMENT_METHODS.filter((entry) => entry.value === method || current.includes(entry.value)).map((entry) => entry.value)
      : current.filter((entry) => entry !== method))
  }

  function addCustomMethod() {
    const label = newLabel.trim()
    if (!label || customMethods.length >= 20 || pending) return
    if (customMethods.some((method) => method.label.trim().toLocaleLowerCase("pt-BR") === label.toLocaleLowerCase("pt-BR"))) {
      setMessageKind("error")
      setMessage("Já existe uma forma personalizada com esse nome.")
      return
    }
    setMessage("")
    setCustomMethods((current) => [...current, { id: null, label, kind: newKind, isActive: true }])
    setNewLabel("")
    setNewKind("electronic")
  }

  function updateCustomMethod(id: string | null, index: number, patch: Partial<CustomMethodDraft>) {
    setMessage("")
    setCustomMethods((current) => current.map((method, methodIndex) =>
      method.id === id && id !== null || id === null && methodIndex === index
        ? { ...method, ...patch }
        : method,
    ))
  }

  function save() {
    if (!dirty || !tipPolicyDraft || noMethodsEnabled || pending) return
    setMessage("")
    startTransition(async () => {
      try {
        const result = await updatePanelPaymentMethodsAction({
          expectedRestaurantId,
          enabledMethods,
          customMethods,
          tipPolicy: tipPolicyDraft,
        })
        if (!result.ok) {
          const messages: Record<string, string> = {
            invalid_input: "Confira as formas de pagamento e mantenha pelo menos uma ativa.",
            duplicate_method: "Já existe uma forma personalizada com esse nome.",
            session_expired: "Sua sessão expirou. Entre novamente para salvar.",
            context_changed: "O restaurante ativo mudou. Atualize a página antes de salvar.",
            forbidden: "Seu acesso ao restaurante mudou. Atualize a página e tente novamente.",
            unavailable: "Não foi possível salvar agora. Confira a conexão e tente novamente.",
            database_error: "Não foi possível confirmar as opções salvas. Atualize a página e tente novamente.",
          }
          setMessageKind("error")
          setMessage(messages[result.code] ?? "Não foi possível salvar as opções.")
          return
        }
        setEnabledMethods(result.enabledMethods)
        setSavedMethods(result.enabledMethods)
        setCustomMethods(result.customMethods)
        setSavedCustomMethods(result.customMethods)
        setSavedTipPolicy(result.tipPolicy)
        setTipMode(result.tipPolicy.mode)
        if (result.tipPolicy.mode === "percentage") setTipPercentage(String(result.tipPolicy.percentageBps / 100))
        if (result.tipPolicy.mode === "fixed") setTipFixedAmount((result.tipPolicy.fixedCents / 100).toFixed(2))
        setMessageKind("success")
        setMessage("Configurações financeiras salvas.")
        router.refresh()
      } catch {
        setMessageKind("error")
        setMessage("Não foi possível conectar ao servidor. Tente novamente.")
      }
    })
  }

  return (
    <MotionConfig reducedMotion="user">
      <main className="mx-auto flex min-h-full w-full max-w-[1120px] flex-1 flex-col px-4 py-5 sm:px-6 md:py-6 lg:px-8">
        <motion.div
          initial={reducedMotion ? false : "hidden"}
          animate="visible"
          variants={sequence}
          className="mx-auto flex w-full max-w-[900px] flex-col gap-5 sm:gap-6"
        >
          <motion.section variants={item} className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.075] via-card to-card p-4 shadow-sm sm:p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><LuCreditCard aria-hidden="true" className="size-5" /></span>
              <div>
                <h2 className="text-sm font-semibold tracking-tight">Formas de pagamento</h2>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Escolha quais opções a equipe poderá registrar no Caixa. Os lançamentos são manuais; o Tavvi não processa nem confirma pagamentos.</p>
              </div>
            </div>
          </motion.section>

          <motion.section variants={item} className="space-y-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><LuHandCoins aria-hidden="true" className="size-5" /></span>
              <div>
                <h2 className="text-sm font-semibold tracking-tight">Gorjeta sugerida</h2>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">A configuração define apenas a sugestão apresentada ao encerrar o consumo. A gorjeta é opcional e só entra na comanda quando o cliente aceita.</p>
              </div>
            </div>
            <div role="group" aria-label="Modalidade de gorjeta" className="grid gap-2 sm:grid-cols-3">
              {([
                ["disabled", "Desabilitada", "Não sugerir gorjeta"],
                ["percentage", "Percentual", "Parte do consumo"],
                ["fixed", "Valor fixo", "Mesmo valor por comanda"],
              ] as const).map(([mode, label, description]) => (
                <Button key={mode} type="button" variant={tipMode === mode ? "default" : "outline"} aria-pressed={tipMode === mode} disabled={pending} onClick={() => { setTipMode(mode); setMessage("") }} className="h-auto min-h-14 justify-start rounded-xl px-3 py-2.5 text-left">
                  <span><span className="block text-xs font-semibold">{label}</span><span className={`mt-0.5 block text-[0.65rem] font-normal ${tipMode === mode ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{description}</span></span>
                </Button>
              ))}
            </div>
            {tipMode === "percentage" ? <label className="grid max-w-xs gap-1.5 text-xs font-medium text-muted-foreground">Percentual sugerido (%)
              <Input type="number" inputMode="decimal" min="0.01" max="100" step="0.01" value={tipPercentage} disabled={pending} onChange={(event) => { setTipPercentage(event.target.value); setMessage("") }} aria-invalid={!tipPolicyValid} className="h-10 rounded-xl bg-background text-sm text-foreground" />
              <span className="text-[0.68rem] font-normal leading-5">Calculado sobre o consumo no encerramento. O cliente pode aceitar ou recusar.</span>
            </label> : null}
            {tipMode === "fixed" ? <label className="grid max-w-xs gap-1.5 text-xs font-medium text-muted-foreground">Valor sugerido (R$)
              <Input type="number" inputMode="decimal" min="0.01" step="0.01" value={tipFixedAmount} disabled={pending} onChange={(event) => { setTipFixedAmount(event.target.value); setMessage("") }} aria-invalid={!tipPolicyValid} className="h-10 rounded-xl bg-background text-sm text-foreground" />
              <span className="text-[0.68rem] font-normal leading-5">O valor fica registrado separado do consumo e só é cobrado com aceite.</span>
            </label> : null}
            {!tipPolicyValid ? <p role="alert" className="text-xs text-destructive">{tipMode === "percentage" ? "Informe um percentual entre 0,01% e 100%." : "Informe um valor fixo maior que zero."}</p> : null}
          </motion.section>

          <motion.div variants={item} className="grid gap-3 sm:grid-cols-2">
            {PANEL_PAYMENT_METHODS.map((method) => {
              const Icon = methodIcons[method.value]
              const checked = enabledMethods.includes(method.value)
              return (
                <Card key={method.value} className={`rounded-2xl border-border/70 bg-card shadow-sm transition-[border-color,background-color,box-shadow] duration-200 ${checked ? "border-primary/20 bg-primary/[0.025] shadow-primary/5" : ""}`}>
                  <CardContent className="flex min-h-[5.75rem] items-center gap-3 p-3.5 sm:p-4">
                    <span className={`grid size-11 shrink-0 place-items-center rounded-xl transition-colors ${checked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}><Icon aria-hidden="true" className="size-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{method.label}</p>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{methodDescriptions[method.value]}</p>
                    </div>
                    <Switch checked={checked} disabled={pending} aria-label={`Ativar ${method.label}`} onCheckedChange={(nextChecked) => toggleMethod(method.value, nextChecked)} />
                  </CardContent>
                </Card>
              )
            })}
          </motion.div>

          <motion.section variants={item} className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
            <div>
              <h3 className="text-sm font-semibold tracking-tight">Formas personalizadas</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Defina se cada forma movimenta dinheiro físico. Essa classificação é mantida nos lançamentos antigos.</p>
            </div>
            {customMethods.length ? (
              <div className="space-y-2">
                {customMethods.map((method, index) => {
                  const Icon = method.kind === "cash" ? LuBanknote : LuCreditCard
                  return (
                    <div key={method.id ?? `draft-${index}`} className={`flex flex-wrap items-center gap-3 rounded-xl border px-3 py-3 ${method.isActive ? "border-border/70 bg-background" : "border-border/50 bg-muted/30 opacity-75"}`}>
                      <span className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground"><Icon aria-hidden="true" className="size-4" /></span>
                      <div className="min-w-0 flex-1">
                        <Input value={method.label} disabled={pending} onChange={(event) => updateCustomMethod(method.id, index, { label: event.target.value })} maxLength={40} aria-label={`Nome de ${method.label}`} className="h-9 max-w-sm rounded-lg bg-background text-sm" />
                        <p className="text-[0.68rem] text-muted-foreground">{method.kind === "cash" ? "Entra no saldo físico do caixa" : "Registro eletrônico"}</p>
                      </div>
                      {method.id === null ? (
                        <Button type="button" variant="ghost" size="icon-sm" disabled={pending} aria-label={`Remover ${method.label}`} onClick={() => setCustomMethods((current) => current.filter((_, itemIndex) => itemIndex !== index))}><LuTrash2 aria-hidden="true" className="size-4" /></Button>
                      ) : null}
                      <select value={method.kind} disabled={pending} aria-label={`Tipo de ${method.label}`} onChange={(event) => updateCustomMethod(method.id, index, { kind: event.target.value as PaymentMethodKind })} className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs"><option value="electronic">Eletrônica</option><option value="cash">Dinheiro físico</option></select>
                      <Switch checked={method.isActive} disabled={pending} aria-label={`Ativar ${method.label}`} onCheckedChange={(isActive) => updateCustomMethod(method.id, index, { isActive })} />
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border/70 px-4 py-5 text-center text-xs text-muted-foreground">Nenhuma forma personalizada adicionada.</p>
            )}

            <div className="grid gap-2 rounded-xl border border-border/60 bg-muted/25 p-3 sm:grid-cols-[minmax(0,1fr)_190px_auto] sm:items-end">
              <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">Nome
                <Input value={newLabel} disabled={pending || customMethods.length >= 20} onChange={(event) => setNewLabel(event.target.value)} maxLength={40} placeholder="Ex.: Convênio local" className="h-10 rounded-xl bg-background text-sm text-foreground" />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">Tipo
                <select value={newKind} disabled={pending || customMethods.length >= 20} onChange={(event) => setNewKind(event.target.value as PaymentMethodKind)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="electronic">Eletrônica</option><option value="cash">Dinheiro físico</option>
                </select>
              </label>
              <Button type="button" variant="outline" onClick={addCustomMethod} disabled={pending || !newLabel.trim() || customMethods.length >= 20} className="min-h-10 rounded-xl"><LuPlus aria-hidden="true" className="size-4" />Adicionar</Button>
            </div>
          </motion.section>

          {noMethodsEnabled ? <motion.p variants={item} role="alert" className="rounded-xl border border-destructive/20 bg-destructive/[0.05] px-3.5 py-3 text-xs leading-5 text-destructive">Mantenha ao menos uma forma de pagamento ativa para salvar e permitir novos lançamentos no Caixa.</motion.p> : null}
          {message ? <motion.p initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} role={messageKind === "error" ? "alert" : "status"} className={`rounded-xl border px-3.5 py-3 text-xs leading-5 ${messageKind === "error" ? "border-destructive/20 bg-destructive/[0.05] text-destructive" : "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300"}`}>{message}</motion.p> : null}

          <motion.div variants={item} className="flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">Meios usados continuam identificados nos lançamentos anteriores, mesmo quando desativados.</p>
            <Button type="button" onClick={save} disabled={!dirty || !tipPolicyValid || noMethodsEnabled || pending} className="min-h-11 rounded-xl px-4">
              {pending ? <LuLoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <LuSave aria-hidden="true" className="size-4" />}
              {pending ? "Salvando opções" : "Salvar opções"}
            </Button>
          </motion.div>
        </motion.div>
      </main>
    </MotionConfig>
  )
}
