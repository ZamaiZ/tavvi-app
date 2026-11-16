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
  callId: string
  requestId: string
  items: OrderItemInput[]
}

export type RecordPanelOrderResult = {
  orderId: string
  comandaId: string
  totalCents: number
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
  items: PanelComandaItemDTO[]
  totalCents: number
}

export type PanelComandaDTO = {
  id: string
  restaurantId: string
  tableNumber: number
  status: "open"
  openedAt: string
  orders: PanelComandaOrderDTO[]
  orderCount: number
  itemCount: number
  totalCents: number
}
