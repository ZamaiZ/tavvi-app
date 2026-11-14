import "server-only"

import { z } from "zod"

import type { TeamActionFailure, TeamRole } from "@/features/panel/team/model"
import { createPanelInviteUrl } from "@/lib/routing/panel"
import { getActivePanelRestaurantId } from "@/features/panel/workspace/server/active-restaurant-cookie"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createTeamInviteToken } from "./token"

const createResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    inviteId: z.string().uuid(),
    expiresAt: z.string().datetime({ offset: true }),
  }),
  z.object({ ok: z.literal(false), code: z.literal("already_member") }),
])

const mutationResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true) }),
  z.object({
    ok: z.literal(false),
    code: z.enum([
      "unavailable",
      "member_unavailable",
      "self_role_change_blocked",
      "self_removal_blocked",
      "last_admin",
    ]),
  }),
])

function errorFromRpc(error: { code?: string }): TeamActionFailure["code"] {
  if (error.code === "28000") return "unauthorized"
  if (error.code === "42501") return "forbidden"
  if (error.code === "22023") return "invalid_input"
  return "service_unavailable"
}

export async function createPanelTeamInvite(input: {
  email: string
  role: TeamRole
}) {
  const restaurantId = await getActivePanelRestaurantId()
  if (!restaurantId) return { ok: false as const, code: "unavailable" as const }

  let link: string
  try {
    const generated = createTeamInviteToken()
    link = createPanelInviteUrl(generated.token)

    const supabase = await createSupabaseServerClient("panel")
    const { data, error } = await supabase.rpc("create_panel_team_invite", {
      p_restaurant_id: restaurantId,
      p_email: input.email,
      p_role: input.role,
      p_token_hash_hex: generated.tokenHashHex,
      p_valid_days: 7,
    })

    if (error) return { ok: false as const, code: errorFromRpc(error) }
    const parsed = createResponseSchema.safeParse(data)
    if (!parsed.success) return { ok: false as const, code: "service_unavailable" as const }
    if (!parsed.data.ok) return { ok: false as const, code: parsed.data.code }

    return {
      ok: true as const,
      inviteId: parsed.data.inviteId,
      email: input.email,
      role: input.role,
      expiresAt: parsed.data.expiresAt,
      link,
    }
  } catch {
    return { ok: false as const, code: "service_unavailable" as const }
  }
}

export async function revokePanelTeamInvite(inviteId: string): Promise<TeamActionFailure | { ok: true }> {
  const restaurantId = await getActivePanelRestaurantId()
  if (!restaurantId) return { ok: false, code: "unavailable" }

  const supabase = await createSupabaseServerClient("panel")
  const { data, error } = await supabase.rpc("revoke_panel_team_invite", {
    p_restaurant_id: restaurantId,
    p_invite_id: inviteId,
  })
  if (error) return { ok: false, code: errorFromRpc(error) }

  const parsed = mutationResponseSchema.safeParse(data)
  if (!parsed.success) return { ok: false, code: "service_unavailable" }
  if (!parsed.data.ok) return { ok: false, code: parsed.data.code }
  return { ok: true }
}

export async function updatePanelTeamMemberRole(input: {
  membershipId: string
  role: TeamRole
}): Promise<TeamActionFailure | { ok: true }> {
  const restaurantId = await getActivePanelRestaurantId()
  if (!restaurantId) return { ok: false, code: "unavailable" }

  const supabase = await createSupabaseServerClient("panel")
  const { data, error } = await supabase.rpc("update_panel_team_member_role", {
    p_restaurant_id: restaurantId,
    p_membership_id: input.membershipId,
    p_role: input.role,
  })
  if (error) return { ok: false, code: errorFromRpc(error) }

  const parsed = mutationResponseSchema.safeParse(data)
  if (!parsed.success) return { ok: false, code: "service_unavailable" }
  if (!parsed.data.ok) return { ok: false, code: parsed.data.code }
  return { ok: true }
}

export async function removePanelTeamMember(membershipId: string): Promise<TeamActionFailure | { ok: true }> {
  const restaurantId = await getActivePanelRestaurantId()
  if (!restaurantId) return { ok: false, code: "unavailable" }

  const supabase = await createSupabaseServerClient("panel")
  const { data, error } = await supabase.rpc("remove_panel_team_member", {
    p_restaurant_id: restaurantId,
    p_membership_id: membershipId,
  })
  if (error) return { ok: false, code: errorFromRpc(error) }

  const parsed = mutationResponseSchema.safeParse(data)
  if (!parsed.success) return { ok: false, code: "service_unavailable" }
  if (!parsed.data.ok) return { ok: false, code: parsed.data.code }
  return { ok: true }
}
