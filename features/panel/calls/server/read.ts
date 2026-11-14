import "server-only"

import type { PanelRestaurantDTO } from "@/features/panel/onboarding/model"
import { createSupabaseServerClient } from "@/lib/supabase/server"

import type { PanelResolvedCallsPage, PanelServiceCallCursor, PanelServiceCallDTO } from "../model"

const RESOLVED_CALLS_PAGE_SIZE = 25

type RawServiceCall = {
  id: string
  restaurant_id: string
  tag_id: string
  table_number: number
  status: "pending" | "in_progress" | "resolved"
  created_at: string
  claimed_at: string | null
  claimed_by: string | null
  resolved_at: string | null
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
    resolvedAt: row.resolved_at,
  }
}

export async function getPanelServiceCalls(restaurant: PanelRestaurantDTO): Promise<PanelServiceCallDTO[]> {
  const supabase = await createSupabaseServerClient("panel")
  const { data, error } = await supabase
    .from("service_calls")
    .select("id,restaurant_id,tag_id,table_number,status,created_at,claimed_at,claimed_by,resolved_at")
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

export async function getPanelResolvedServiceCallsPage(
  restaurantId: string,
  cursor: PanelServiceCallCursor | null,
): Promise<PanelResolvedCallsPage> {
  const supabase = await createSupabaseServerClient("panel")
  let query = supabase
    .from("service_calls")
    .select("id,restaurant_id,tag_id,table_number,status,created_at,claimed_at,claimed_by,resolved_at")
    .eq("restaurant_id", restaurantId)
    .eq("status", "resolved")

  if (cursor) {
    // Keep PostgreSQL's sub-millisecond precision so equal timestamps page without gaps.
    const resolvedAt = cursor.resolvedAt
    query = query.or(`resolved_at.lt.${resolvedAt},and(resolved_at.eq.${resolvedAt},id.lt.${cursor.id})`)
  }

  const { data, error } = await query
    .order("resolved_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(RESOLVED_CALLS_PAGE_SIZE + 1)

  if (error || !data) {
    console.error("[panel-service-calls]", JSON.stringify({ stage: "resolved_list", code: error?.code }))
    throw new Error("panel_service_calls_unavailable")
  }

  const rows = (data as unknown as RawServiceCall[]).slice(0, RESOLVED_CALLS_PAGE_SIZE)
  const calls = rows.map(toServiceCall)
  const last = rows.at(-1)
  return {
    calls,
    nextCursor: data.length > RESOLVED_CALLS_PAGE_SIZE && last?.resolved_at
      ? { resolvedAt: last.resolved_at, id: last.id }
      : null,
  }
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

export async function getPanelResolvedServiceCallsCount(restaurantId: string): Promise<number> {
  const supabase = await createSupabaseServerClient("panel")
  const { count, error } = await supabase
    .from("service_calls")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("status", "resolved")

  if (error || count === null) {
    console.error("[panel-service-calls]", JSON.stringify({ stage: "resolved_count", code: error?.code }))
    throw new Error("panel_service_calls_unavailable")
  }

  return count
}
