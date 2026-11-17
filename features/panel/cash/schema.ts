import { z } from "zod"

const uuid = z.string().uuid()
const cents = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)

export const openPanelCashSessionSchema = z.object({
  expectedRestaurantId: uuid,
  requestId: uuid,
  openingAmountCents: cents,
}).strict()

export const recordPanelFinancialMovementSchema = z.object({
  expectedRestaurantId: uuid,
  sessionId: uuid.nullable(),
  requestId: uuid,
  kind: z.enum(["cash_in", "cash_out", "expense"]),
  amountCents: cents.min(1),
  expenseCategory: z.enum(["supplies", "utilities", "maintenance", "transport", "payroll", "fees", "other"]).nullable(),
  paymentMethod: z.string().min(4).max(80).nullable(),
  description: z.string().trim().min(2).max(300),
}).strict().refine(
  (input) => input.kind === "expense"
    ? input.expenseCategory !== null && input.paymentMethod !== null
    : input.expenseCategory === null && input.paymentMethod === null && input.sessionId !== null,
  { path: ["kind"], message: "invalid_financial_movement_shape" },
)

export const closePanelCashSessionSchema = z.object({
  expectedRestaurantId: uuid,
  sessionId: uuid,
  requestId: uuid,
  countedAmountCents: cents,
  reason: z.string().trim().max(500),
  force: z.boolean(),
}).strict().refine(
  (input) => !input.force || input.reason.length >= 3,
  { path: ["reason"], message: "forced_close_requires_reason" },
)
