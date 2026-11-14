import "server-only"

import { z } from "zod"

import type { TeamListQuery, TeamListResult } from "@/features/panel/team/model"
import { TEAM_ROLES } from "@/features/panel/team/model"
import { getActivePanelRestaurantId } from "@/features/panel/workspace/server/active-restaurant-cookie"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const teamPageResponseSchema = z.object({
  rows: z.array(z.object({
    id: z.string().uuid(),
    userId: z.string().uuid().nullable(),
    kind: z.enum(["member", "invite"]),
    name: z.string().min(1).max(254),
    email: z.string().max(254),
    role: z.enum(TEAM_ROLES),
    status: z.enum(["active", "pending"]),
    createdAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }).nullable(),
  })),
  totalRows: z.number().int().nonnegative(),
  activeCount: z.number().int().nonnegative(),
  pendingCount: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  actorId: z.string().uuid(),
  actorRole: z.enum(TEAM_ROLES),
})

export async function getPanelTeamPage(query: TeamListQuery): Promise<TeamListResult> {
  const restaurantId = await getActivePanelRestaurantId()
  if (!restaurantId) throw new Error("panel_restaurant_context_required")

  const supabase = await createSupabaseServerClient("panel")
  const { data, error } = await supabase.rpc("list_panel_team", {
    p_restaurant_id: restaurantId,
    p_search: query.search,
    p_status: query.status,
    p_page: query.page,
    p_page_size: query.pageSize,
  })

  if (error) {
    console.error("[panel-team]", JSON.stringify({ stage: "list", code: error.code }))
    throw new Error(error.code === "42501" ? "panel_team_forbidden" : "panel_team_unavailable")
  }

  const parsed = teamPageResponseSchema.safeParse(data)
  if (!parsed.success) {
    console.error("[panel-team]", JSON.stringify({ stage: "list_response_invalid" }))
    throw new Error("panel_team_unavailable")
  }

  return { ...query, ...parsed.data }
}
