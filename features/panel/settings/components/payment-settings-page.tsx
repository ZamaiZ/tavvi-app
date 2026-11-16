"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { MotionConfig, motion, useReducedMotion } from "motion/react"
import {
  LuBanknote,
  LuCreditCard,
  LuHandshake,
  LuLoaderCircle,
  LuSave,
  LuWalletCards,
} from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { PANEL_PAYMENT_METHODS, type PanelPaymentMethod } from "@/features/panel/payments/model"
import { updatePanelPaymentMethodsAction } from "@/features/panel/settings/actions"

const EASE = [0.23, 1, 0.32, 1] as const

const methodIcons = {
  cash: LuBanknote,
  debit: LuCreditCard,
  credit: LuCreditCard,
  meal_voucher: LuWalletCards,
  food_voucher: LuWalletCards,
  partnership: LuHandshake,
}

const methodDescriptions: Record<PanelPaymentMethod, string> = {
  cash: "Registro manual do valor aplicado à comanda.",
  debit: "Registre pagamentos feitos no débito.",
  credit: "Registre pagamentos feitos no crédito.",
  meal_voucher: "Vale-alimentação.",
  food_voucher: "Vale-refeição.",
  partnership: "Valores pagos por convênio ou parceria.",
}

export function PaymentSettingsPage({
  expectedRestaurantId,
  initialEnabledMethods,
}: {
  expectedRestaurantId: string
  initialEnabledMethods: PanelPaymentMethod[]
}) {
  const router = useRouter()
  const reducedMotion = useReducedMotion() === true
  const [enabledMethods, setEnabledMethods] = useState<PanelPaymentMethod[]>(initialEnabledMethods)
  const [savedMethods, setSavedMethods] = useState<PanelPaymentMethod[]>(initialEnabledMethods)
  const [message, setMessage] = useState("")
  const [messageKind, setMessageKind] = useState<"success" | "error">("success")
  const [pending, startTransition] = useTransition()

  const dirty = useMemo(
    () => PANEL_PAYMENT_METHODS.some((method) => enabledMethods.includes(method.value) !== savedMethods.includes(method.value)),
    [enabledMethods, savedMethods],
  )
  const noMethodsEnabled = enabledMethods.length === 0

  const sequence = {
    hidden: {},
    visible: {
      transition: { delayChildren: reducedMotion ? 0 : 0.02, staggerChildren: reducedMotion ? 0 : 0.045 },
    },
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

  function save() {
    if (!dirty || noMethodsEnabled || pending) return
    setMessage("")
    startTransition(async () => {
      try {
        const result = await updatePanelPaymentMethodsAction({
          expectedRestaurantId,
          enabledMethods,
        })
        if (!result.ok) {
          const messages: Record<string, string> = {
            invalid_input: "Mantenha ao menos uma forma de pagamento ativa.",
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
        setMessageKind("success")
        setMessage("Opções de pagamento salvas.")
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
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <LuCreditCard aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold tracking-tight">Formas de pagamento</h2>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                  Escolha quais opções sua equipe poderá registrar no Caixa. Os lançamentos são manuais; o Tavvi não processa nem confirma pagamentos.
                </p>
              </div>
            </div>
          </motion.section>

          <motion.div variants={item} className="grid gap-3 sm:grid-cols-2">
            {PANEL_PAYMENT_METHODS.map((method) => {
              const Icon = methodIcons[method.value]
              const checked = enabledMethods.includes(method.value)
              return (
                <Card
                  key={method.value}
                  className={"rounded-2xl border-border/70 bg-card shadow-sm transition-[border-color,background-color,box-shadow] duration-200 " + (checked ? "border-primary/20 bg-primary/[0.025] shadow-primary/5" : "")}
                >
                  <CardContent className="flex min-h-[5.75rem] items-center gap-3 p-3.5 sm:p-4">
                    <span className={"grid size-11 shrink-0 place-items-center rounded-xl transition-colors " + (checked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{method.label}</p>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{methodDescriptions[method.value]}</p>
                    </div>
                    <Switch
                      checked={checked}
                      disabled={pending}
                      aria-label={"Ativar " + method.label}
                      onCheckedChange={(nextChecked) => toggleMethod(method.value, nextChecked)}
                    />
                  </CardContent>
                </Card>
              )
            })}
          </motion.div>

          {noMethodsEnabled ? (
            <motion.p variants={item} role="alert" className="rounded-xl border border-destructive/20 bg-destructive/[0.05] px-3.5 py-3 text-xs leading-5 text-destructive">
              Ative ao menos uma forma para salvar e permitir novos lançamentos no Caixa.
            </motion.p>
          ) : null}

          {message ? (
            <motion.p
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -3 }}
              animate={{ opacity: 1, y: 0 }}
              role={messageKind === "error" ? "alert" : "status"}
              className={"rounded-xl border px-3.5 py-3 text-xs leading-5 " + (messageKind === "error" ? "border-destructive/20 bg-destructive/[0.05] text-destructive" : "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300")}
            >
              {message}
            </motion.p>
          ) : null}

          <motion.div variants={item} className="flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">Os registros existentes continuam no histórico mesmo se uma opção for desativada.</p>
            <Button type="button" onClick={save} disabled={!dirty || noMethodsEnabled || pending} className="min-h-11 rounded-xl px-4">
              {pending ? <LuLoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <LuSave aria-hidden="true" className="size-4" />}
              {pending ? "Salvando opções" : "Salvar opções"}
            </Button>
          </motion.div>
        </motion.div>
      </main>
    </MotionConfig>
  )
}
