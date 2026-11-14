import "server-only"

import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getPanelPendingServiceCallsCount, getPanelResolvedServiceCallsPage } from "./read"

import type { PanelResolvedCallsPage, ServiceCallActionResult, ServiceCallFailureCode } from "../model"
import type { panelCallMutationSchema, panelCallsContextSchema, panelResolvedCallsSchema } from "../schema"
import type { z } from "zod"

type ContextInput = z.infer<typeof panelCallsContextSchema>
type MutationInput = z.infer<typeof panelCallMutationSchema>
type ResolvedCallsInput = z.infer<typeof panelResolvedCallsSchema>
type RpcPayload = { ok?: unknown; code?: unknown; call?: { id?: unknown } }

const FAILURE_CODES = new Set<ServiceCallFailureCode>([
  "invalid_input", "session_expired", "context_changed", "unavailable", "database_error",
  "forbidden", "not_found", "claim_conflict", "resolve_conflict",
])

function failure<T>(code: ServiceCallFailureCode): ServiceCallActionResult<T> {
  return { ok: false, code }
}

function contextFailure<T>(cause: unknown): ServiceCallActionResult<T> {
  const message = cause instanceof Error ? cause.message : ""
  if (message === "panel_auth_required") return failure("session_expired")
  if (message === "panel_restaurant_context_changed" || message === "panel_restaurant_not_found") return failure("context_changed")
  return failure("unavailable")
}

async function getContext(expectedRestaurantId: string) {
  const restaurant = await getActivePanelRestaurant(expectedRestaurantId)
  if (!restaurant || restaurant.status !== "active") throw new Error("panel_restaurant_context_changed")
  const supabase = await createSupabaseServerClient("panel")
  return { restaurant, supabase }
}

function parseRpcPayload(value: unknown): RpcPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as RpcPayload
}

async function mutate(
  input: MutationInput,
  rpcName: "claim_service_call" | "resolve_service_call",
): Promise<ServiceCallActionResult<{ id: string }>> {
  let context: Awaited<ReturnType<typeof getContext>>
  try {
    context = await getContext(input.expectedRestaurantId)
  } catch (cause) {
    return contextFailure(cause)
  }

  try {
    const { data, error } = await context.supabase.rpc(rpcName, { p_call_id: input.callId })
    const payload = parseRpcPayload(data)
    if (payload?.ok === true && payload.call && payload.call.id === input.callId) {
      return { ok: true, data: { id: input.callId } }
    }

    if (typeof payload?.code === "string" && FAILURE_CODES.has(payload.code as ServiceCallFailureCode)) {
      return failure(payload.code as ServiceCallFailureCode)
    }
    if (error) console.error("[panel-service-calls]", JSON.stringify({ stage: rpcName, code: error.code }))
    return failure(error?.code === "42501" ? "forbidden" : "unavailable")
  } catch {
    console.error("[panel-service-calls]", JSON.stringify({ stage: rpcName, code: "transport_error" }))
    return failure("unavailable")
  }
}

export async function getPanelPendingServiceCallsCountForAction(input: ContextInput) {
  try {
    const restaurant = await getActivePanelRestaurant(input.expectedRestaurantId)
    if (!restaurant || restaurant.status !== "active") throw new Error("panel_restaurant_context_changed")
    return { ok: true as const, data: await getPanelPendingServiceCallsCount(restaurant.id) }
  } catch (cause) {
    return contextFailure<never>(cause)
  }
}

export async function getPanelResolvedServiceCallsForAction(
  input: ResolvedCallsInput,
): Promise<ServiceCallActionResult<PanelResolvedCallsPage>> {
  try {
    const restaurant = await getActivePanelRestaurant(input.expectedRestaurantId)
    if (!restaurant || restaurant.status !== "active") throw new Error("panel_restaurant_context_changed")
    return { ok: true, data: await getPanelResolvedServiceCallsPage(restaurant.id, input.cursor) }
  } catch (cause) {
    return contextFailure<PanelResolvedCallsPage>(cause)
  }
}

export function claimPanelServiceCall(input: MutationInput) {
  return mutate(input, "claim_service_call")
}

export function resolvePanelServiceCall(input: MutationInput) {
  return mutate(input, "resolve_service_call")
}
