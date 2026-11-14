import "server-only"

import type { PanelRestaurantDTO } from "@/features/panel/onboarding/model"
import { createSupabaseServerClient } from "@/lib/supabase/server"

import type { PanelServiceCallDTO } from "../model"

type RawServiceCall = {
  id: string
  restaurant_id: string
  tag_id: string
  table_number: number
  status: "pending" | "in_progress"
  created_at: string
  claimed_at: string | null
  claimed_by: string | null
}

function toServiceCall(row: RawServiceCall): PanelServiceCallDTO {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    tagId: row.tag_id,
    tableNumber: row.table_number,
    status: row.status,
    createdAt: row.created_at,
    claimedAt: row.claimed_at,
    claimedBy: row.claimed_by,
  }
}

export async function getPanelServiceCalls(restaurant: PanelRestaurantDTO): Promise<PanelServiceCallDTO[]> {
  const supabase = await createSupabaseServerClient("panel")
  const { data, error } = await supabase
    .from("service_calls")
    .select("id,restaurant_id,tag_id,table_number,status,created_at,claimed_at,claimed_by")
    .eq("restaurant_id", restaurant.id)
    .in("status", ["pending", "in_progress"])
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })

  if (error || !data) {
    console.error("[panel-service-calls]", JSON.stringify({ stage: "list", code: error?.code }))
    throw new Error("panel_service_calls_unavailable")
  }

  return (data as unknown as RawServiceCall[]).map(toServiceCall)
}

export async function getPanelPendingServiceCallsCount(restaurantId: string): Promise<number> {
  const supabase = await createSupabaseServerClient("panel")
  const { count, error } = await supabase
    .from("service_calls")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("status", "pending")

  if (error || count === null) {
    console.error("[panel-service-calls]", JSON.stringify({ stage: "pending_count", code: error?.code }))
    throw new Error("panel_service_calls_unavailable")
  }

  return count
}
