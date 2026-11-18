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

const postgresInteger = z.number().int().min(1).max(2_147_483_647)

export const recordPanelOrderSchema = z.object({
  expectedRestaurantId: uuid,
  callId: uuid.nullable(),
  requestId: uuid,
  fulfillmentType: z.enum(["dine_in", "takeaway"]),
  tableNumber: postgresInteger.nullable(),
  customerName: z.string().trim().max(120).nullable().transform((value) => value || null),
  items: z.array(orderItemSchema).min(1).max(100),
}).strict().refine(
  (input) => input.callId === null || (input.fulfillmentType === "dine_in" && input.tableNumber === null),
  { path: ["callId"], message: "call_order_must_be_dine_in_without_manual_table" },
).refine(
  (input) => input.fulfillmentType !== "takeaway" || input.tableNumber === null,
  { path: ["tableNumber"], message: "takeaway_cannot_have_table" },
)

const paymentSplitSchema = z.object({
  method: z.string().trim().min(4).max(80).regex(/^(cash|debit|credit|pix|meal_voucher|food_voucher|partnership|custom:[0-9a-f-]{36})$/i),
  amountCents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  cashReceivedCents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
}).strict()

export const recordPanelComandaPaymentSchema = z.object({
  expectedRestaurantId: uuid,
  comandaId: uuid,
  requestId: uuid,
  splits: z.array(paymentSplitSchema).min(1).max(PANEL_PAYMENT_METHOD_VALUES.length + 20),
  closeIfPaid: z.boolean(),
  tipDecision: z.enum(["accepted", "declined"]).nullable(),
}).strict().refine(
  (input) => new Set(input.splits.map((split) => split.method)).size === input.splits.length,
  { path: ["splits"], message: "duplicate_payment_method" },
)

export const comandaTipDecisionSchema = z.object({
  expectedRestaurantId: uuid,
  comandaId: uuid,
  requestId: uuid,
  tipDecision: z.enum(["accepted", "declined"]).nullable(),
}).strict()

export const comandaDetailSchema = z.object({
  expectedRestaurantId: uuid,
  comandaId: uuid,
}).strict()
