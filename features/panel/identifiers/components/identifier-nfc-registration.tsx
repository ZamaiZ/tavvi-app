"use client"

import { MotionConfig, motion, useReducedMotion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { LuCheck, LuLoaderCircle, LuNfc, LuShieldCheck, LuTriangleAlert } from "react-icons/lu"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import type { IdentifierDTO } from "../model"
import {
  beginIdentifierNfcAction,
  cancelIdentifierNfcAction,
  cancelIdentifierNfcWriteClaimAction,
  completeIdentifierNfcAction,
  markIdentifierNfcUncertainAction,
  markIdentifierNfcPhysicalStartedAction,
  markIdentifierNfcWriteStartedAction,
} from "../actions"
import {
  getIdentifierNfcSupport,
  isIdentifierTagStillSelected,
  protectSelectedIdentifierTag,
  readIdentifierTag,
  type IdentifierNfcFailure,
  type IdentifierTagRead,
  writeAndProtectIdentifierTag,
} from "../lib/nfc"

type Phase = "idle" | "scanning" | "confirming" | "authorizing" | "writing" | "recovery" | "recoveryScanning" | "recoveryConfirming" | "recovering" | "success" | "error"
type Receipt = {
  operationId: string
  serial: string
  currentUrl: string | null
  expectedUrl: string
  phase: "ready" | "writing" | "uncertain"
  savedAt: number
}
type Session = { controller: AbortController; operationId: string; phase: Phase; kind: "registration" | "recovery"; attemptId?: string; physicalStarted?: boolean }

function nfcFailureCode(value: unknown): IdentifierNfcFailure | null {
  return value instanceof Error && [
    "secure_context_required", "unsupported", "lock_unsupported", "permission_denied", "nfc_unavailable", "tag_unreadable",
    "serial_unavailable", "serial_unsupported", "serial_mismatch", "serial_unconfirmed", "tag_content_mismatch",
    "write_failed", "lock_failed", "operation_aborted", "reader_expired", "timeout",
  ].includes(value.message) ? value.message as IdentifierNfcFailure : null
}

function explanation(code: IdentifierNfcFailure, recovery: boolean) {
  if (code === "secure_context_required") return "O NFC exige uma conexão segura. Abra o Painel em HTTPS."
  if (code === "unsupported") return "Abra esta tela no Chrome para Android com NFC."
  if (code === "lock_unsupported") return "Este navegador não oferece bloqueio permanente da etiqueta. Use Chrome para Android atualizado."
  if (code === "permission_denied") return "A permissão NFC foi negada. Permita o acesso nas configurações do site e tente novamente."
  if (code === "nfc_unavailable") return "Ative o NFC do celular e tente novamente."
  if (code === "tag_unreadable") return "Não foi possível ler esta etiqueta. Mantenha o celular encostado e use uma etiqueta NDEF compatível."
  if (code === "serial_unavailable" || code === "serial_unsupported") return "Esta etiqueta não informou um serial compatível. Use uma etiqueta NFC NTAG213 compatível."
  if (code === "serial_mismatch") return recovery
    ? "Outra etiqueta foi detectada. Nada será bloqueado nela. Reaproxime a etiqueta reservada para retomar."
    : "Outra etiqueta foi detectada. Nenhuma gravação será feita; reaproxime a etiqueta reconhecida e confirme."
  if (code === "serial_unconfirmed") return recovery
    ? "Não foi possível confirmar o serial da etiqueta reservada. A proteção foi interrompida; aproxime a mesma etiqueta e tente novamente."
    : "Não foi possível confirmar o serial desta etiqueta. Nenhuma gravação será feita; use uma etiqueta NFC compatível."
  if (code === "tag_content_mismatch") return "O link esperado não está nesta etiqueta. Para evitar uma nova gravação incerta, o bloqueio não foi aplicado."
  if (code === "write_failed") return "A gravação não foi confirmada. Não tente gravar novamente; use a retomada segura pela mesma etiqueta."
  if (code === "lock_failed") return "O link pode ter sido gravado, mas o bloqueio permanente não foi confirmado. Retome a proteção pela leitura da mesma etiqueta."
  if (code === "timeout") return "A etiqueta saiu do alcance antes de concluir. Mantenha-a encostada e use a retomada segura."
  if (recovery) return "Não foi possível retomar a proteção. Mantenha a mesma etiqueta próxima e tente novamente."
  return "Não foi possível iniciar a leitura NFC. Tente novamente."
}

function actionFailure(code: string) {
  if (code === "serial_in_use") return "Esta etiqueta já está vinculada a outro identificador."
  if (code === "already_protected") return "Esta mesa já tem uma etiqueta protegida. Crie outra mesa para vincular uma etiqueta diferente."
  if (code === "operation_exists") return "Esta etiqueta já está vinculada a outra operação NFC."
  if (code === "operation_state") return "Há outra tentativa em andamento. Aguarde alguns instantes e tente novamente."
  if (code === "inactive") return "Ative o identificador antes de vincular uma etiqueta."
  if (code === "session_expired") return "Sua sessão expirou. Entre novamente para continuar."
  if (code === "context_changed") return "O restaurante ativo mudou. Atualize a página e tente novamente."
  return "Não foi possível reservar esta etiqueta no servidor. Tente novamente."
}

function receiptKey(restaurantId: string, identifierId: string) {
  return `tavvi:nfc:${restaurantId}:${identifierId}`
}

async function confirmPhysicalStart(input: { expectedRestaurantId: string; id: string; operationId: string; attemptId: string }) {
  const requestedAt = performance.now()
  let timeoutId: number | null = null
  const request = (async () => {
    let result = await markIdentifierNfcPhysicalStartedAction(input).catch(() => null)
    if (!result?.ok && (!result || result.code === "unavailable")) {
      result = await markIdentifierNfcPhysicalStartedAction(input).catch(() => null)
    }
    return result?.ok === true && performance.now() - requestedAt <= 45_000
  })()
  const deadline = new Promise<false>((resolve) => {
    timeoutId = window.setTimeout(() => resolve(false), 45_000)
  })
  return Promise.race([request, deadline]).finally(() => {
    if (timeoutId !== null) window.clearTimeout(timeoutId)
  })
}

function saveReceipt(key: string, receipt: Receipt) {
  try { localStorage.setItem(key, JSON.stringify(receipt)) } catch { /* Server reservation remains authoritative. */ }
}

function readReceipt(key: string): Receipt | null {
  try {
    const value = localStorage.getItem(key)
    if (!value) return null
    const parsed = JSON.parse(value) as Partial<Receipt>
    if (typeof parsed.operationId !== "string" || typeof parsed.serial !== "string" || typeof parsed.expectedUrl !== "string") return null
    if (parsed.phase !== "ready" && parsed.phase !== "writing" && parsed.phase !== "uncertain") return null
    return {
      operationId: parsed.operationId,
      serial: parsed.serial,
      expectedUrl: parsed.expectedUrl,
      currentUrl: typeof parsed.currentUrl === "string" ? parsed.currentUrl : null,
      phase: parsed.phase,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
    }
  } catch {
    return null
  }
}

export function IdentifierNfcRegistration({
  identifier,
  restaurantId,
  onChanged,
}: {
  identifier: IdentifierDTO
  restaurantId: string
  onChanged: () => void
}) {
  const reducedMotion = useReducedMotion() === true
  const [support, setSupport] = useState<"checking" | "supported" | IdentifierNfcFailure>("checking")
  const [phase, setPhase] = useState<Phase>("idle")
  const [tag, setTag] = useState<IdentifierTagRead | null>(null)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [error, setError] = useState<{ code: IdentifierNfcFailure | null; message: string } | null>(null)
  const sessionRef = useRef<Session | null>(null)
  const writeAttemptIdRef = useRef<string | null>(null)
  const writeInProgressRef = useRef(false)
  const completedOperationIdRef = useRef<string | null>(null)
  const key = receiptKey(restaurantId, identifier.id)

  function changePhase(next: Phase) {
    setPhase(next)
    if (sessionRef.current) sessionRef.current.phase = next
  }

  useEffect(() => {
    setSupport(getIdentifierNfcSupport())
    if (identifier.nfcOperationId && completedOperationIdRef.current === identifier.nfcOperationId) return
    const activeSession = sessionRef.current
    if (
      identifier.nfcOperationId
      && activeSession?.operationId === identifier.nfcOperationId
      && !activeSession.controller.signal.aborted
    ) return

    const localReceipt = readReceipt(key)
    if (identifier.nfcOperationId && localReceipt?.operationId === identifier.nfcOperationId) {
      if (localReceipt.phase === "ready" && sessionRef.current?.operationId === localReceipt.operationId && !sessionRef.current.controller.signal.aborted) {
        setReceipt(localReceipt)
        setTag({ serial: localReceipt.serial, url: localReceipt.currentUrl })
        changePhase("confirming")
      } else if (localReceipt.phase === "ready" && identifier.nfcOperationStatus === "ready") {
        setReceipt(null)
        setTag(null)
        changePhase("idle")
        void cancelIdentifierNfcAction({ expectedRestaurantId: restaurantId, id: identifier.id, operationId: localReceipt.operationId }).then((result) => {
          if (result.ok) {
            try { localStorage.removeItem(key) } catch { /* Local receipt is best-effort. */ }
            onChanged()
          } else {
            setError({ code: null, message: "A leitura anterior expirou. Atualize os detalhes antes de iniciar outra." })
          }
        }).catch(() => setError({ code: null, message: "Não foi possível liberar a leitura anterior. Atualize os detalhes antes de tentar novamente." }))
      } else {
        const recoverableReceipt = localReceipt.phase === "ready"
          && identifier.nfcOperationStatus !== "ready"
          ? { ...localReceipt, phase: "uncertain" as const }
          : localReceipt
        setReceipt(recoverableReceipt)
        if (recoverableReceipt !== localReceipt) saveReceipt(key, recoverableReceipt)
        changePhase("recovery")
      }
      return
    }
    if (!identifier.nfcOperationId && localReceipt) {
      try { localStorage.removeItem(key) } catch { /* Local receipt is best-effort. */ }
      setReceipt(null)
      setTag(null)
      setPhase("idle")
      return
    }
    if (identifier.nfcOperationId && identifier.nfcSerial && ["authorizing", "writing", "uncertain", "ready"].includes(identifier.nfcOperationStatus ?? "")) {
      const recoveryReceipt: Receipt = {
        operationId: identifier.nfcOperationId,
        serial: identifier.nfcSerial,
        currentUrl: null,
        expectedUrl: identifier.publicUrl,
        phase: identifier.nfcOperationStatus === "ready" ? "ready" : "uncertain",
        savedAt: Date.now(),
      }
      setReceipt(recoveryReceipt)
      saveReceipt(key, recoveryReceipt)
      changePhase("recovery")
    }
  }, [identifier.id, identifier.nfcOperationId, identifier.nfcOperationStatus, identifier.nfcSerial, identifier.publicUrl, key, onChanged, restaurantId])

  useEffect(() => () => {
    const session = sessionRef.current
    if (!session) return
    sessionRef.current = null
    session.controller.abort()
    const input = { expectedRestaurantId: restaurantId, id: identifier.id, operationId: session.operationId }
    const attemptInput = session.attemptId ? { ...input, attemptId: session.attemptId } : null
    if (session.kind === "registration" && (session.phase === "confirming" || session.phase === "scanning")) {
      void cancelIdentifierNfcAction(input).then((result) => {
        const attemptId = session.attemptId ?? writeAttemptIdRef.current
        if (!result.ok && session.phase === "confirming" && attemptId) {
          return cancelIdentifierNfcWriteClaimAction({ ...input, attemptId })
        }
      }).catch(() => undefined)
    } else if (session.kind === "registration" && session.phase === "authorizing" && session.attemptId) {
      void cancelIdentifierNfcWriteClaimAction(attemptInput!)
        .then((result) => result.ok ? undefined : markIdentifierNfcUncertainAction({ ...attemptInput!, reason: "page_interrupted" }))
        .catch(() => undefined)
    } else if (session.kind === "recovery" && (session.phase === "authorizing" || session.phase === "recovering") && session.attemptId && !session.physicalStarted) {
      void cancelIdentifierNfcWriteClaimAction(attemptInput!)
        .then((result) => result.ok ? undefined : markIdentifierNfcUncertainAction({ ...attemptInput!, reason: "page_interrupted" }))
        .catch(() => undefined)
    } else if ((session.phase === "writing" || (session.phase === "recovering" && session.physicalStarted)) && attemptInput) {
      void markIdentifierNfcUncertainAction({ ...attemptInput, reason: "page_interrupted" }).catch(() => undefined)
    }
  }, [identifier.id, restaurantId])

  useEffect(() => {
    const stopHiddenOperation = () => {
      if (document.visibilityState === "visible") return
      const session = sessionRef.current
      if (!session) return
      session.controller.abort()
      if (session.kind === "registration" && session.phase === "confirming") {
        sessionRef.current = null
        try { localStorage.removeItem(key) } catch { /* Server reservation remains authoritative. */ }
        setReceipt(null)
        setTag(null)
        setError({ code: null, message: "A leitura foi interrompida quando a tela saiu de foco. Escaneie novamente quando estiver pronta." })
        setPhase("idle")
        void cancelIdentifierNfcAction({ expectedRestaurantId: restaurantId, id: identifier.id, operationId: session.operationId })
          .catch(() => undefined)
          .finally(onChanged)
      } else if (session.kind === "recovery" && session.phase === "recoveryConfirming") {
        sessionRef.current = null
        setTag(null)
        setError({ code: null, message: "A leitura de retomada foi interrompida. Releia a mesma etiqueta quando voltar à tela." })
        setPhase("recovery")
      }
    }
    const stopOnPageHide = () => sessionRef.current?.controller.abort()
    document.addEventListener("visibilitychange", stopHiddenOperation)
    window.addEventListener("pagehide", stopOnPageHide)
    return () => {
      document.removeEventListener("visibilitychange", stopHiddenOperation)
      window.removeEventListener("pagehide", stopOnPageHide)
    }
  }, [identifier.id, key, onChanged, restaurantId])

  async function startScan() {
    setError(null)
    const capability = getIdentifierNfcSupport()
    setSupport(capability)
    if (capability !== "supported") return
    const controller = new AbortController()
    const operationId = crypto.randomUUID()
    writeAttemptIdRef.current = null
    writeInProgressRef.current = false
    sessionRef.current = { controller, operationId, phase: "scanning", kind: "registration" }
    changePhase("scanning")

    let scannedTag: IdentifierTagRead
    try {
      scannedTag = await readIdentifierTag(controller.signal)
    } catch (cause) {
      if (controller.signal.aborted) {
        sessionRef.current = null
        setError(null)
        changePhase("idle")
        return
      }
      controller.abort()
      sessionRef.current = null
      const code = nfcFailureCode(cause) ?? "tag_unreadable"
      setError({ code, message: explanation(code, false) })
      changePhase("error")
      return
    }

    const beginInput = { expectedRestaurantId: restaurantId, id: identifier.id, operationId, serial: scannedTag.serial }
    const initialReceipt: Receipt = { operationId, serial: scannedTag.serial, currentUrl: scannedTag.url, expectedUrl: identifier.publicUrl, phase: "ready", savedAt: Date.now() }
    saveReceipt(key, initialReceipt)
    let result = await beginIdentifierNfcAction(beginInput).catch(() => ({ ok: false as const, code: "unavailable" as const }))
    if (!result.ok && result.code === "unavailable") result = await beginIdentifierNfcAction(beginInput).catch(() => ({ ok: false as const, code: "unavailable" as const }))
    if (controller.signal.aborted) {
      if (result.ok) await cancelIdentifierNfcAction({ expectedRestaurantId: restaurantId, id: identifier.id, operationId }).catch(() => undefined)
      try { localStorage.removeItem(key) } catch { /* Local receipt is best-effort. */ }
      sessionRef.current = null
      setError(null)
      changePhase("idle")
      return
    }
    if (!result.ok) {
      controller.abort()
      sessionRef.current = null
      setError({ code: null, message: actionFailure(result.code) })
      changePhase("error")
      if (result.code !== "unavailable") {
        try { localStorage.removeItem(key) } catch { /* Local receipt is best-effort. */ }
      } else {
        onChanged()
      }
      return
    }

    saveReceipt(key, initialReceipt)
    setReceipt(initialReceipt)
    setTag(scannedTag)
    sessionRef.current = { controller, operationId, phase: "confirming", kind: "registration" }
    changePhase("confirming")
    onChanged()
  }

  async function cancelReadyOperation() {
    const current = receipt
    sessionRef.current?.controller.abort()
    let reservationDisposition: "released" | "retained" | null = null
    if (current) {
      const input = { expectedRestaurantId: restaurantId, id: identifier.id, operationId: current.operationId }
      const attemptId = writeAttemptIdRef.current
      let result = current.phase === "ready" && attemptId
        ? await cancelIdentifierNfcWriteClaimAction({ ...input, attemptId }).catch(() => ({ ok: false as const, code: "unavailable" as const }))
        : await cancelIdentifierNfcAction(input).catch(() => ({ ok: false as const, code: "unavailable" as const }))
      if (!result.ok && current.phase === "ready" && attemptId) {
        result = await cancelIdentifierNfcAction(input).catch(() => ({ ok: false as const, code: "unavailable" as const }))
      }
      if (!result.ok) {
        setError({ code: null, message: actionFailure(result.code) })
        setTag(null)
        if (sessionRef.current) sessionRef.current.phase = "recovery"
        changePhase("recovery")
        onChanged()
        return
      }
      reservationDisposition = result.data.serialReservation
    }
    sessionRef.current = null
    writeAttemptIdRef.current = null
    writeInProgressRef.current = false
    setTag(null)
    setError(null)
    if (current && reservationDisposition === "retained") {
      const uncertainReceipt: Receipt = { ...current, phase: "uncertain", savedAt: Date.now() }
      saveReceipt(key, uncertainReceipt)
      setReceipt(uncertainReceipt)
      setError({ code: null, message: "A reserva continua vinculada a este serial. Leia a mesma etiqueta para concluir; se o link não corresponder, desative este identificador e crie outro para a mesa com uma etiqueta nova." })
      changePhase("recovery")
      onChanged()
      return
    }
    try { localStorage.removeItem(key) } catch { /* Local receipt is best-effort. */ }
    setReceipt(null)
    changePhase("idle")
    onChanged()
  }

  async function markUncertain(operationId: string, attemptId: string, reason: "write_failed" | "lock_failed" | "server_unavailable" | "page_interrupted" | "serial_mismatch") {
    try {
      const result = await markIdentifierNfcUncertainAction({ expectedRestaurantId: restaurantId, id: identifier.id, operationId, attemptId, reason })
      return result.ok
    } catch {
      return false
    }
  }

  async function confirmAndProtect() {
    if (!receipt || !tag) return
    if (writeInProgressRef.current) return
    const session = sessionRef.current
    const controller = session?.controller ?? new AbortController()
    if (!session || !isIdentifierTagStillSelected(controller.signal, receipt.serial)) {
      setError({ code: "serial_mismatch", message: explanation("serial_mismatch", false) })
      return
    }
    if (controller.signal.aborted) return

    writeInProgressRef.current = true
    const attemptId = writeAttemptIdRef.current ?? crypto.randomUUID()
    writeAttemptIdRef.current = attemptId
    const authorizingReceipt: Receipt = { ...receipt, phase: "ready", savedAt: Date.now() }
    saveReceipt(key, authorizingReceipt)
    setReceipt(authorizingReceipt)
    if (sessionRef.current) {
      sessionRef.current.attemptId = attemptId
      sessionRef.current.phase = "authorizing"
    }
    setPhase("authorizing")
    setError(null)
    let started = await markIdentifierNfcWriteStartedAction({ expectedRestaurantId: restaurantId, id: identifier.id, operationId: receipt.operationId, attemptId })
      .catch(() => ({ ok: false as const, code: "unavailable" as const }))
    if (!started.ok && started.code === "unavailable") {
      started = await markIdentifierNfcWriteStartedAction({ expectedRestaurantId: restaurantId, id: identifier.id, operationId: receipt.operationId, attemptId })
        .catch(() => ({ ok: false as const, code: "unavailable" as const }))
    }
    if (!started.ok) {
      writeInProgressRef.current = false
      if (controller.signal.aborted) {
        const cancelInput = { expectedRestaurantId: restaurantId, id: identifier.id, operationId: receipt.operationId }
        let cancelled = await cancelIdentifierNfcWriteClaimAction({ ...cancelInput, attemptId }).catch(() => null)
        if (!cancelled?.ok) cancelled = await cancelIdentifierNfcAction(cancelInput).catch(() => null)
        if (sessionRef.current === session) {
          sessionRef.current = null
          writeAttemptIdRef.current = null
          setTag(null)
          if (cancelled?.ok && cancelled.data.serialReservation === "released") {
            try { localStorage.removeItem(key) } catch { /* Local receipt is best-effort. */ }
            setReceipt(null)
            setError({ code: null, message: "A tentativa foi cancelada antes de tocar a etiqueta. Leia novamente quando estiver pronta." })
            changePhase("idle")
          } else {
            const uncertainReceipt: Receipt = { ...authorizingReceipt, phase: "uncertain", savedAt: Date.now() }
            saveReceipt(key, uncertainReceipt)
            setReceipt(uncertainReceipt)
            setError({ code: null, message: "A tentativa foi interrompida antes da gravação, mas a reserva ainda não foi liberada. Releia a mesma etiqueta para retomar." })
            changePhase("recovery")
          }
          onChanged()
        }
        return
      }
      if (started.code === "operation_state" || started.code === "operation_exists") {
        const uncertainReceipt: Receipt = { ...authorizingReceipt, phase: "uncertain", savedAt: Date.now() }
        saveReceipt(key, uncertainReceipt)
        setReceipt(uncertainReceipt)
        if (sessionRef.current) sessionRef.current.phase = "recovery"
        setError({ code: null, message: actionFailure(started.code) })
        changePhase("recovery")
        onChanged()
        return
      }
      if (sessionRef.current) sessionRef.current.phase = "confirming"
      setReceipt(authorizingReceipt)
      setPhase("confirming")
      setError({ code: null, message: actionFailure(started.code) })
      onChanged()
      return
    }
    if (controller.signal.aborted || !isIdentifierTagStillSelected(controller.signal, receipt.serial)) {
      if (controller.signal.aborted) {
        const released = await cancelIdentifierNfcWriteClaimAction({ expectedRestaurantId: restaurantId, id: identifier.id, operationId: receipt.operationId, attemptId }).catch(() => null)
        if (sessionRef.current === session) {
          sessionRef.current = null
          writeAttemptIdRef.current = null
          writeInProgressRef.current = false
          setTag(null)
          if (released?.ok && released.data.serialReservation === "released") {
            try { localStorage.removeItem(key) } catch { /* Local receipt is best-effort. */ }
            setReceipt(null)
            setError({ code: null, message: "A tentativa foi cancelada antes de tocar a etiqueta. Leia novamente quando estiver pronta." })
            changePhase("idle")
          } else {
            const uncertainReceipt: Receipt = { ...authorizingReceipt, phase: "uncertain", savedAt: Date.now() }
            saveReceipt(key, uncertainReceipt)
            setReceipt(uncertainReceipt)
            setError({ code: null, message: "A tentativa foi interrompida antes da gravação, mas a reserva ainda não foi liberada. Releia a mesma etiqueta para retomar." })
            changePhase("recovery")
          }
          onChanged()
        }
        return
      }
      writeInProgressRef.current = false
      const released = await cancelIdentifierNfcWriteClaimAction({ expectedRestaurantId: restaurantId, id: identifier.id, operationId: receipt.operationId, attemptId }).catch(() => null)
      if (released?.ok) {
        controller.abort()
        sessionRef.current = null
        writeAttemptIdRef.current = null
        try { localStorage.removeItem(key) } catch { /* Local receipt is best-effort. */ }
        setReceipt(null)
        setTag(null)
        changePhase("idle")
      } else {
        const uncertainReceipt: Receipt = { ...authorizingReceipt, phase: "uncertain", savedAt: Date.now() }
        saveReceipt(key, uncertainReceipt)
        setReceipt(uncertainReceipt)
        if (sessionRef.current) sessionRef.current.phase = "recovery"
        changePhase("recovery")
      }
      setError({ code: "serial_mismatch", message: "A etiqueta aproximada mudou durante a confirmação. A reserva foi liberada quando possível; aproxime novamente a etiqueta correta." })
      onChanged()
      return
    }

    const currentReceipt: Receipt = { ...authorizingReceipt, phase: "writing", savedAt: Date.now() }
    let physicalStarted = false
    const nfcOutcome = await writeAndProtectIdentifierTag(identifier.publicUrl, receipt.serial, controller.signal, async () => {
      const input = { expectedRestaurantId: restaurantId, id: identifier.id, operationId: receipt.operationId, attemptId }
      if (!await confirmPhysicalStart(input)) throw new Error("physical_start_unconfirmed")
      physicalStarted = true
      if (sessionRef.current) sessionRef.current.phase = "writing"
      saveReceipt(key, currentReceipt)
      setReceipt(currentReceipt)
      setPhase("writing")
    }).then(
      () => ({ ok: true as const }),
      (cause: unknown) => ({ ok: false as const, cause }),
    )
    if (!nfcOutcome.ok) {
      const cause = nfcOutcome.cause
      controller.abort()
      const code = nfcFailureCode(cause) ?? "write_failed"
      if (!physicalStarted) {
        const released = await cancelIdentifierNfcWriteClaimAction({ expectedRestaurantId: restaurantId, id: identifier.id, operationId: receipt.operationId, attemptId }).catch(() => null)
        if (released?.ok) {
          writeInProgressRef.current = false
          writeAttemptIdRef.current = null
          try { localStorage.removeItem(key) } catch { /* Local receipt is best-effort. */ }
          sessionRef.current = null
          setReceipt(null)
          setTag(null)
          setError({ code: null, message: "A gravação não começou e a reserva foi liberada. Leia a etiqueta novamente para tentar." })
          changePhase("idle")
          onChanged()
          return
        }
      }
      const reason = code === "serial_mismatch" ? "serial_mismatch" : code === "write_failed" ? "write_failed" : "lock_failed"
      await markUncertain(receipt.operationId, attemptId, reason)
      const uncertainReceipt: Receipt = { ...currentReceipt, phase: "uncertain", savedAt: Date.now() }
      saveReceipt(key, uncertainReceipt)
      setReceipt(uncertainReceipt)
      if (sessionRef.current) sessionRef.current.phase = "recovery"
      setError({ code, message: explanation(code, true) })
      changePhase("recovery")
      onChanged()
      return
    }

    const completed = await completeIdentifierNfcAction({ expectedRestaurantId: restaurantId, id: identifier.id, operationId: receipt.operationId, serial: receipt.serial, attemptId }).catch(() => null)
    if (completed?.ok) {
      completedOperationIdRef.current = receipt.operationId
      writeInProgressRef.current = false
      writeAttemptIdRef.current = null
      try { localStorage.removeItem(key) } catch { /* Local receipt is best-effort. */ }
      sessionRef.current?.controller.abort()
      sessionRef.current = null
      setReceipt(null)
      setError(null)
      changePhase("success")
      onChanged()
      return
    }
    setError({ code: null, message: "O bloqueio foi concluído no celular, mas o servidor não confirmou o registro. Retome a leitura para sincronizar com segurança." })

    const uncertainReceipt: Receipt = { ...currentReceipt, phase: "uncertain", savedAt: Date.now() }
    controller.abort()
    saveReceipt(key, uncertainReceipt)
    setReceipt(uncertainReceipt)
    if (sessionRef.current) sessionRef.current.phase = "recovery"
    changePhase("recovery")
    await markUncertain(receipt.operationId, attemptId, "server_unavailable")
    onChanged()
  }

  async function recoverProtection() {
    if (!receipt) return
    setError(null)
    setTag(null)
    const capability = getIdentifierNfcSupport()
    setSupport(capability)
    if (capability !== "supported") return

    const controller = new AbortController()
    sessionRef.current = { controller, operationId: receipt.operationId, phase: "recoveryScanning", kind: "recovery" }
    changePhase("recoveryScanning")
    try {
      const scannedTag = await readIdentifierTag(controller.signal)
      if (controller.signal.aborted) return
      setTag(scannedTag)
      if (sessionRef.current) sessionRef.current.phase = "recoveryConfirming"
      changePhase("recoveryConfirming")
      if (scannedTag.serial !== receipt.serial) {
        setError({ code: "serial_mismatch", message: explanation("serial_mismatch", true) })
      } else if (scannedTag.url !== identifier.publicUrl) {
        setError({ code: "tag_content_mismatch", message: explanation("tag_content_mismatch", true) })
      }
    } catch (cause) {
      if (controller.signal.aborted) {
        if (sessionRef.current?.controller === controller) {
          sessionRef.current = null
          setError(null)
          changePhase("recovery")
        }
        return
      }
      const code = nfcFailureCode(cause) ?? "tag_unreadable"
      if (sessionRef.current?.controller !== controller) return
      if (sessionRef.current) sessionRef.current.phase = "recovery"
      setError({ code, message: explanation(code, true) })
      changePhase("recovery")
    }
  }

  function scanRecoveryTagAgain() {
    sessionRef.current?.controller.abort()
    sessionRef.current = null
    setTag(null)
    setError(null)
    changePhase("recovery")
  }

  async function confirmRecoveryProtection() {
    if (!receipt || !tag) return
    const session = sessionRef.current
    if (!session || session.kind !== "recovery" || session.controller.signal.aborted) return
    if (tag.serial !== receipt.serial || !isIdentifierTagStillSelected(session.controller.signal, receipt.serial)) {
      setError({ code: "serial_mismatch", message: explanation("serial_mismatch", true) })
      return
    }
    if (tag.url !== identifier.publicUrl) {
      setError({ code: "tag_content_mismatch", message: explanation("tag_content_mismatch", true) })
      return
    }

    const attemptId = writeAttemptIdRef.current ?? crypto.randomUUID()
    let currentReceipt: Receipt = { ...receipt, phase: receipt.phase, savedAt: Date.now() }
    let claimSucceeded = false
    let physicalStarted = false

    writeAttemptIdRef.current = attemptId
    saveReceipt(key, currentReceipt)
    setReceipt(currentReceipt)
    session.attemptId = attemptId
    session.physicalStarted = false
    session.phase = "authorizing"
    setPhase("authorizing")
    let claim = await markIdentifierNfcWriteStartedAction({ expectedRestaurantId: restaurantId, id: identifier.id, operationId: receipt.operationId, attemptId })
      .catch(() => ({ ok: false as const, code: "unavailable" as const }))
    if (!claim.ok && claim.code === "unavailable") {
      claim = await markIdentifierNfcWriteStartedAction({ expectedRestaurantId: restaurantId, id: identifier.id, operationId: receipt.operationId, attemptId })
        .catch(() => ({ ok: false as const, code: "unavailable" as const }))
    }
    if (!claim.ok) {
      if (session.controller.signal.aborted) {
        const cancelInput = { expectedRestaurantId: restaurantId, id: identifier.id, operationId: receipt.operationId }
        let cancelled = await cancelIdentifierNfcWriteClaimAction({ ...cancelInput, attemptId }).catch(() => null)
        if (!cancelled?.ok) cancelled = await cancelIdentifierNfcAction(cancelInput).catch(() => null)
        sessionRef.current = null
        writeAttemptIdRef.current = null
        setTag(null)
        if (cancelled?.ok && cancelled.data.serialReservation === "released") {
          try { localStorage.removeItem(key) } catch { /* Local receipt is best-effort. */ }
          setReceipt(null)
          setError({ code: null, message: "A tentativa foi interrompida antes do bloqueio e a reserva foi liberada. Leia novamente quando estiver pronta." })
          changePhase("idle")
        } else {
          const uncertainReceipt: Receipt = { ...receipt, phase: "uncertain", savedAt: Date.now() }
          saveReceipt(key, uncertainReceipt)
          setReceipt(uncertainReceipt)
          setError({ code: null, message: "A retomada foi interrompida. A reserva foi mantida; releia a mesma etiqueta antes de concluir." })
          changePhase("recovery")
        }
        onChanged()
        return
      }
      session.phase = "recoveryConfirming"
      setPhase("recoveryConfirming")
      setError({ code: null, message: actionFailure(claim.code) })
      onChanged()
      return
    }
    claimSucceeded = true
    if (session.controller.signal.aborted || !isIdentifierTagStillSelected(session.controller.signal, receipt.serial)) {
      const released = await cancelIdentifierNfcWriteClaimAction({ expectedRestaurantId: restaurantId, id: identifier.id, operationId: receipt.operationId, attemptId }).catch(() => null)
      if (released?.ok) {
        session.controller.abort()
        sessionRef.current = null
        writeAttemptIdRef.current = null
        setTag(null)
        if (released.data.serialReservation === "released") {
          try { localStorage.removeItem(key) } catch { /* Local receipt is best-effort. */ }
          setReceipt(null)
          setError({ code: "serial_mismatch", message: "A etiqueta mudou durante a confirmação. A reserva foi liberada; inicie uma nova leitura." })
          changePhase("idle")
        } else {
          const uncertainReceipt: Receipt = { ...receipt, phase: "uncertain", savedAt: Date.now() }
          saveReceipt(key, uncertainReceipt)
          setReceipt(uncertainReceipt)
          setError({ code: "serial_mismatch", message: "A retomada foi cancelada antes do bloqueio. O serial continua reservado para esta mesa; leia a mesma etiqueta novamente." })
          changePhase("recovery")
        }
        onChanged()
      } else {
        if (session.controller.signal.aborted) {
          await markUncertain(receipt.operationId, attemptId, "page_interrupted")
          sessionRef.current = null
          writeAttemptIdRef.current = null
          setTag(null)
          const uncertainReceipt: Receipt = { ...receipt, phase: "uncertain", savedAt: Date.now() }
          saveReceipt(key, uncertainReceipt)
          setReceipt(uncertainReceipt)
          setError({ code: null, message: "A retomada foi interrompida. A reserva foi mantida; releia a mesma etiqueta antes de concluir." })
          changePhase("recovery")
          onChanged()
        } else {
          session.phase = "recoveryConfirming"
          setError({ code: "serial_mismatch", message: "A etiqueta mudou. A reserva segue protegida; aproxime novamente a mesma etiqueta." })
          changePhase("recoveryConfirming")
        }
      }
      return
    }

    session.phase = "recovering"
    setPhase("recovering")
    try {
      await protectSelectedIdentifierTag(
        { serial: receipt.serial, url: identifier.publicUrl },
        session.controller.signal,
        async () => {
          const input = { expectedRestaurantId: restaurantId, id: identifier.id, operationId: receipt.operationId, attemptId }
          if (!await confirmPhysicalStart(input)) throw new Error("physical_start_unconfirmed")
          physicalStarted = true
          session.physicalStarted = true
          currentReceipt = { ...currentReceipt, phase: "writing", savedAt: Date.now() }
          saveReceipt(key, currentReceipt)
          setReceipt(currentReceipt)
        },
      )

      let completed = await completeIdentifierNfcAction({ expectedRestaurantId: restaurantId, id: identifier.id, operationId: receipt.operationId, serial: receipt.serial, attemptId }).catch(() => null)
      if (!completed?.ok) {
        await markUncertain(receipt.operationId, attemptId, "lock_failed")
        completed = await completeIdentifierNfcAction({ expectedRestaurantId: restaurantId, id: identifier.id, operationId: receipt.operationId, serial: receipt.serial, attemptId }).catch(() => null)
      }
      if (!completed?.ok) throw new Error(completed?.code ?? "unavailable")
      completedOperationIdRef.current = receipt.operationId
      try { localStorage.removeItem(key) } catch { /* Local receipt is best-effort. */ }
      session.controller.abort()
      sessionRef.current = null
      writeAttemptIdRef.current = null
      setReceipt(null)
      changePhase("success")
      onChanged()
    } catch (cause) {
      const code = nfcFailureCode(cause)
      if (attemptId && claimSucceeded && !physicalStarted) {
        const released = await cancelIdentifierNfcWriteClaimAction({ expectedRestaurantId: restaurantId, id: identifier.id, operationId: receipt.operationId, attemptId }).catch(() => null)
        if (released?.ok) {
          session.controller.abort()
          sessionRef.current = null
          writeAttemptIdRef.current = null
          setTag(null)
          if (released.data.serialReservation === "released") {
            try { localStorage.removeItem(key) } catch { /* Local receipt is best-effort. */ }
            setReceipt(null)
            setError({ code, message: code ? `${explanation(code, false)} A reserva foi liberada; leia novamente para iniciar uma nova tentativa.` : "A reserva foi liberada; leia novamente para iniciar uma nova tentativa." })
            changePhase("idle")
          } else {
            const uncertainReceipt: Receipt = { ...receipt, phase: "uncertain", savedAt: Date.now() }
            saveReceipt(key, uncertainReceipt)
            setReceipt(uncertainReceipt)
            setError({ code, message: "Nenhum bloqueio começou nesta retomada. O serial continua reservado; leia a mesma etiqueta novamente quando estiver pronta." })
            changePhase("recovery")
          }
          onChanged()
          return
        }
        await markUncertain(receipt.operationId, attemptId, "page_interrupted")
        session.controller.abort()
        sessionRef.current = null
        writeAttemptIdRef.current = null
        setTag(null)
        const uncertainReceipt: Receipt = { ...receipt, phase: "uncertain", savedAt: Date.now() }
        saveReceipt(key, uncertainReceipt)
        setReceipt(uncertainReceipt)
        setError({ code, message: "A etapa física pode ter sido reservada, mas não houve confirmação. Leia a etiqueta novamente; a retomada não grava conteúdo." })
        changePhase("recovery")
        onChanged()
        return
      }
      if (!physicalStarted) {
        session.controller.abort()
        sessionRef.current = null
        setTag(null)
        setError({ code, message: code ? explanation(code, true) : actionFailure(cause instanceof Error ? cause.message : "unavailable") })
        changePhase("recovery")
        onChanged()
        return
      }

      session.controller.abort()
      const uncertainReceipt: Receipt = { ...currentReceipt, phase: "uncertain", savedAt: Date.now() }
      saveReceipt(key, uncertainReceipt)
      setReceipt(uncertainReceipt)
      session.phase = "recovery"
      setError({ code, message: code ? explanation(code, true) : actionFailure(cause instanceof Error ? cause.message : "unavailable") })
      changePhase("recovery")
      await markUncertain(receipt.operationId, attemptId, "lock_failed")
      onChanged()
    }
  }

  const capabilityMessage = support === "checking" || support === "supported" ? null : explanation(support, false)
  const sequenceVariants = { hidden: {}, visible: { transition: { staggerChildren: reducedMotion ? 0 : 0.04 } } }
  const itemVariants = { hidden: reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0, transition: { duration: reducedMotion ? 0.1 : 0.18 } } }

  return (
    <MotionConfig reducedMotion="user">
      <motion.section initial={reducedMotion ? false : "hidden"} animate="visible" variants={sequenceVariants} aria-label="Cadastro da etiqueta NFC" className="grid gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
        {phase === "success" ? (
          <motion.div variants={itemVariants} role="status" className="flex items-start gap-3 rounded-xl border border-emerald-600/20 bg-emerald-600/[0.06] p-3.5">
            <LuCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
            <div><p className="text-sm font-semibold">Etiqueta protegida</p><p className="mt-1 text-xs leading-5 text-muted-foreground">O link está gravado e o bloqueio permanente foi confirmado.</p></div>
          </motion.div>
        ) : phase === "scanning" || phase === "recoveryScanning" || phase === "authorizing" || phase === "writing" || phase === "recovering" ? (
          <motion.div variants={itemVariants} role="status" aria-live="polite" className="grid gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-primary/15 bg-primary/[0.045] p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background text-primary"><LuLoaderCircle aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" /></span>
              <div><p className="text-sm font-semibold">{phase === "scanning" ? "Lendo etiqueta…" : phase === "recoveryScanning" ? "Lendo etiqueta reservada…" : phase === "authorizing" ? "Confirmando reserva…" : phase === "writing" ? "Gravando e bloqueando…" : "Aplicando proteção…"}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Mantenha o celular encostado na mesma etiqueta e com a tela aberta.</p></div>
            </div>
            {phase === "scanning" || phase === "recoveryScanning" || (phase === "recovering" && !sessionRef.current?.physicalStarted) ? <Button type="button" variant="ghost" onClick={() => sessionRef.current?.controller.abort()} className="min-h-11 rounded-xl">Cancelar leitura</Button> : null}
          </motion.div>
        ) : phase === "confirming" && receipt && tag ? (
          <motion.div variants={itemVariants} className="grid gap-3">
            <div className="flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/[0.045] p-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background text-primary"><LuNfc aria-hidden="true" className="size-5" /></span>
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Etiqueta reconhecida</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Serial <span className="font-mono text-foreground">{tag.serial}</span></p></div>
            </div>
            {tag.url && tag.url !== identifier.publicUrl ? <div className="rounded-xl border border-amber-600/20 bg-amber-500/[0.05] p-3 text-xs leading-5 text-amber-900 dark:text-amber-200">Esta etiqueta contém outro link. Ao confirmar, ele será substituído pelo link da mesa {identifier.tableNumber}.</div> : tag.url === identifier.publicUrl ? <div className="rounded-xl border border-border/70 bg-muted/35 p-3 text-xs leading-5 text-muted-foreground">Esta etiqueta já contém o link desta mesa. A confirmação aplicará o bloqueio permanente.</div> : <div className="rounded-xl border border-border/70 bg-muted/35 p-3 text-xs leading-5 text-muted-foreground">A etiqueta está sem um link público. A confirmação grava o link desta mesa.</div>}
            <div className="rounded-xl bg-muted/35 px-3 py-2.5"><p className="text-[0.625rem] font-semibold tracking-[0.11em] text-muted-foreground uppercase">Será gravado</p><p className="mt-1 break-all font-mono text-xs leading-5">{identifier.publicUrl}</p></div>
            <p className="text-xs leading-5 text-muted-foreground">Mantenha o celular encostado na mesma etiqueta até a confirmação final. Depois, ela ficará permanentemente somente leitura e não poderá ser regravada.</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => void cancelReadyOperation()} className="min-h-11 rounded-xl">Cancelar</Button>
              <Button type="button" onClick={() => void confirmAndProtect()} className="min-h-11 rounded-xl"><LuShieldCheck aria-hidden="true" />Confirmar e proteger</Button>
            </div>
          </motion.div>
        ) : phase === "recoveryConfirming" && receipt && tag ? (
          <motion.div variants={itemVariants} className="grid gap-3">
            <div className={`flex items-start gap-3 rounded-xl border p-3.5 ${tag.serial === receipt.serial && tag.url === identifier.publicUrl ? "border-emerald-600/20 bg-emerald-600/[0.05]" : "border-amber-600/25 bg-amber-500/[0.055]"}`}>
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background text-primary"><LuNfc aria-hidden="true" className="size-5" /></span>
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{tag.serial === receipt.serial && tag.url === identifier.publicUrl ? "Etiqueta conferida" : "Esta etiqueta não corresponde"}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Serial <span className="font-mono text-foreground">{tag.serial}</span></p></div>
            </div>
            {tag.serial !== receipt.serial ? <Alert variant="destructive"><AlertTitle>Serial diferente</AlertTitle><AlertDescription>A proteção desta operação só pode ser aplicada ao serial reservado. A etiqueta não será bloqueada.</AlertDescription></Alert> : tag.url !== identifier.publicUrl ? <Alert variant="destructive"><AlertTitle>Link diferente</AlertTitle><AlertDescription>A retomada não regrava conteúdo nem bloqueia esta etiqueta. O serial continua reservado; desative este identificador e crie outro para a mesa com uma etiqueta nova.</AlertDescription></Alert> : <p className="rounded-xl bg-muted/35 px-3 py-2.5 text-xs leading-5 text-muted-foreground">O serial reservado e o link esperado conferem. Confirme para aplicar somente o bloqueio permanente.</p>}
            {error ? <Alert variant="destructive"><AlertTitle>Não foi possível confirmar</AlertTitle><AlertDescription>{error.message}</AlertDescription></Alert> : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              {receipt.phase === "ready" ? <Button type="button" variant="ghost" onClick={() => void cancelReadyOperation()} className="min-h-11 rounded-xl">Liberar reserva</Button> : ["authorizing", "writing"].includes(identifier.nfcOperationStatus ?? "") ? <Button type="button" variant="ghost" onClick={() => void cancelReadyOperation()} className="min-h-11 rounded-xl">Encerrar tentativa</Button> : null}
              <Button type="button" variant="outline" onClick={scanRecoveryTagAgain} className="min-h-11 rounded-xl">Ler novamente</Button>
              <Button type="button" disabled={support !== "supported" || tag.serial !== receipt.serial || tag.url !== identifier.publicUrl} onClick={() => void confirmRecoveryProtection()} className="min-h-11 flex-1 rounded-xl"><LuShieldCheck aria-hidden="true" />Confirmar bloqueio</Button>
            </div>
          </motion.div>
        ) : phase === "recovery" && receipt ? (
          <motion.div variants={itemVariants} className="grid gap-3">
            <div className="rounded-xl border border-amber-600/25 bg-amber-500/[0.055] p-3.5">
              <div className="flex items-start gap-2.5"><LuTriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" /><div><p className="text-sm font-semibold">{receipt.phase === "ready" ? "Reserva NFC pendente" : identifier.nfcOperationStatus === "authorizing" ? "Confirmação NFC em andamento" : "Proteção precisa ser retomada"}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{receipt.phase === "ready" ? "Nenhuma gravação foi iniciada. Leia a etiqueta para conferir o link e aplicar o bloqueio, ou libere esta reserva." : identifier.nfcOperationStatus === "authorizing" ? "Outra tela está preparando a tentativa; ainda não houve ação física na etiqueta. Leia o mesmo serial para retomar se a confirmação anterior parar." : "A gravação pode ter começado. Esta retomada nunca grava conteúdo: ela confere o serial e o link e tenta somente o bloqueio permanente."}</p></div></div>
            </div>
            <p className="rounded-xl bg-muted/35 px-3 py-2.5 text-xs leading-5 text-muted-foreground">Etiqueta reservada: <span className="font-mono text-foreground">{receipt.serial}</span>. Mantenha a mesma etiqueta próxima ao celular.</p>
            {capabilityMessage ? <Alert variant="destructive"><AlertTitle>NFC indisponível neste dispositivo</AlertTitle><AlertDescription>{capabilityMessage}</AlertDescription></Alert> : null}
            {error ? <Alert variant="destructive"><AlertTitle>Não foi possível concluir</AlertTitle><AlertDescription>{error.message}</AlertDescription></Alert> : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              {receipt.phase === "ready" ? <Button type="button" variant="ghost" onClick={() => void cancelReadyOperation()} className="min-h-11 rounded-xl">Liberar reserva</Button> : ["authorizing", "writing"].includes(identifier.nfcOperationStatus ?? "") ? <Button type="button" variant="ghost" onClick={() => void cancelReadyOperation()} className="min-h-11 rounded-xl">Encerrar tentativa</Button> : null}
              <Button type="button" disabled={support !== "supported"} onClick={() => void recoverProtection()} className="min-h-11 flex-1 rounded-xl"><LuNfc aria-hidden="true" />Ler etiqueta reservada</Button>
            </div>
          </motion.div>
        ) : (
          <motion.div variants={itemVariants} className="grid gap-3">
            {capabilityMessage ? <Alert variant="destructive"><AlertTitle>NFC indisponível neste dispositivo</AlertTitle><AlertDescription>{capabilityMessage}</AlertDescription></Alert> : <>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-muted/25 p-3"><span className="mb-2 grid size-7 place-items-center rounded-lg bg-background text-primary"><LuNfc aria-hidden="true" className="size-4" /></span><p className="text-xs font-semibold">1. Escaneie uma vez</p><p className="mt-1 text-[0.7rem] leading-5 text-muted-foreground">Aproxime o celular da etiqueta para ler o serial.</p></div>
                <div className="rounded-xl border border-border/70 bg-muted/25 p-3"><span className="mb-2 grid size-7 place-items-center rounded-lg bg-background text-primary"><LuShieldCheck aria-hidden="true" className="size-4" /></span><p className="text-xs font-semibold">2. Confirme o bloqueio</p><p className="mt-1 text-[0.7rem] leading-5 text-muted-foreground">Confira o conteúdo e proteja sem aproximar novamente.</p></div>
              </div>
              {error ? <Alert variant="destructive"><AlertTitle>Não foi possível ler a etiqueta</AlertTitle><AlertDescription>{error.message}</AlertDescription></Alert> : null}
              <Button type="button" onClick={() => void startScan()} className="min-h-11 w-full rounded-xl"><LuNfc aria-hidden="true" />Escanear etiqueta</Button>
            </>}
          </motion.div>
        )}
      </motion.section>
    </MotionConfig>
  )
}

