import "server-only"

import { z } from "zod"

import { createSupabaseServerClient } from "@/lib/supabase/server"

import type { PanelCashMovementDTO, PanelCashSessionDTO, PanelCashStateDTO } from "../model"

const cents = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const sessionSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "closed"]),
  businessDate: z.string().date(),
  timeZone: z.string().min(1).max(100),
  openedAt: z.string().datetime({ offset: true }),
  openedByName: z.string().min(1).max(120),
  openingAmountCents: cents,
  expectedAmountCents: cents,
  closedAt: z.string().datetime({ offset: true }).nullable(),
  closedByName: z.string().min(1).max(120).nullable(),
  countedAmountCents: cents.nullable(),
  differenceCents: z.number().int().refine((value) => Math.abs(value) <= Number.MAX_SAFE_INTEGER).nullable(),
  forcedClose: z.boolean(),
  closingReason: z.string().max(500).nullable(),
})
const sessionResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), session: sessionSchema.nullable() }),
  z.object({ ok: z.literal(false), code: z.string() }),
])
const movementSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["cash_in", "cash_out", "expense"]),
  amount_cents: cents,
  expense_category: z.enum(["supplies", "utilities", "maintenance", "transport", "payroll", "fees", "other"]).nullable(),
  payment_method_label_snapshot: z.string().min(2).max(40).nullable(),
  description: z.string().min(2).max(300),
  created_at: z.string().datetime({ offset: true }),
  created_by_name: z.string().min(1).max(120),
})
const paymentSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string().datetime({ offset: true }),
  created_by_name: z.string().min(1).max(120),
  comanda_payment_splits: z.array(z.object({
    id: z.string().uuid(),
    method_label_snapshot: z.string().min(2).max(40),
    amount_cents: cents,
  })).nullable(),
})

export async function getPanelCashState(restaurantId: string): Promise<PanelCashStateDTO> {
  const supabase = await createSupabaseServerClient("panel")
  const { data, error } = await supabase.rpc("get_panel_cash_session", { p_restaurant_id: restaurantId })
  if (error) {
    console.error("[panel-cash]", JSON.stringify({ stage: "session_read", code: error.code }))
    throw new Error("panel_cash_session_unavailable")
  }
  const parsed = sessionResponseSchema.safeParse(data)
  if (!parsed.success || !parsed.data.ok) {
    console.error("[panel-cash]", JSON.stringify({ stage: "session_response_invalid" }))
    throw new Error("panel_cash_session_unavailable")
  }
  const session: PanelCashSessionDTO | null = parsed.data.session
  if (!session) return { session: null, movements: [] }

  const [{ data: movementRows, error: movementError }, { data: paymentRows, error: paymentError }] = await Promise.all([
    supabase
      .from("financial_movements")
      .select("id, kind, amount_cents, expense_category, payment_method_label_snapshot, description, created_at, created_by_name")
      .eq("restaurant_id", restaurantId)
      .eq("cash_session_id", session.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(12),
    supabase
      .from("comanda_payments")
      .select("id, created_at, created_by_name, comanda_payment_splits(id, method_label_snapshot, amount_cents)")
      .eq("restaurant_id", restaurantId)
      .eq("cash_session_id", session.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(12),
  ])
  if (movementError || !movementRows || paymentError || !paymentRows) {
    console.error("[panel-cash]", JSON.stringify({ stage: "movement_read", code: movementError?.code ?? paymentError?.code }))
    throw new Error("panel_cash_movements_unavailable")
  }
  const parsedMovements = z.array(movementSchema).safeParse(movementRows)
  const parsedPayments = z.array(paymentSchema).safeParse(paymentRows)
  if (!parsedMovements.success || !parsedPayments.success) {
    console.error("[panel-cash]", JSON.stringify({ stage: "movement_response_invalid" }))
    throw new Error("panel_cash_movements_unavailable")
  }

  const movements: PanelCashMovementDTO[] = [
    ...parsedMovements.data.map((movement) => ({
      id: movement.id,
      kind: movement.kind,
      amountCents: movement.amount_cents,
      category: movement.expense_category,
      paymentMethodLabel: movement.payment_method_label_snapshot,
      description: movement.description,
      createdAt: movement.created_at,
      createdByName: movement.created_by_name,
    })),
    ...parsedPayments.data.map((payment) => {
      const splits = payment.comanda_payment_splits ?? []
      return {
        id: payment.id,
        kind: "payment" as const,
        amountCents: splits.reduce((total, split) => total + split.amount_cents, 0),
        category: null,
        paymentMethodLabel: [...new Set(splits.map((split) => split.method_label_snapshot))].join(" + "),
        description: "Recebimento em comanda",
        createdAt: payment.created_at,
        createdByName: payment.created_by_name,
      }
    }),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id)).slice(0, 12)
  return { session, movements }
}
