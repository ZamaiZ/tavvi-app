"use server"

import { headers } from "next/headers"
import { z } from "zod"

import type {
  ClosePanelComandaConsumptionResult,
  PanelComandaDetailActionResult,
  PanelOrderActionResult,
  PanelPaymentActionResult,
  RecordPanelComandaPaymentResult,
  RecordPanelOrderResult,
} from "./model"
import { comandaDetailSchema, comandaTipDecisionSchema, recordPanelComandaPaymentSchema, recordPanelOrderSchema } from "./schema"
import { recordPanelOrder } from "./server/write"
import { closePanelComandaConsumption, recordPanelComandaPayment, resolvePanelComandaTip } from "./server/payment-write"
import { getPanelComandaDetail } from "./server/read"
import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import { getPanelMenu } from "@/features/panel/menu/server/read"
import { getPanelPublicBasePath } from "@/features/panel/auth/navigation"
import { getRequestHostname } from "@/lib/routing/host"

export async function recordPanelOrderAction(rawInput: unknown): Promise<PanelOrderActionResult<RecordPanelOrderResult>> {
  const parsed = recordPanelOrderSchema.safeParse(rawInput)
  if (!parsed.success) return { ok: false, code: "invalid_input" }
  return recordPanelOrder(parsed.data)
}

export async function recordPanelComandaPaymentAction(
  rawInput: unknown,
): Promise<PanelPaymentActionResult<RecordPanelComandaPaymentResult>> {
  const parsed = recordPanelComandaPaymentSchema.safeParse(rawInput)
  if (!parsed.success) return { ok: false, code: "invalid_input" }
  return recordPanelComandaPayment(parsed.data)
}

export async function getPanelComandaDetailAction(rawInput: unknown): Promise<PanelComandaDetailActionResult> {
  const parsed = comandaDetailSchema.safeParse(rawInput)
  if (!parsed.success) return { ok: false, code: "invalid_input" }
  try {
    const restaurant = await getActivePanelRestaurant(parsed.data.expectedRestaurantId)
    if (!restaurant || restaurant.status !== "active") return { ok: false, code: "context_changed" }
    return { ok: true, data: await getPanelComandaDetail(restaurant, parsed.data.comandaId) }
  } catch (cause) {
    if (cause instanceof Error && cause.message === "panel_auth_required") return { ok: false, code: "session_expired" }
    return { ok: false, code: "unavailable" }
  }
}

export async function getPanelCounterOrderMenuAction(rawInput: unknown) {
  const parsed = z.object({ expectedRestaurantId: z.string().uuid() }).strict().safeParse(rawInput)
  if (!parsed.success) return { ok: false as const, code: "invalid_input" as const }
  try {
    const [restaurant, requestHeaders] = await Promise.all([
      getActivePanelRestaurant(parsed.data.expectedRestaurantId),
      headers(),
    ])
    if (!restaurant || restaurant.status !== "active") return { ok: false as const, code: "context_changed" as const }
    const base = getPanelPublicBasePath(getRequestHostname(requestHeaders))
    return { ok: true as const, data: await getPanelMenu(restaurant, base) }
  } catch (cause) {
    if (cause instanceof Error && cause.message === "panel_auth_required") return { ok: false as const, code: "session_expired" as const }
    return { ok: false as const, code: "unavailable" as const }
  }
}

export async function closePanelComandaConsumptionAction(
  rawInput: unknown,
): Promise<PanelPaymentActionResult<ClosePanelComandaConsumptionResult>> {
  const parsed = comandaTipDecisionSchema.safeParse(rawInput)
  if (!parsed.success) return { ok: false, code: "invalid_input" }
  return closePanelComandaConsumption(parsed.data)
}

export async function resolvePanelComandaTipAction(
  rawInput: unknown,
): Promise<PanelPaymentActionResult<ClosePanelComandaConsumptionResult>> {
  const parsed = comandaTipDecisionSchema.safeParse(rawInput)
  if (!parsed.success) return { ok: false, code: "invalid_input" }
  return resolvePanelComandaTip(parsed.data)
}
