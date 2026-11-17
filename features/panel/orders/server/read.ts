import "server-only"

import { z } from "zod"

import type { PanelRestaurantDTO } from "@/features/panel/onboarding/model"
import { PANEL_PAYMENT_METHOD_VALUES } from "@/features/panel/payments/model"
import { createSupabaseServerClient } from "@/lib/supabase/server"

import type {
  PanelComandaAdditionDTO,
  PanelComandaDTO,
  PanelComandaItemDTO,
  PanelComandaOrderDTO,
  PanelComandaPaymentDTO,
  PanelComandasPage,
} from "../model"

export const CLOSED_COMANDA_PAGE_SIZE = 25

const centsSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const paymentSplitSchema = z.object({
  id: z.string().uuid(),
  method: z.enum([...PANEL_PAYMENT_METHOD_VALUES, "custom"]),
  custom_method_id: z.string().uuid().nullable(),
  method_label_snapshot: z.string().min(2).max(40),
  method_kind_snapshot: z.enum(["cash", "electronic"]),
  amount_cents: centsSchema,
  cash_received_cents: centsSchema.nullable(),
  change_cents: centsSchema.nullable(),
  position: z.number().int().nonnegative(),
})
const paymentSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string().datetime({ offset: true }),
  created_by: z.string().uuid(),
  created_by_name: z.string().min(1).max(120),
  amount_cents: centsSchema,
  comanda_payment_splits: z.array(paymentSplitSchema).nullable(),
})
const additionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80),
  quantity: z.number().int().positive(),
  unit_price_cents: centsSchema,
  position: z.number().int().nonnegative(),
})
const itemSchema = z.object({
  id: z.string().uuid(),
  category_name: z.string(),
  item_name: z.string(),
  variant_name: z.string().nullable(),
  quantity: z.number().int().positive(),
  unit_price_cents: centsSchema,
  observations: z.string(),
  position: z.number().int().nonnegative(),
  order_item_additions: z.array(additionSchema).nullable(),
})
const displayNumberSchema = z.preprocess(
  (value) => typeof value === "string" ? Number(value) : value,
  z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
)
const orderSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string().datetime({ offset: true }),
  fulfillment_type: z.enum(["dine_in", "takeaway"]),
  display_number: displayNumberSchema,
  customer_name: z.string().min(1).max(120).nullable(),
  order_items: z.array(itemSchema).nullable(),
})
const comandaSchema = z.object({
  id: z.string().uuid(),
  restaurant_id: z.string().uuid(),
  table_number: z.number().int().positive().nullable(),
  status: z.enum(["open", "pending", "closed"]),
  opened_at: z.string().datetime({ offset: true }),
  closed_at: z.string().datetime({ offset: true }).nullable(),
  closed_by: z.string().uuid().nullable(),
  orders: z.array(orderSchema).nullable(),
  comanda_payments: z.array(paymentSchema).nullable(),
})
const pageSchema = z.object({
  status: z.enum(["open", "closed"]),
  page: z.number().int().min(1).max(1_000_000),
})

type RawAddition = z.infer<typeof additionSchema>
type RawItem = z.infer<typeof itemSchema>
type RawOrder = z.infer<typeof orderSchema>
type RawPayment = z.infer<typeof paymentSchema>
type RawComanda = z.infer<typeof comandaSchema>

function safeCents(value: bigint) {
  if (value < BigInt(0) || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("panel_comanda_amount_overflow")
  return Number(value)
}

function sumCents(values: number[]) {
  return safeCents(values.reduce((total, value) => total + BigInt(value), BigInt(0)))
}

function toAddition(row: RawAddition): PanelComandaAdditionDTO {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
  }
}

function toItem(row: RawItem): PanelComandaItemDTO {
  const additions = [...(row.order_item_additions ?? [])]
    .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id))
    .map(toAddition)
  const additionTotal = safeCents(additions.reduce((total, addition) => total + BigInt(addition.quantity) * BigInt(addition.unitPriceCents), BigInt(0)))

  return {
    id: row.id,
    categoryName: row.category_name,
    itemName: row.item_name,
    variantName: row.variant_name,
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
    observations: row.observations,
    additions,
    totalCents: safeCents(BigInt(row.quantity) * (BigInt(row.unit_price_cents) + BigInt(additionTotal))),
  }
}

function toOrder(row: RawOrder): PanelComandaOrderDTO {
  const items = [...(row.order_items ?? [])]
    .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id))
    .map(toItem)

  return {
    id: row.id,
    createdAt: row.created_at,
    fulfillmentType: row.fulfillment_type,
    displayNumber: row.display_number,
    customerName: row.customer_name,
    items,
    totalCents: sumCents(items.map((item) => item.totalCents)),
  }
}

function toPayment(row: RawPayment): PanelComandaPaymentDTO {
  const splits = [...(row.comanda_payment_splits ?? [])]
    .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id))
    .map((split) => ({
      id: split.id,
      method: split.method === "custom" ? `custom:${split.custom_method_id}` : split.method,
      methodLabel: split.method_label_snapshot,
      methodKind: split.method_kind_snapshot,
      amountCents: split.amount_cents,
      cashReceivedCents: split.cash_received_cents,
      changeCents: split.change_cents,
    }))

  return {
    id: row.id,
    createdAt: row.created_at,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    amountCents: row.amount_cents,
    splits,
  }
}

function toComanda(row: RawComanda): PanelComandaDTO {
  const orders = [...(row.orders ?? [])]
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .map(toOrder)
  const payments = [...(row.comanda_payments ?? [])]
    .sort((left, right) => right.created_at.localeCompare(left.created_at) || right.id.localeCompare(left.id))
    .map(toPayment)
  const totalCents = sumCents(orders.map((order) => order.totalCents))
  const paidCents = sumCents(payments.map((payment) => payment.amountCents))

  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    tableNumber: row.table_number,
    status: row.status,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    closedBy: row.closed_by,
    orders,
    orderCount: orders.length,
    itemCount: orders.reduce((total, order) => total + order.items.reduce((count, item) => count + item.quantity, 0), 0),
    totalCents,
    payments,
    paidCents,
    balanceCents: Math.max(0, totalCents - paidCents),
  }
}

const COMANDA_SELECT = `
  id, restaurant_id, table_number, status, opened_at, closed_at, closed_by,
  orders (
    id, created_at, fulfillment_type, display_number, customer_name,
    order_items (
      id, category_name, item_name, variant_name, quantity,
      unit_price_cents, observations, position,
      order_item_additions (id, name, quantity, unit_price_cents, position)
    )
  ),
  comanda_payments (
    id, created_at, created_by, created_by_name, amount_cents,
    comanda_payment_splits (id, method, custom_method_id, method_label_snapshot, method_kind_snapshot, amount_cents, cash_received_cents, change_cents, position)
  )
`

export async function getPanelComandasPage(
  restaurant: PanelRestaurantDTO,
  queryInput: { status: "open" | "closed"; page: number },
): Promise<PanelComandasPage> {
  const parsedQuery = pageSchema.safeParse(queryInput)
  if (!parsedQuery.success) throw new Error("panel_comanda_query_invalid")
  const { status, page } = parsedQuery.data
  const supabase = await createSupabaseServerClient("panel")

  let request = supabase
    .from("comandas")
    .select(COMANDA_SELECT, { count: "exact" })
    .eq("restaurant_id", restaurant.id)
    .in("status", status === "closed" ? ["closed"] : ["open", "pending"])

  if (status === "closed") {
    const from = (page - 1) * CLOSED_COMANDA_PAGE_SIZE
    request = request
      .order("closed_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + CLOSED_COMANDA_PAGE_SIZE - 1)
  } else {
    request = request
      .order("table_number", { ascending: true, nullsFirst: false })
      .order("opened_at", { ascending: false })
      .order("id", { ascending: false })
  }

  const { data, error, count } = await request
  if (error || !data) {
    console.error("[panel-orders]", JSON.stringify({ stage: `${status}_comandas`, code: error?.code }))
    throw new Error("panel_comandas_unavailable")
  }

  const parsedRows = z.array(comandaSchema).safeParse(data)
  if (!parsedRows.success) {
    console.error("[panel-orders]", JSON.stringify({ stage: `${status}_comandas_response_invalid` }))
    throw new Error("panel_comandas_unavailable")
  }

  const totalRows = count ?? parsedRows.data.length
  const lastPage = Math.max(1, Math.ceil(totalRows / CLOSED_COMANDA_PAGE_SIZE))
  if (status === "closed" && page > lastPage) {
    return getPanelComandasPage(restaurant, { status, page: lastPage })
  }

  return {
    comandas: parsedRows.data.map(toComanda),
    page: status === "closed" ? page : 1,
    pageSize: status === "closed" ? CLOSED_COMANDA_PAGE_SIZE : Math.max(parsedRows.data.length, 1),
    totalRows,
  }
}
