"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react"
import { MotionConfig, motion, useReducedMotion } from "motion/react"
import {
  LuBellRing,
  LuCheck,
  LuCircleAlert,
  LuClock3,
  LuLoaderCircle,
  LuWifiOff,
} from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { getPublicServiceCallStatusAction, requestPublicServiceCallAction } from "@/features/public-profile/actions"
import type { PublicServiceCallDTO, PublicServiceCallStatus } from "@/features/public-profile/calls-model"
import { createSupabasePublicBrowserClient } from "@/lib/supabase/public-browser"

import styles from "@/features/public-profile/styles/public-profile.module.css"

const STATUS_COPY: Record<PublicServiceCallStatus, string> = {
  pending: "A equipe recebeu o chamado e já vai até você.",
  in_progress: "Uma pessoa da equipe assumiu o atendimento.",
  resolved: "O último atendimento foi concluído.",
}
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseBroadcast(value: unknown, tableNumber: number): PublicServiceCallDTO | null {
  if (!value || typeof value !== "object") return null
  const root = value as { payload?: unknown }
  const payload = root.payload && typeof root.payload === "object"
    ? root.payload as { callId?: unknown; status?: unknown; tableNumber?: unknown }
    : value as { callId?: unknown; status?: unknown; tableNumber?: unknown }
  if (typeof payload.callId !== "string" || !UUID_PATTERN.test(payload.callId)) return null
  if (payload.status !== "pending" && payload.status !== "in_progress" && payload.status !== "resolved") return null
  if (payload.tableNumber !== undefined && payload.tableNumber !== tableNumber) return null
  return { callId: payload.callId, tableNumber, status: payload.status }
}

function actionMessage(code: string) {
  if (code === "hourly_limit") return "Este identificador atingiu o limite temporário. Peça ajuda a alguém da equipe."
  return "Não foi possível enviar agora. Confira sua conexão e tente novamente."
}

export function PublicServiceCall({
  token,
  tableNumber,
  style,
}: {
  token: string
  tableNumber: number
  style: CSSProperties
}) {
  const prefersReducedMotion = useReducedMotion()
  const reducedMotion = prefersReducedMotion === true
  const [call, setCall] = useState<PublicServiceCallDTO | null>(null)
  const [statusKnown, setStatusKnown] = useState(false)
  const [checking, setChecking] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [requestLimited, setRequestLimited] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const realtimeRevision = useRef(0)
  const statusRequestSequence = useRef(0)

  const syncStatus = useCallback(async () => {
    const requestSequence = ++statusRequestSequence.current
    const revisionAtStart = realtimeRevision.current
    setChecking(true)
    try {
      const result = await getPublicServiceCallStatusAction({ token })
      if (requestSequence !== statusRequestSequence.current || revisionAtStart !== realtimeRevision.current) return
      if (result.ok) {
        setCall(result.data)
        setStatusKnown(true)
        setError(null)
      } else {
        setStatusKnown(false)
        setError("Não foi possível confirmar o estado do chamado.")
      }
    } catch {
      if (requestSequence !== statusRequestSequence.current || revisionAtStart !== realtimeRevision.current) return
      setStatusKnown(false)
      setError("Não foi possível confirmar o estado do chamado.")
    } finally {
      if (requestSequence === statusRequestSequence.current) setChecking(false)
    }
  }, [token])

  useEffect(() => {
    let active = true
    const supabase = createSupabasePublicBrowserClient()
    const channel = supabase
      .channel(`service_calls_guest:${token}`, { config: { private: true } })
      .on("broadcast", { event: "service_call_status" }, (event) => {
        if (!active) return
        const next = parseBroadcast(event, tableNumber)
        if (!next) return
        realtimeRevision.current += 1
        void syncStatus()
      })
      .subscribe((state) => {
        if (!active) return
        const connected = state === "SUBSCRIBED"
        setRealtimeConnected(connected)
        if (connected) void syncStatus()
      })

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void syncStatus()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("focus", onVisibilityChange)
    void syncStatus()

    return () => {
      active = false
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("focus", onVisibilityChange)
      void supabase.removeChannel(channel)
    }
  }, [syncStatus, tableNumber, token])

  async function requestCall() {
    const revisionAtStart = realtimeRevision.current
    const requestSequence = ++statusRequestSequence.current
    setChecking(false)
    setSubmitting(true)
    setError(null)
    try {
      const result = await requestPublicServiceCallAction({ token })
      if (result.ok) {
        if (revisionAtStart === realtimeRevision.current && requestSequence === statusRequestSequence.current) {
          realtimeRevision.current += 1
          setCall(result.data)
          setStatusKnown(true)
          setError(null)
        } else {
          void syncStatus()
        }
      } else if (revisionAtStart === realtimeRevision.current && requestSequence === statusRequestSequence.current) {
        if (result.code === "hourly_limit") setRequestLimited(true)
        setError(actionMessage(result.code))
      } else {
        void syncStatus()
      }
    } catch {
      setError(actionMessage("unavailable"))
    } finally {
      setSubmitting(false)
    }
  }

  const activeCallStatus = call && (call.status === "pending" || call.status === "in_progress") ? call.status : null
  const activeCall = activeCallStatus !== null
  const disabled = !statusKnown || checking || submitting || requestLimited || Boolean(activeCall)
  const buttonLabel = submitting
    ? "Enviando chamado"
    : checking && !statusKnown
      ? "Verificando mesa"
      : requestLimited
        ? "Tente mais tarde"
        : call?.status === "pending"
          ? "Aguardando a equipe"
          : call?.status === "in_progress"
            ? "Atendimento a caminho"
            : call?.status === "resolved"
              ? "Chamar novamente"
              : "Chamar a equipe"

  return (
    <MotionConfig reducedMotion="user">
      <aside className={styles.serviceCallDock} style={style} aria-label={`Atendimento da mesa ${tableNumber}`}>
        <motion.div
          className={styles.serviceCallCard}
          initial={reducedMotion ? false : { opacity: 0, transform: "translateY(12px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          transition={{ duration: reducedMotion ? 0.14 : 0.22, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className={styles.serviceCallHeading}>
            <span className={styles.serviceCallTableIcon} aria-hidden="true"><LuBellRing /></span>
            <span className={styles.serviceCallText}>
              <strong>Mesa {tableNumber}</strong>
              <span aria-live="polite" aria-atomic="true">
                {activeCallStatus ? STATUS_COPY[activeCallStatus] : call?.status === "resolved" ? STATUS_COPY.resolved : statusKnown ? "Precisa de algo? A equipe está por perto." : "Confirmando o estado do atendimento."}
              </span>
            </span>
            {activeCallStatus ? (
              <span className={`${styles.serviceCallState} ${activeCallStatus === "pending" ? styles.serviceCallPending : styles.serviceCallInProgress}`}>
                {activeCallStatus === "pending" ? <LuClock3 aria-hidden="true" /> : <LuCheck aria-hidden="true" />}
                {activeCallStatus === "pending" ? "Chamado aberto" : "Em atendimento"}
              </span>
            ) : null}
          </div>

          {error ? (
            <div className={styles.serviceCallError} role="alert">
              <LuCircleAlert aria-hidden="true" />
              <span>{error}</span>
              {!statusKnown ? <button type="button" onClick={() => void syncStatus()}>Tentar novamente</button> : null}
            </div>
          ) : null}

          {!realtimeConnected && statusKnown && !error ? (
            <p className={styles.serviceCallConnection} role="status">
              <LuWifiOff aria-hidden="true" /> Estado atualizado ao reconectar.
            </p>
          ) : null}

          <Button
            type="button"
            disabled={disabled}
            aria-busy={checking || submitting}
            onClick={() => void requestCall()}
            className={styles.serviceCallButton}
          >
            {checking || submitting ? <LuLoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <LuBellRing aria-hidden="true" />}
            {buttonLabel}
          </Button>
        </motion.div>
      </aside>
    </MotionConfig>
  )
}
