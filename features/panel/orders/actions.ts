"use server"

import type {
  PanelOrderActionResult,
  PanelPaymentActionResult,
  RecordPanelComandaPaymentResult,
  RecordPanelOrderResult,
} from "./model"
import { closePaidComandaSchema, recordPanelComandaPaymentSchema, recordPanelOrderSchema } from "./schema"
import { recordPanelOrder } from "./server/write"
import { closePaidPanelComanda, recordPanelComandaPayment } from "./server/payment-write"

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

export async function closePaidComandaAction(
  rawInput: unknown,
): Promise<PanelPaymentActionResult<{ closed: true; alreadyClosed: boolean }>> {
  const parsed = closePaidComandaSchema.safeParse(rawInput)
  if (!parsed.success) return { ok: false, code: "invalid_input" }
  return closePaidPanelComanda(parsed.data)
}
