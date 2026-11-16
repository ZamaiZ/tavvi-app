import { z } from "zod"

import { PANEL_PAYMENT_METHOD_VALUES } from "@/features/panel/payments/model"
import { MENU_MAX_PRICE_CENTS } from "@/features/panel/menu/model"

const uuid = z.string().uuid()
const additionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  quantity: z.number().int().min(1).max(99),
  unitPriceCents: z.number().int().min(0).max(MENU_MAX_PRICE_CENTS),
}).strict()

const orderItemSchema = z.object({
  menuItemId: uuid,
  variantId: uuid.nullable(),
  quantity: z.number().int().min(1).max(99),
  observations: z.string().trim().max(500),
  additions: z.array(additionSchema).max(10),
}).strict()

export const recordPanelOrderSchema = z.object({
  expectedRestaurantId: uuid,
  callId: uuid,
  requestId: uuid,
  items: z.array(orderItemSchema).min(1).max(100),
}).strict()

const paymentSplitSchema = z.object({
  method: z.enum(PANEL_PAYMENT_METHOD_VALUES),
  amountCents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
}).strict()

export const recordPanelComandaPaymentSchema = z.object({
  expectedRestaurantId: uuid,
  comandaId: uuid,
  requestId: uuid,
  splits: z.array(paymentSplitSchema).min(1).max(PANEL_PAYMENT_METHOD_VALUES.length),
  closeIfPaid: z.boolean(),
}).strict().refine(
  (input) => new Set(input.splits.map((split) => split.method)).size === input.splits.length,
  { path: ["splits"], message: "duplicate_payment_method" },
)

export const closePaidComandaSchema = z.object({
  expectedRestaurantId: uuid,
  comandaId: uuid,
}).strict()
