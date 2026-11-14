import "server-only"

import { createSupabasePublicClient } from "@/lib/supabase/public"

import type {
  PublicServiceCallActionResult,
  PublicServiceCallDTO,
  PublicServiceCallRequestDTO,
  PublicServiceCallStatus,
} from "../calls-model"

const SERVICE_CALL_STATUSES = new Set<PublicServiceCallStatus>(["pending", "in_progress", "resolved"])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function status(value: unknown): PublicServiceCallStatus | null {
  return typeof value === "string" && SERVICE_CALL_STATUSES.has(value as PublicServiceCallStatus)
    ? value as PublicServiceCallStatus
    : null
}

function parseStatus(value: unknown): PublicServiceCallDTO | null | undefined {
  if (!Array.isArray(value)) return undefined
  if (value.length === 0) return null
  const row = value[0]
  if (!row || typeof row !== "object") return undefined
  const candidate = row as { call_id?: unknown; table_number?: unknown; status?: unknown }
  const callStatus = status(candidate.status)
  const tableNumber = candidate.table_number
  if (typeof candidate.call_id !== "string" || !UUID_PATTERN.test(candidate.call_id) || !callStatus || typeof tableNumber !== "number" || !Number.isSafeInteger(tableNumber) || tableNumber <= 0) return undefined
  return { callId: candidate.call_id, tableNumber, status: callStatus }
}

function parseRequest(value: unknown): PublicServiceCallRequestDTO | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const payload = value as { ok?: unknown; callId?: unknown; tableNumber?: unknown; status?: unknown; created?: unknown }
  const callStatus = status(payload.status)
  const tableNumber = payload.tableNumber
  if (payload.ok !== true || typeof payload.callId !== "string" || !UUID_PATTERN.test(payload.callId) || !callStatus || typeof tableNumber !== "number" || !Number.isSafeInteger(tableNumber) || tableNumber <= 0 || typeof payload.created !== "boolean") return null
  return { callId: payload.callId, tableNumber, status: callStatus, created: payload.created }
}

export async function getPublicServiceCallStatus(token: string): Promise<PublicServiceCallActionResult<PublicServiceCallDTO | null>> {
  try {
    const supabase = createSupabasePublicClient()
    const { data, error } = await supabase.rpc("get_public_service_call_status", { p_token: token })
    if (error) {
      console.error("[public-service-call]", JSON.stringify({ stage: "status", code: error.code }))
      return { ok: false, code: "unavailable" }
    }
    const parsed = parseStatus(data)
    return parsed === undefined
      ? { ok: false, code: "unavailable" }
      : { ok: true, data: parsed }
  } catch {
    console.error("[public-service-call]", JSON.stringify({ stage: "status", code: "transport_error" }))
    return { ok: false, code: "unavailable" }
  }
}

export async function requestPublicServiceCall(token: string): Promise<PublicServiceCallActionResult<PublicServiceCallRequestDTO>> {
  try {
    const supabase = createSupabasePublicClient()
    const { data, error } = await supabase.rpc("request_service_call", { p_token: token })
    const payload = data && typeof data === "object" && !Array.isArray(data)
      ? data as { ok?: unknown; code?: unknown }
      : null
    if (payload?.ok === false) {
      return { ok: false, code: payload.code === "hourly_limit" ? "hourly_limit" : "unavailable" }
    }
    if (error) {
      console.error("[public-service-call]", JSON.stringify({ stage: "request", code: error.code }))
      return { ok: false, code: "unavailable" }
    }
    const parsed = parseRequest(data)
    return parsed ? { ok: true, data: parsed } : { ok: false, code: "unavailable" }
  } catch {
    console.error("[public-service-call]", JSON.stringify({ stage: "request", code: "transport_error" }))
    return { ok: false, code: "unavailable" }
  }
}
