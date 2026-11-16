import "server-only"

import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import { createSupabaseServerClient } from "@/lib/supabase/server"

import type { PanelOrderActionResult, PanelOrderFailureCode, RecordPanelOrderInput, RecordPanelOrderResult } from "../model"

type RpcOrder = {
  id?: unknown
  comandaId?: unknown
  totalCents?: unknown
}

type RpcPayload = {
  ok?: unknown
  code?: unknown
  order?: RpcOrder
}

const FAILURE_CODES = new Set<PanelOrderFailureCode>([
  "invalid_input", "session_expired", "context_changed", "unavailable", "database_error",
  "forbidden", "not_assignee", "call_not_found", "call_conflict", "request_conflict",
  "item_not_available", "variant_required", "variant_not_available",
])

function failure<T>(code: PanelOrderFailureCode): PanelOrderActionResult<T> {
  return { ok: false, code }
}

function contextFailure<T>(cause: unknown): PanelOrderActionResult<T> {
  const message = cause instanceof Error ? cause.message : ""
  if (message === "panel_auth_required") return failure("session_expired")
  if (message === "panel_restaurant_context_changed" || message === "panel_restaurant_not_found") return failure("context_changed")
  return failure("unavailable")
}

function parsePayload(value: unknown): RpcPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as RpcPayload
}

function parseTotal(value: unknown): number | null {
  const total = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN
  return Number.isSafeInteger(total) && total >= 0 ? total : null
}

export async function recordPanelOrder(input: RecordPanelOrderInput): Promise<PanelOrderActionResult<RecordPanelOrderResult>> {
  let restaurantId: string
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
  try {
    const restaurant = await getActivePanelRestaurant(input.expectedRestaurantId)
    if (!restaurant || restaurant.status !== "active") throw new Error("panel_restaurant_context_changed")
    restaurantId = restaurant.id
    supabase = await createSupabaseServerClient("panel")
  } catch (cause) {
    return contextFailure(cause)
  }

  try {
    const { data, error } = await supabase.rpc("record_panel_order", {
      p_restaurant_id: restaurantId,
      p_call_id: input.callId,
      p_request_id: input.requestId,
      p_items: input.items,
    })
    const payload = parsePayload(data)

    if (payload?.ok === true && payload.order) {
      const { id, comandaId, totalCents } = payload.order
      const total = parseTotal(totalCents)
      if (typeof id === "string" && typeof comandaId === "string" && total !== null) {
        return { ok: true, data: { orderId: id, comandaId, totalCents: total } }
      }
      console.error("[panel-orders]", JSON.stringify({ stage: "record_response_invalid" }))
      return failure("database_error")
    }

    if (typeof payload?.code === "string" && FAILURE_CODES.has(payload.code as PanelOrderFailureCode)) {
      return failure(payload.code as PanelOrderFailureCode)
    }
    if (error) console.error("[panel-orders]", JSON.stringify({ stage: "record", code: error.code }))
    return failure(error?.code === "42501" ? "forbidden" : "unavailable")
  } catch {
    console.error("[panel-orders]", JSON.stringify({ stage: "record", code: "transport_error" }))
    return failure("unavailable")
  }
}
