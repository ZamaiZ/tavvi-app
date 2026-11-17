import type { PanelPaymentMethod } from "@/features/panel/payments/model"

export type OrderAdditionInput = {
  name: string
  quantity: number
  unitPriceCents: number
}

export type OrderItemInput = {
  menuItemId: string
  variantId: string | null
  quantity: number
  observations: string
  additions: OrderAdditionInput[]
}

export type OrderDraftLine = OrderItemInput & {
  lineId: string
  categoryId: string
  categoryName: string
  itemName: string
  mediaUrl: string | null
  mediaAlt: string
  variantName: string | null
  unitPriceCents: number
}

export type RecordPanelOrderInput = {
  expectedRestaurantId: string
  callId: string | null
  requestId: string
  fulfillmentType: "dine_in" | "takeaway"
  tableNumber: number | null
  customerName: string | null
  items: OrderItemInput[]
}

export type RecordPanelOrderResult = {
  orderId: string
  comandaId: string
  totalCents: number
  displayNumber: number | null
}

export type PanelOrderFailureCode =
  | "invalid_input"
  | "session_expired"
  | "context_changed"
  | "unavailable"
  | "database_error"
  | "forbidden"
  | "not_assignee"
  | "call_not_found"
  | "call_conflict"
  | "request_conflict"
  | "item_not_available"
  | "variant_required"
  | "variant_not_available"

export type PanelOrderActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: PanelOrderFailureCode }

export type PanelComandaAdditionDTO = {
  id: string
  name: string
  quantity: number
  unitPriceCents: number
}

export type PanelComandaItemDTO = {
  id: string
  categoryName: string
  itemName: string
  variantName: string | null
  quantity: number
  unitPriceCents: number
  observations: string
  additions: PanelComandaAdditionDTO[]
  totalCents: number
}

export type PanelComandaOrderDTO = {
  id: string
  createdAt: string
  fulfillmentType: "dine_in" | "takeaway"
  displayNumber: number | null
  customerName: string | null
  items: PanelComandaItemDTO[]
  totalCents: number
}

export type PanelComandaPaymentSplitDTO = {
  id: string
  method: PanelPaymentMethod
  amountCents: number
}

export type PanelComandaPaymentDTO = {
  id: string
  createdAt: string
  createdBy: string
  createdByName: string
  amountCents: number
  splits: PanelComandaPaymentSplitDTO[]
}

export type PanelComandaDTO = {
  id: string
  restaurantId: string
  tableNumber: number | null
  status: "open" | "closed"
  openedAt: string
  closedAt: string | null
  closedBy: string | null
  orders: PanelComandaOrderDTO[]
  orderCount: number
  itemCount: number
  totalCents: number
  payments: PanelComandaPaymentDTO[]
  paidCents: number
  balanceCents: number
}

export type PanelComandasPage = {
  comandas: PanelComandaDTO[]
  page: number
  pageSize: number
  totalRows: number
}

export type PanelPaymentFailureCode =
  | "invalid_input"
  | "session_expired"
  | "context_changed"
  | "unavailable"
  | "database_error"
  | "forbidden"
  | "comanda_not_found"
  | "comanda_conflict"
  | "request_conflict"
  | "payment_method_disabled"
  | "balance_already_paid"
  | "payment_exceeds_balance"
  | "close_requires_full_payment"
  | "balance_remaining"

export type RecordPanelComandaPaymentResult = {
  paymentId: string
  closed: boolean
  paidCents: number
  balanceCents: number
}

export type PanelPaymentActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: PanelPaymentFailureCode }

