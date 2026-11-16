import "server-only"

import type { PanelRestaurantDTO } from "@/features/panel/onboarding/model"
import { createSupabaseServerClient } from "@/lib/supabase/server"

import type {
  PanelComandaAdditionDTO,
  PanelComandaDTO,
  PanelComandaItemDTO,
  PanelComandaOrderDTO,
} from "../model"

type RawAddition = {
  id: string
  name: string
  quantity: number
  unit_price_cents: number
  position: number
}

type RawItem = {
  id: string
  category_name: string
  item_name: string
  variant_name: string | null
  quantity: number
  unit_price_cents: number
  observations: string
  position: number
  order_item_additions: RawAddition[] | null
}

type RawOrder = {
  id: string
  created_at: string
  order_items: RawItem[] | null
}

type RawComanda = {
  id: string
  restaurant_id: string
  table_number: number
  status: "open"
  opened_at: string
  orders: RawOrder[] | null
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
  const additionTotal = additions.reduce((total, addition) => total + addition.quantity * addition.unitPriceCents, 0)

  return {
    id: row.id,
    categoryName: row.category_name,
    itemName: row.item_name,
    variantName: row.variant_name,
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
    observations: row.observations,
    additions,
    totalCents: row.quantity * (row.unit_price_cents + additionTotal),
  }
}

function toOrder(row: RawOrder): PanelComandaOrderDTO {
  const items = [...(row.order_items ?? [])]
    .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id))
    .map(toItem)

  return {
    id: row.id,
    createdAt: row.created_at,
    items,
    totalCents: items.reduce((total, item) => total + item.totalCents, 0),
  }
}

export async function getPanelOpenComandas(restaurant: PanelRestaurantDTO): Promise<PanelComandaDTO[]> {
  const supabase = await createSupabaseServerClient("panel")
  const { data, error } = await supabase
    .from("comandas")
    .select(`
      id, restaurant_id, table_number, status, opened_at,
      orders (
        id, created_at,
        order_items (
          id, category_name, item_name, variant_name, quantity,
          unit_price_cents, observations, position,
          order_item_additions (id, name, quantity, unit_price_cents, position)
        )
      )
    `)
    .eq("restaurant_id", restaurant.id)
    .eq("status", "open")
    .order("table_number", { ascending: true })

  if (error || !data) {
    console.error("[panel-orders]", JSON.stringify({ stage: "open_comandas", code: error?.code }))
    throw new Error("panel_open_comandas_unavailable")
  }

  return (data as unknown as RawComanda[]).map((row) => {
    const orders = [...(row.orders ?? [])]
      .sort((left, right) => right.created_at.localeCompare(left.created_at))
      .map(toOrder)
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      tableNumber: row.table_number,
      status: row.status,
      openedAt: row.opened_at,
      orders,
      orderCount: orders.length,
      itemCount: orders.reduce((total, order) => total + order.items.reduce((count, item) => count + item.quantity, 0), 0),
      totalCents: orders.reduce((total, order) => total + order.totalCents, 0),
    }
  })
}
