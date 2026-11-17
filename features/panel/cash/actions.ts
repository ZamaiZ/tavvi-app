"use server"

import { closePanelCashSessionSchema, openPanelCashSessionSchema, recordPanelFinancialMovementSchema } from "./schema"
import { closePanelCashSession, openPanelCashSession, recordPanelFinancialMovement } from "./server/write"
import type { PanelCashActionResult } from "./model"

export async function openPanelCashSessionAction(rawInput: unknown): Promise<PanelCashActionResult<{ sessionId: string; alreadyOpen: boolean }>> {
  const parsed = openPanelCashSessionSchema.safeParse(rawInput)
  if (!parsed.success) return { ok: false, code: "invalid_input" }
  return openPanelCashSession(parsed.data)
}

export async function recordPanelFinancialMovementAction(rawInput: unknown): Promise<PanelCashActionResult<{ movementId: string; alreadyRecorded: boolean }>> {
  const parsed = recordPanelFinancialMovementSchema.safeParse(rawInput)
  if (!parsed.success) return { ok: false, code: "invalid_input" }
  return recordPanelFinancialMovement(parsed.data)
}

export async function closePanelCashSessionAction(rawInput: unknown): Promise<PanelCashActionResult<{ alreadyClosed: boolean; expectedCents: number; differenceCents: number; pendingComandas?: number }>> {
  const parsed = closePanelCashSessionSchema.safeParse(rawInput)
  if (!parsed.success) return { ok: false, code: "invalid_input" }
  return closePanelCashSession(parsed.data)
}
