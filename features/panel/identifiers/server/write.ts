import "server-only"

import { revalidatePath } from "next/cache"
import type { z } from "zod"

import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import { createPublicMenuTagUrl } from "@/lib/routing/panel"
import { createSupabaseServerClient } from "@/lib/supabase/server"

import type {
  IdentifierActionFailureCode,
  IdentifierActionResult,
  IdentifierCreateResult,
  IdentifierNfcCancellationResult,
  IdentifierUpdateResult,
} from "../model"
import {
  identifierCreateSchema,
  identifierActiveSchema,
  identifierNfcBeginSchema,
  identifierNfcCompleteSchema,
  identifierNfcOperationSchema,
  identifierNfcWriteSchema,
  identifierNfcWriteClaimSchema,
  identifierNfcUncertainSchema,
  identifierUpdateSchema,
} from "../schema"

type CreateInput = z.infer<typeof identifierCreateSchema>
type UpdateInput = z.infer<typeof identifierUpdateSchema>
type ActiveInput = z.infer<typeof identifierActiveSchema>
type BeginInput = z.infer<typeof identifierNfcBeginSchema>
type OperationInput = z.infer<typeof identifierNfcOperationSchema>
type WriteInput = z.infer<typeof identifierNfcWriteSchema>
type WriteClaimInput = z.infer<typeof identifierNfcWriteClaimSchema>
type UncertainInput = z.infer<typeof identifierNfcUncertainSchema>
type CompleteInput = z.infer<typeof identifierNfcCompleteSchema>

type RpcPayload = { ok?: unknown; code?: unknown; id?: unknown; public_token?: unknown; serial_reservation?: unknown }
type Context = {
  restaurant: NonNullable<Awaited<ReturnType<typeof getActivePanelRestaurant>>>
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
}

const FAILURE_CODES = new Set<IdentifierActionFailureCode>([
  "invalid_input", "session_expired", "context_changed", "unavailable", "database_error", "forbidden",
  "not_found", "table_conflict", "active_call", "serial_in_use", "token_conflict", "inactive",
  "already_protected", "operation_exists", "operation_not_found", "operation_state", "serial_mismatch",
])

function failure<T>(code: IdentifierActionFailureCode): IdentifierActionResult<T> {
  return { ok: false, code }
}

function rpcFailureCode(payload: RpcPayload | null | undefined, errorCode?: string): IdentifierActionFailureCode | null {
  if (payload?.ok === true) return null
  if (typeof payload?.code === "string" && FAILURE_CODES.has(payload.code as IdentifierActionFailureCode)) {
    return payload.code as IdentifierActionFailureCode
  }
  if (errorCode === "23505") return "database_error"
  return errorCode ? "unavailable" : "database_error"
}

function rpcPayload(value: unknown): RpcPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as RpcPayload
}

async function getContext(expectedRestaurantId: string): Promise<Context> {
  const restaurant = await getActivePanelRestaurant(expectedRestaurantId)
  if (!restaurant || restaurant.status !== "active") throw new Error("panel_restaurant_context_changed")
  const supabase = await createSupabaseServerClient("panel")
  return { restaurant, supabase }
}

function contextFailure<T>(cause: unknown): IdentifierActionResult<T> {
  const code = cause instanceof Error ? cause.message : ""
  if (code === "panel_auth_required") return failure("session_expired")
  if (code === "panel_restaurant_context_changed" || code === "panel_restaurant_not_found") return failure("context_changed")
  return failure("unavailable")
}

function revalidateIdentifiers(slug?: string) {
  revalidatePath("/identificadores")
  revalidatePath("/painel/identificadores")
  if (slug) revalidatePath(`/${slug}`)
}

async function runRpc<T>(
  call: () => PromiseLike<{ data: unknown; error: { code?: string } | null }>,
  success: (payload: RpcPayload) => T,
): Promise<IdentifierActionResult<T>> {
  try {
    const result = await call()
    const payload = rpcPayload(result.data)
    const code = rpcFailureCode(payload, result.error?.code)
    if (code) {
      if (result.error) console.error("[panel-identifiers]", JSON.stringify({ stage: "mutation", code: result.error.code }))
      return failure(code)
    }
    if (!payload) return failure("database_error")
    return { ok: true, data: success(payload) }
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith("panel_")) return contextFailure(cause)
    console.error("[panel-identifiers]", JSON.stringify({ stage: "mutation_unavailable" }))
    return failure("unavailable")
  }
}

export async function createIdentifier(input: CreateInput): Promise<IdentifierActionResult<IdentifierCreateResult>> {
  let context: Context
  try {
    context = await getContext(input.expectedRestaurantId)
  } catch (cause) {
    return contextFailure(cause)
  }

  const result = await runRpc(
    () => context.supabase.rpc("create_menu_tag", {
      p_restaurant_id: context.restaurant.id,
      p_table_number: input.tableNumber,
    }),
    (payload) => ({
      id: typeof payload.id === "string" ? payload.id : "",
      publicToken: typeof payload.public_token === "string" ? payload.public_token : "",
    }),
  )
  if (!result.ok) return result
  if (!result.data.id || !/^[0-9A-F]{32}$/.test(result.data.publicToken)) return failure("database_error")
  revalidateIdentifiers()
  return { ok: true, data: { id: result.data.id, publicUrl: createPublicMenuTagUrl(result.data.publicToken) } }
}

export async function updateIdentifier(input: UpdateInput): Promise<IdentifierActionResult<IdentifierUpdateResult>> {
  let context: Context
  try {
    context = await getContext(input.expectedRestaurantId)
  } catch (cause) {
    return contextFailure(cause)
  }
  const result = await runRpc(
    () => context.supabase.rpc("update_menu_tag_table_number", {
      p_restaurant_id: context.restaurant.id,
      p_tag_id: input.id,
      p_table_number: input.tableNumber,
    }),
    () => ({ id: input.id }),
  )
  if (result.ok) revalidateIdentifiers(context.restaurant.slug)
  return result
}

export async function setIdentifierActive(input: ActiveInput): Promise<IdentifierActionResult<IdentifierUpdateResult>> {
  let context: Context
  try {
    context = await getContext(input.expectedRestaurantId)
  } catch (cause) {
    return contextFailure(cause)
  }
  const result = await runRpc(
    () => context.supabase.rpc("set_menu_tag_active", {
      p_restaurant_id: context.restaurant.id,
      p_tag_id: input.id,
      p_is_active: input.isActive,
    }),
    () => ({ id: input.id }),
  )
  if (result.ok) revalidateIdentifiers(context.restaurant.slug)
  return result
}

async function runNfcOperation<T = null>(
  expectedRestaurantId: string,
  rpcName: string,
  values: Record<string, string>,
  refresh = false,
  success: (payload: RpcPayload) => T = () => null as T,
): Promise<IdentifierActionResult<T>> {
  let context: Context
  try {
    context = await getContext(expectedRestaurantId)
  } catch (cause) {
    return contextFailure(cause)
  }
  const result = await runRpc(
    () => context.supabase.rpc(rpcName, { p_restaurant_id: context.restaurant.id, ...values }),
    success,
  )
  if (result.ok && refresh) revalidateIdentifiers()
  return result
}

export function beginIdentifierNfc(input: BeginInput) {
  return runNfcOperation(input.expectedRestaurantId, "begin_menu_tag_nfc_operation", {
    p_tag_id: input.id,
    p_operation_id: input.operationId,
    p_serial: input.serial,
  })
}

export function markIdentifierNfcWriteStarted(input: WriteInput) {
  return runNfcOperation(input.expectedRestaurantId, "mark_menu_tag_nfc_write_started", {
    p_tag_id: input.id,
    p_operation_id: input.operationId,
    p_attempt_id: input.attemptId,
  })
}

export function markIdentifierNfcPhysicalStarted(input: WriteInput) {
  return runNfcOperation(input.expectedRestaurantId, "mark_menu_tag_nfc_physical_started", {
    p_tag_id: input.id,
    p_operation_id: input.operationId,
    p_attempt_id: input.attemptId,
  })
}

function cancellationResult(payload: RpcPayload): IdentifierNfcCancellationResult {
  return { serialReservation: payload.serial_reservation === "released" ? "released" : "retained" }
}

export function cancelIdentifierNfc(input: OperationInput): Promise<IdentifierActionResult<IdentifierNfcCancellationResult>> {
  return runNfcOperation(input.expectedRestaurantId, "cancel_menu_tag_nfc_operation", {
    p_tag_id: input.id,
    p_operation_id: input.operationId,
  }, true, cancellationResult)
}

export function cancelIdentifierNfcWriteClaim(input: WriteClaimInput): Promise<IdentifierActionResult<IdentifierNfcCancellationResult>> {
  return runNfcOperation(input.expectedRestaurantId, "cancel_menu_tag_nfc_write_claim", {
    p_tag_id: input.id,
    p_operation_id: input.operationId,
    p_attempt_id: input.attemptId,
  }, true, cancellationResult)
}

export function markIdentifierNfcUncertain(input: UncertainInput) {
  return runNfcOperation(input.expectedRestaurantId, "mark_menu_tag_nfc_uncertain", {
    p_tag_id: input.id,
    p_operation_id: input.operationId,
    p_attempt_id: input.attemptId,
    p_reason: input.reason,
  }, true)
}

export function completeIdentifierNfc(input: CompleteInput) {
  return runNfcOperation(input.expectedRestaurantId, "complete_menu_tag_nfc_protection", {
    p_tag_id: input.id,
    p_operation_id: input.operationId,
    p_serial: input.serial,
    p_attempt_id: input.attemptId,
  }, true)
}

