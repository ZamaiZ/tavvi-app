import { z } from "zod"

import { PANEL_PAYMENT_METHOD_VALUES } from "@/features/panel/payments/model"

export const updatePanelPaymentMethodsSchema = z.object({
  expectedRestaurantId: z.string().uuid(),
  enabledMethods: z.array(z.enum(PANEL_PAYMENT_METHOD_VALUES)).min(1).max(PANEL_PAYMENT_METHOD_VALUES.length),
}).strict().refine(
  (input) => new Set(input.enabledMethods).size === input.enabledMethods.length,
  { path: ["enabledMethods"], message: "duplicate_payment_method" },
)
