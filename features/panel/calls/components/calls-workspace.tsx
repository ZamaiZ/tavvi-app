"use client"

import { AnimatePresence, MotionConfig, motion, useReducedMotion, type Variants } from "motion/react"
import { useEffect, useState } from "react"
import {
  LuBell,
  LuBellRing,
  LuCheck,
  LuCircleAlert,
  LuClock3,
  LuLoaderCircle,
  LuRefreshCw,
  LuVolume2,
  LuVolumeX,
  LuWifi,
  LuWifiOff,
} from "react-icons/lu"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { PanelServiceCallDTO, ServiceCallFailureCode } from "@/features/panel/calls/model"
import { claimServiceCallAction, resolveServiceCallAction } from "@/features/panel/calls/actions"
import { isCallSoundEnabled, setCallSoundEnabled } from "@/features/panel/calls/components/call-sound"
import { useCallsRealtime } from "@/features/panel/calls/components/calls-realtime-provider"

const EASE = [0.23, 1, 0.32, 1] as const
type CallTab = "pending" | "in_progress"

function failureMessage(code: ServiceCallFailureCode) {
  if (code === "claim_conflict") return "Outra pessoa da equipe assumiu este chamado. A fila foi atualizada."
  if (code === "resolve_conflict") return "Este chamado já foi concluído ou ainda não foi assumido. A fila foi atualizada."
  if (code === "session_expired") return "Sua sessão expirou. Entre novamente para continuar."
  if (code === "context_changed") return "O restaurante ativo mudou. Atualize a página para continuar."
  if (code === "forbidden") return "Sua conta não tem acesso a este restaurante."
  if (code === "not_found") return "Este chamado já não está disponível. A fila foi atualizada."
  return "Não foi possível atualizar o chamado. Confira a conexão e tente novamente."
}

function elapsedLabel(isoDate: string, now: number) {
  const elapsed = Math.max(0, now - new Date(isoDate).getTime())
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 1) return "Agora mesmo"
  if (minutes < 60) return `Há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `Há ${hours} h ${remainder} min` : `Há ${hours} h`
}

function CallCard({
  call,
  busy,
  now,
  itemVariants,
  onAction,
}: {
  call: PanelServiceCallDTO
  busy: boolean
  now: number
  itemVariants: Variants
  onAction: (call: PanelServiceCallDTO) => void
}) {
  const pending = call.status === "pending"
  return (
    <motion.div
      layout
      exit={{ opacity: 0, transform: "translateY(-5px)" }}
      transition={{ duration: 0.18, ease: EASE }}
      variants={itemVariants}
    >
      <Card className="rounded-2xl border border-border/70 bg-card shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-primary/20 hover:shadow-md motion-reduce:transition-none">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Identificador de mesa</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">Mesa {call.tableNumber}</h2>
            </div>
            <Badge
              variant="outline"
              className={pending
                ? "h-7 gap-1.5 rounded-full border-amber-500/25 bg-amber-500/[0.08] px-2.5 text-[0.68rem] text-amber-700 dark:text-amber-300"
                : "h-7 gap-1.5 rounded-full border-emerald-500/25 bg-emerald-500/[0.08] px-2.5 text-[0.68rem] text-emerald-700 dark:text-emerald-300"}
            >
              {pending ? <LuClock3 aria-hidden="true" /> : <LuCheck aria-hidden="true" />}
              {pending ? "Aguardando" : "Em atendimento"}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><LuBell aria-hidden="true" className="size-3.5" />Solicitado {elapsedLabel(call.createdAt, now).toLocaleLowerCase("pt-BR")}</span>
            {call.claimedAt ? <span>Assumido {new Date(call.claimedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span> : null}
          </div>

          <Button
            type="button"
            disabled={busy}
            aria-busy={busy}
            onClick={() => onAction(call)}
            className="min-h-11 w-full rounded-xl font-semibold shadow-sm transition-[transform,box-shadow] duration-150 active:scale-[0.99] motion-reduce:active:scale-100 motion-reduce:transition-none"
          >
            {busy ? <LuLoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : pending ? <LuBellRing aria-hidden="true" /> : <LuCheck aria-hidden="true" />}
            {busy ? "Atualizando chamado" : pending ? "Assumir chamado" : "Concluir atendimento"}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function EmptyQueue({ activeTab, allCount }: { activeTab: CallTab; allCount: number }) {
  const hasCallsInOtherTab = allCount > 0
  return (
    <div className="rounded-3xl border border-dashed border-border/80 bg-card/55 px-5 py-12 text-center sm:px-8">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/[0.08] text-primary">
        {activeTab === "pending" ? <LuBell aria-hidden="true" className="size-5" /> : <LuCheck aria-hidden="true" className="size-5" />}
      </span>
      <h2 className="mt-4 text-base font-semibold tracking-tight">
        {hasCallsInOtherTab ? "Nenhum chamado nesta etapa" : "Tudo em dia por aqui"}
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
        {activeTab === "pending"
          ? hasCallsInOtherTab ? "Os chamados ativos já foram assumidos pela equipe." : "Quando uma mesa chamar, o pedido aparece aqui em tempo real."
          : "Os atendimentos assumidos vão aparecer aqui até serem concluídos."}
      </p>
    </div>
  )
}

export function CallsWorkspace({
  restaurantId,
  initialCalls,
  initialNow,
}: {
  restaurantId: string
  initialCalls: PanelServiceCallDTO[]
  initialNow: number
}) {
  const prefersReducedMotion = useReducedMotion()
  const reducedMotion = prefersReducedMotion === true
  const { connected, refresh } = useCallsRealtime()
  const [calls, setCalls] = useState(initialCalls)
  const [activeTab, setActiveTab] = useState<CallTab>("pending")
  const [busyCallId, setBusyCallId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ kind: "error" | "success"; text: string } | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [now, setNow] = useState(initialNow)

  useEffect(() => setCalls(initialCalls), [initialCalls])
  useEffect(() => setSoundEnabled(isCallSoundEnabled()), [])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const pendingCalls = calls.filter((call) => call.status === "pending")
  const inProgressCalls = calls.filter((call) => call.status === "in_progress")
  const visibleCalls = activeTab === "pending" ? pendingCalls : inProgressCalls
  const sequenceVariants = {
    hidden: {},
    visible: { transition: { delayChildren: reducedMotion ? 0 : 0.025, staggerChildren: reducedMotion ? 0 : 0.045 } },
  }
  const itemVariants = {
    hidden: reducedMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(7px)" },
    visible: { opacity: 1, transform: "translateY(0px)", transition: { duration: reducedMotion ? 0.12 : 0.18, ease: EASE } },
  }

  async function handleCallAction(call: PanelServiceCallDTO) {
    setBusyCallId(call.id)
    setFeedback(null)
    try {
      const result = call.status === "pending"
        ? await claimServiceCallAction({ expectedRestaurantId: restaurantId, callId: call.id })
        : await resolveServiceCallAction({ expectedRestaurantId: restaurantId, callId: call.id })

      if (result.ok) {
        setFeedback({ kind: "success", text: call.status === "pending" ? `Chamado da mesa ${call.tableNumber} assumido.` : `Atendimento da mesa ${call.tableNumber} concluído.` })
      } else {
        setFeedback({ kind: "error", text: failureMessage(result.code) })
      }
    } catch {
      setFeedback({ kind: "error", text: "Não foi possível conectar ao servidor. A fila será sincronizada novamente." })
    } finally {
      await refresh()
      setBusyCallId(null)
    }
  }

  async function toggleSound(checked: boolean) {
    setSoundEnabled(checked)
    await setCallSoundEnabled(checked)
  }

  return (
    <MotionConfig reducedMotion="user">
      <main className="min-h-svh">
        <motion.div
          initial={reducedMotion ? false : "hidden"}
          animate="visible"
          variants={sequenceVariants}
          className="mx-auto w-full max-w-[1320px] space-y-5 px-4 pb-32 sm:px-6 md:pb-10 lg:px-8"
        >
          <motion.section variants={itemVariants} aria-label="Resumo dos chamados" className="grid gap-3 sm:grid-cols-2">
            <Card className="relative overflow-hidden rounded-2xl border-amber-500/15 bg-gradient-to-br from-amber-500/[0.08] via-card to-card shadow-sm">
              <CardContent className="flex items-center justify-between gap-4 p-4 sm:p-5">
                <div><p className="text-xs font-medium text-muted-foreground">Aguardando atendimento</p><p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{pendingCalls.length}</p></div>
                <span className="grid size-11 place-items-center rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-300"><LuBellRing aria-hidden="true" className="size-5" /></span>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.07] via-card to-card shadow-sm">
              <CardContent className="flex items-center justify-between gap-4 p-4 sm:p-5">
                <div><p className="text-xs font-medium text-muted-foreground">Em atendimento</p><p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{inProgressCalls.length}</p></div>
                <span className="grid size-11 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><LuCheck aria-hidden="true" className="size-5" /></span>
              </CardContent>
            </Card>
          </motion.section>

          <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/75 px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              {connected ? <LuWifi aria-hidden="true" className="size-4 text-emerald-600" /> : <LuWifiOff aria-hidden="true" className="size-4 text-amber-600" />}
              <div><p className="text-xs font-semibold">{connected ? "Atualização em tempo real ativa" : "Reconectando à fila"}</p><p className="mt-0.5 text-[0.68rem] text-muted-foreground">{connected ? "Novos chamados aparecem sem atualizar a página." : "A fila será sincronizada automaticamente ao reconectar."}</p></div>
              {!connected ? <Button type="button" variant="ghost" size="icon-sm" aria-label="Sincronizar fila agora" title="Sincronizar fila agora" onClick={() => void refresh()} className="ml-1 rounded-lg"><LuRefreshCw aria-hidden="true" /></Button> : null}
            </div>
            <div className="flex min-h-11 items-center gap-2.5 rounded-xl px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground motion-reduce:transition-none">
              {soundEnabled ? <LuVolume2 aria-hidden="true" className="size-4 text-primary" /> : <LuVolumeX aria-hidden="true" className="size-4" />}
              <span id="calls-sound-toggle-label">Som de novos chamados</span>
              <Switch checked={soundEnabled} onCheckedChange={(checked) => void toggleSound(checked)} aria-labelledby="calls-sound-toggle-label" />
            </div>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as CallTab)} aria-label="Filtrar chamados" className="gap-4">
              <div className="-mx-1 [scrollbar-width:none] overflow-x-auto overscroll-x-contain px-1 pb-1 [&::-webkit-scrollbar]:hidden">
                <TabsList className="h-11 w-full max-w-[30rem] justify-start gap-1 rounded-xl bg-muted/55 p-1 sm:w-fit">
                  <TabsTrigger value="pending" className="h-9 flex-1 gap-2 rounded-lg px-3.5 text-xs data-active:bg-background data-active:text-foreground data-active:shadow-sm sm:flex-none">
                    <LuBell aria-hidden="true" /><span>Aguardando</span><span className="rounded-full bg-foreground/5 px-1.5 py-0.5 text-[0.625rem] tabular-nums">{pendingCalls.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="in_progress" className="h-9 flex-1 gap-2 rounded-lg px-3.5 text-xs data-active:bg-background data-active:text-foreground data-active:shadow-sm sm:flex-none">
                    <LuCheck aria-hidden="true" /><span>Em atendimento</span><span className="rounded-full bg-foreground/5 px-1.5 py-0.5 text-[0.625rem] tabular-nums">{inProgressCalls.length}</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value={activeTab} className="mt-0 space-y-4">
                <AnimatePresence mode="wait" initial={false}>
                  {feedback ? (
                    <motion.div
                      key={`${feedback.kind}:${feedback.text}`}
                      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(-4px)" }}
                      animate={{ opacity: 1, transform: "translateY(0px)" }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      role={feedback.kind === "error" ? "alert" : "status"}
                      className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${feedback.kind === "error" ? "border-destructive/20 bg-destructive/[0.045] text-destructive" : "border-emerald-500/20 bg-emerald-500/[0.055] text-emerald-700 dark:text-emerald-300"}`}
                    >
                      {feedback.kind === "error" ? <LuCircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : <LuCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
                      <p>{feedback.text}</p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                {visibleCalls.length ? (
                  <motion.section
                    key={activeTab}
                    initial={reducedMotion ? false : "hidden"}
                    animate="visible"
                    variants={sequenceVariants}
                    aria-label={activeTab === "pending" ? "Chamados aguardando" : "Chamados em atendimento"}
                    className="grid gap-3 lg:grid-cols-2"
                  >
                    <AnimatePresence initial={false} mode="popLayout">
                      {visibleCalls.map((call) => (
                        <CallCard key={call.id} call={call} busy={busyCallId === call.id} now={now} itemVariants={itemVariants} onAction={handleCallAction} />
                      ))}
                    </AnimatePresence>
                  </motion.section>
                ) : (
                  <motion.div variants={itemVariants}>
                    <EmptyQueue activeTab={activeTab} allCount={calls.length} />
                  </motion.div>
                )}
              </TabsContent>
            </Tabs>
          </motion.div>
        </motion.div>
      </main>
    </MotionConfig>
  )
}
