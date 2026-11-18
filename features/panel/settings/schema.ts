import { z } from "zod"

import { PANEL_PAYMENT_METHOD_VALUES } from "@/features/panel/payments/model"

export const updatePanelPaymentMethodsSchema = z.object({
  expectedRestaurantId: z.string().uuid(),
  enabledMethods: z.array(z.enum(PANEL_PAYMENT_METHOD_VALUES)).max(PANEL_PAYMENT_METHOD_VALUES.length),
  customMethods: z.array(z.object({
    id: z.string().uuid().nullable(),
    label: z.string().trim().min(2).max(40),
    kind: z.enum(["cash", "electronic"]),
    isActive: z.boolean(),
  }).strict()).max(20),
  tipPolicy: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("disabled") }).strict(),
    z.object({ mode: z.literal("percentage"), percentageBps: z.number().int().min(1).max(10000) }).strict(),
    z.object({ mode: z.literal("fixed"), fixedCents: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER) }).strict(),
  ]),
}).strict().refine(
  (input) => new Set(input.enabledMethods).size === input.enabledMethods.length,
  { path: ["enabledMethods"], message: "duplicate_payment_method" },
).refine(
  (input) => new Set(input.customMethods.filter((method) => method.id).map((method) => method.id)).size === input.customMethods.filter((method) => method.id).length,
  { path: ["customMethods"], message: "duplicate_custom_method_id" },
).refine(
  (input) => {
    const labels = input.customMethods.map((method) => method.label.trim().toLocaleLowerCase("pt-BR"))
    return new Set(labels).size === labels.length
  },
  { path: ["customMethods"], message: "duplicate_custom_method_label" },
)
