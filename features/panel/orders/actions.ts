"use server"

import type { PanelOrderActionResult, RecordPanelOrderResult } from "./model"
import { recordPanelOrderSchema } from "./schema"
import { recordPanelOrder } from "./server/write"

export async function recordPanelOrderAction(rawInput: unknown): Promise<PanelOrderActionResult<RecordPanelOrderResult>> {
  const parsed = recordPanelOrderSchema.safeParse(rawInput)
  if (!parsed.success) return { ok: false, code: "invalid_input" }
  return recordPanelOrder(parsed.data)
}
