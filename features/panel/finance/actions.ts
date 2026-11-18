"use server"

import { z } from "zod"

import { financeDateRangeSchema } from "@/features/panel/finance/schema"
import { getPanelFinanceDashboard, getPanelFinanceOverview } from "@/features/panel/finance/server/read"
import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"

const inputSchema = z.object({ expectedRestaurantId: z.string().uuid(), from: z.string().date(), to: z.string().date() }).strict()

export async function getPanelFinanceDetailsAction(rawInput: unknown) {
  const parsed = inputSchema.safeParse(rawInput)
  if (!parsed.success || !financeDateRangeSchema.safeParse(parsed.data).success) return { ok: false as const, code: "invalid_input" as const }
  try {
    const restaurant = await getActivePanelRestaurant(parsed.data.expectedRestaurantId)
    if (!restaurant || restaurant.status !== "active") return { ok: false as const, code: "context_changed" as const }
    const [details, overview] = await Promise.all([
      getPanelFinanceDashboard(restaurant.id, parsed.data),
      getPanelFinanceOverview(restaurant.id, parsed.data),
    ])
    return { ok: true as const, data: { ...details, pendingCents: overview.pendingCents, tipsReceivedCents: overview.tipsReceivedCents } }
  } catch (cause) {
    if (cause instanceof Error && cause.message === "panel_auth_required") return { ok: false as const, code: "session_expired" as const }
    return { ok: false as const, code: "unavailable" as const }
  }
}
