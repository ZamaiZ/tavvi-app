import { z } from "zod"

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
