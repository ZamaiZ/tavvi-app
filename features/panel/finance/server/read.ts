import "server-only"

import { z } from "zod"

import { financeDateRangeSchema } from "@/features/panel/finance/schema"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const cents = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const responseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    from: z.string().date(),
    to: z.string().date(),
    timeZone: z.string().min(1).max(100),
    salesCents: cents,
    receivedCents: cents,
    cashReceivedCents: cents,
    expensesCents: cents,
    cashInCents: cents,
    cashOutCents: cents,
    cashClosingSessionsCount: z.number().int().nonnegative(),
    cashOpenSessionsCount: z.number().int().nonnegative(),
    cashClosingExpectedCents: cents,
    cashClosingCountedCents: cents,
    cashClosingDifferenceCents: cents,
    cashDifferenceSessionsCount: z.number().int().nonnegative(),
    pendingCents: cents,
    daily: z.array(z.object({ day: z.string().date(), salesCents: cents, receivedCents: cents, expensesCents: cents })),
    expensesByCategory: z.array(z.object({ category: z.string().min(1).max(80), amountCents: cents })),
    expensesByMethod: z.array(z.object({ method: z.string().min(1).max(80), amountCents: cents })),
    receivedByMethod: z.array(z.object({ method: z.string().min(1).max(80), amountCents: cents })),
  }),
  z.object({ ok: z.literal(false), code: z.string() }),
])

export async function getPanelFinanceDashboard(restaurantId: string, input: { from: string; to: string }) {
  const range = financeDateRangeSchema.safeParse(input)
  if (!range.success) throw new Error("panel_finance_date_range_invalid")
  const supabase = await createSupabaseServerClient("panel")
  const { data, error } = await supabase.rpc("get_panel_finance_dashboard", {
    p_restaurant_id: restaurantId,
    p_from: range.data.from,
    p_to: range.data.to,
  })
  if (error) {
    console.error("[panel-finance]", JSON.stringify({ stage: "dashboard_read", code: error.code }))
    throw new Error("panel_finance_dashboard_unavailable")
  }
  const parsed = responseSchema.safeParse(data)
  if (!parsed.success || !parsed.data.ok) {
    console.error("[panel-finance]", JSON.stringify({ stage: "dashboard_response_invalid" }))
    throw new Error("panel_finance_dashboard_unavailable")
  }
  const categoryLabels: Record<string, string> = {
    supplies: "Compras e insumos",
    utilities: "Contas e serviços",
    maintenance: "Manutenção",
    transport: "Transporte",
    payroll: "Equipe",
    fees: "Taxas",
    other: "Outros",
  }
  return {
    ...parsed.data,
    expensesByCategory: parsed.data.expensesByCategory.map((item) => ({ label: categoryLabels[item.category] ?? item.category, ...item })),
    expensesByMethod: parsed.data.expensesByMethod.map((item) => ({ label: item.method, ...item })),
    receivedByMethod: parsed.data.receivedByMethod.map((item) => ({ label: item.method, ...item })),
  }
}
