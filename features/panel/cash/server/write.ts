import "server-only"

import { z } from "zod"

import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import { createSupabaseServerClient } from "@/lib/supabase/server"

import type {
  ClosePanelCashSessionInput,
  OpenPanelCashSessionInput,
  PanelCashActionResult,
  PanelCashFailureCode,
  RecordPanelFinancialMovementInput,
} from "../model"

const nonnegativeCents = z.preprocess((value) => typeof value === "string" ? Number(value) : value, z.number().int().min(0).max(Number.MAX_SAFE_INTEGER))
const responseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), sessionId: z.string().uuid(), alreadyOpen: z.boolean() }),
  z.object({ ok: z.literal(false), code: z.string() }),
])
const movementResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), movementId: z.string().uuid(), alreadyRecorded: z.boolean() }),
  z.object({ ok: z.literal(false), code: z.string() }),
])
const closeResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), alreadyClosed: z.boolean(), expectedCents: nonnegativeCents, differenceCents: z.number().int().refine((value) => Math.abs(value) <= Number.MAX_SAFE_INTEGER), pendingComandas: z.number().int().nonnegative().optional() }),
  z.object({ ok: z.literal(false), code: z.string(), openComandas: z.number().int().nonnegative().optional(), expectedCents: nonnegativeCents.optional(), differenceCents: z.number().int().refine((value) => Math.abs(value) <= Number.MAX_SAFE_INTEGER).optional() }),
])

function failure<T>(code: PanelCashFailureCode): PanelCashActionResult<T> {
  return { ok: false, code }
}

async function getCashContext(expectedRestaurantId: string) {
  const restaurant = await getActivePanelRestaurant(expectedRestaurantId)
  if (!restaurant || restaurant.status !== "active") throw new Error("panel_restaurant_context_changed")
  return { restaurant, supabase: await createSupabaseServerClient("panel") }
}

function contextFailure<T>(cause: unknown): PanelCashActionResult<T> {
  const message = cause instanceof Error ? cause.message : ""
  if (message === "panel_auth_required") return failure("session_expired")
  if (message === "panel_restaurant_context_changed" || message === "panel_restaurant_not_found") return failure("context_changed")
  return failure("unavailable")
}

function parseResponse<T>(data: unknown, schema: z.ZodType<T>, stage: string): T | null {
  const parsed = schema.safeParse(data)
  if (!parsed.success) console.error("[panel-cash]", JSON.stringify({ stage: `${stage}_response_invalid` }))
  return parsed.success ? parsed.data : null
}

function mapFailure(code: string): PanelCashFailureCode {
  const known: PanelCashFailureCode[] = [
    "invalid_input", "session_expired", "context_changed", "unavailable", "database_error", "forbidden", "not_found",
    "request_conflict", "session_already_open", "session_already_closed_today", "cash_session_required", "cash_session_closed", "cash_session_not_found",
    "open_comandas", "reason_required", "difference_reason_required", "payment_method_disabled", "amount_overflow",
  ]
  return known.includes(code as PanelCashFailureCode) ? code as PanelCashFailureCode : "database_error"
}

export async function openPanelCashSession(input: OpenPanelCashSessionInput): Promise<PanelCashActionResult<{ sessionId: string; alreadyOpen: boolean }>> {
  let context: Awaited<ReturnType<typeof getCashContext>>
  try { context = await getCashContext(input.expectedRestaurantId) } catch (cause) { return contextFailure(cause) }
  const { data, error } = await context.supabase.rpc("open_panel_cash_session", {
    p_restaurant_id: context.restaurant.id,
    p_request_id: input.requestId,
    p_opening_amount_cents: input.openingAmountCents,
    p_opening_count: null,
  })
  if (error) {
    console.error("[panel-cash]", JSON.stringify({ stage: "open", code: error.code }))
    return failure(error.code === "42501" ? "forbidden" : "unavailable")
  }
  const result = parseResponse(data, responseSchema, "open")
  if (!result) return failure("database_error")
  if (!result.ok) return failure(mapFailure(result.code))
  return { ok: true, data: { sessionId: result.sessionId, alreadyOpen: result.alreadyOpen } }
}

export async function recordPanelFinancialMovement(input: RecordPanelFinancialMovementInput): Promise<PanelCashActionResult<{ movementId: string; alreadyRecorded: boolean }>> {
  let context: Awaited<ReturnType<typeof getCashContext>>
  try { context = await getCashContext(input.expectedRestaurantId) } catch (cause) { return contextFailure(cause) }
  const { data, error } = await context.supabase.rpc("record_panel_financial_movement", {
    p_restaurant_id: context.restaurant.id,
    p_session_id: input.sessionId,
    p_request_id: input.requestId,
    p_kind: input.kind,
    p_amount_cents: input.amountCents,
    p_expense_category: input.expenseCategory,
    p_payment_method: input.paymentMethod,
    p_description: input.description,
  })
  if (error) {
    console.error("[panel-cash]", JSON.stringify({ stage: "movement_write", code: error.code }))
    return failure(error.code === "42501" ? "forbidden" : "unavailable")
  }
  const result = parseResponse(data, movementResponseSchema, "movement")
  if (!result) return failure("database_error")
  if (!result.ok) return failure(mapFailure(result.code))
  return { ok: true, data: { movementId: result.movementId, alreadyRecorded: result.alreadyRecorded } }
}

export async function closePanelCashSession(input: ClosePanelCashSessionInput): Promise<PanelCashActionResult<{ alreadyClosed: boolean; expectedCents: number; differenceCents: number; pendingComandas?: number }>> {
  let context: Awaited<ReturnType<typeof getCashContext>>
  try { context = await getCashContext(input.expectedRestaurantId) } catch (cause) { return contextFailure(cause) }
  const { data, error } = await context.supabase.rpc("close_panel_cash_session", {
    p_restaurant_id: context.restaurant.id,
    p_session_id: input.sessionId,
    p_request_id: input.requestId,
    p_counted_amount_cents: input.countedAmountCents,
    p_closing_count: null,
    p_reason: input.reason || null,
    p_force: input.force,
  })
  if (error) {
    console.error("[panel-cash]", JSON.stringify({ stage: "close", code: error.code }))
    return failure(error.code === "42501" ? "forbidden" : "unavailable")
  }
  const result = parseResponse(data, closeResponseSchema, "close")
  if (!result) return failure("database_error")
  if (!result.ok) {
    return {
      ok: false,
      code: mapFailure(result.code),
      ...(result.openComandas === undefined ? {} : { openComandas: result.openComandas }),
      ...(result.expectedCents === undefined ? {} : { expectedCents: result.expectedCents }),
      ...(result.differenceCents === undefined ? {} : { differenceCents: result.differenceCents }),
    }
  }
  return { ok: true, data: result }
}
