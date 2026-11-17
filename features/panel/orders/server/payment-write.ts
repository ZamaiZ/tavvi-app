import "server-only"

import { z } from "zod"

import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import { createSupabaseServerClient } from "@/lib/supabase/server"

import type {
  PanelPaymentActionResult,
  PanelPaymentFailureCode,
  RecordPanelComandaPaymentResult,
} from "../model"
import type { PaymentSplitInput } from "@/features/panel/payments/model"

type PaymentInput = {
  expectedRestaurantId: string
  comandaId: string
  requestId: string
  splits: PaymentSplitInput[]
  closeIfPaid: boolean
}

type CloseInput = {
  expectedRestaurantId: string
  comandaId: string
}

const safeCents = z.preprocess(
  (value) => typeof value === "string" ? Number(value) : value,
  z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
)

const recordResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    paymentId: z.string().uuid(),
    closed: z.boolean(),
    paidCents: safeCents,
    balanceCents: safeCents,
  }),
  z.object({
    ok: z.literal(false),
    code: z.enum([
      "session_expired",
      "forbidden",
      "not_found",
      "invalid_input",
      "request_conflict",
      "comanda_not_found",
      "comanda_conflict",
      "payment_method_disabled",
      "cash_session_required",
      "cash_session_closed",
      "balance_already_paid",
      "payment_exceeds_balance",
      "close_requires_full_payment",
    ]),
  }),
])

const closeResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    closed: z.literal(true),
    alreadyClosed: z.boolean(),
  }),
  z.object({
    ok: z.literal(false),
    code: z.enum(["session_expired", "forbidden", "invalid_input", "not_found", "comanda_not_found", "balance_remaining"]),
    balanceCents: safeCents.optional(),
  }),
])

function failure<T>(code: PanelPaymentFailureCode): PanelPaymentActionResult<T> {
  return { ok: false, code }
}

async function getPaymentContext(expectedRestaurantId: string) {
  const restaurant = await getActivePanelRestaurant(expectedRestaurantId)
  if (!restaurant || restaurant.status !== "active") throw new Error("panel_restaurant_context_changed")
  const supabase = await createSupabaseServerClient("panel")
  return { restaurant, supabase }
}

function contextFailure<T>(cause: unknown): PanelPaymentActionResult<T> {
  const message = cause instanceof Error ? cause.message : ""
  if (message === "panel_auth_required") return failure("session_expired")
  if (message === "panel_restaurant_context_changed" || message === "panel_restaurant_not_found") {
    return failure("context_changed")
  }
  return failure("unavailable")
}

function mapFailure(code: string): PanelPaymentFailureCode {
  if (code === "session_expired") return "session_expired"
  if (code === "forbidden") return "forbidden"
  if (code === "invalid_input") return "invalid_input"
  if (code === "not_found" || code === "comanda_not_found") return "comanda_not_found"
  if (code === "request_conflict") return "request_conflict"
  if (code === "comanda_conflict") return "comanda_conflict"
  if (code === "payment_method_disabled") return "payment_method_disabled"
  if (code === "cash_session_required") return "cash_session_required"
  if (code === "cash_session_closed") return "cash_session_closed"
  if (code === "balance_already_paid") return "balance_already_paid"
  if (code === "payment_exceeds_balance") return "payment_exceeds_balance"
  if (code === "close_requires_full_payment") return "close_requires_full_payment"
  if (code === "balance_remaining") return "balance_remaining"
  return "database_error"
}

export async function recordPanelComandaPayment(
  input: PaymentInput,
): Promise<PanelPaymentActionResult<RecordPanelComandaPaymentResult>> {
  let context: Awaited<ReturnType<typeof getPaymentContext>>
  try {
    context = await getPaymentContext(input.expectedRestaurantId)
  } catch (cause) {
    return contextFailure(cause)
  }

  try {
    const { data, error } = await context.supabase.rpc("record_panel_comanda_payment_v2", {
      p_restaurant_id: context.restaurant.id,
      p_comanda_id: input.comandaId,
      p_request_id: input.requestId,
      p_splits: input.splits,
      p_close_if_paid: input.closeIfPaid,
    })
    if (error) {
      console.error("[panel-payments]", JSON.stringify({ stage: "record", code: error.code }))
      return failure(error.code === "42501" ? "forbidden" : "unavailable")
    }

    const parsed = recordResponseSchema.safeParse(data)
    if (!parsed.success) {
      console.error("[panel-payments]", JSON.stringify({ stage: "record_response_invalid" }))
      return failure("database_error")
    }
    if (!parsed.data.ok) return failure(mapFailure(parsed.data.code))
    return {
      ok: true,
      data: {
        paymentId: parsed.data.paymentId,
        closed: parsed.data.closed,
        paidCents: parsed.data.paidCents,
        balanceCents: parsed.data.balanceCents,
      },
    }
  } catch {
    console.error("[panel-payments]", JSON.stringify({ stage: "record", code: "transport_error" }))
    return failure("unavailable")
  }
}

export async function closePaidPanelComanda(
  input: CloseInput,
): Promise<PanelPaymentActionResult<{ closed: true; alreadyClosed: boolean }>> {
  let context: Awaited<ReturnType<typeof getPaymentContext>>
  try {
    context = await getPaymentContext(input.expectedRestaurantId)
  } catch (cause) {
    return contextFailure(cause)
  }

  try {
    const { data, error } = await context.supabase.rpc("close_paid_panel_comanda_v2", {
      p_restaurant_id: context.restaurant.id,
      p_comanda_id: input.comandaId,
    })
    if (error) {
      console.error("[panel-payments]", JSON.stringify({ stage: "close", code: error.code }))
      return failure(error.code === "42501" ? "forbidden" : "unavailable")
    }

    const parsed = closeResponseSchema.safeParse(data)
    if (!parsed.success) {
      console.error("[panel-payments]", JSON.stringify({ stage: "close_response_invalid" }))
      return failure("database_error")
    }
    if (!parsed.data.ok) return failure(mapFailure(parsed.data.code))
    return { ok: true, data: { closed: true, alreadyClosed: parsed.data.alreadyClosed } }
  } catch {
    console.error("[panel-payments]", JSON.stringify({ stage: "close", code: "transport_error" }))
    return failure("unavailable")
  }
}
