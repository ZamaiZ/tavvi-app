"use server"

import type { PaymentSettingsResult } from "./model"
import { updatePanelPaymentMethodsSchema } from "./schema"
import { savePanelPaymentMethods } from "./server/write"

export async function updatePanelPaymentMethodsAction(rawInput: unknown): Promise<PaymentSettingsResult> {
  const parsed = updatePanelPaymentMethodsSchema.safeParse(rawInput)
  if (!parsed.success) return { ok: false, code: "invalid_input" }
  return savePanelPaymentMethods(parsed.data)
}
