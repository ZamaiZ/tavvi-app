"use server"

import type {
  AcceptTeamInviteResult,
  TeamActionFailure,
} from "@/features/panel/team/model"
import {
  acceptTeamInviteSchema,
  createTeamInviteSchema,
  removeTeamMemberSchema,
  revokeTeamInviteSchema,
  updateTeamRoleSchema,
} from "@/features/panel/team/schema"
import {
  acceptTeamInvite,
  checkTeamInviteEmail,
} from "@/features/panel/team/server/redemption"
import {
  createPanelTeamInvite,
  removePanelTeamMember,
  revokePanelTeamInvite,
  updatePanelTeamMemberRole,
} from "@/features/panel/team/server/write"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { setActivePanelRestaurantId } from "@/features/panel/workspace/server/active-restaurant-cookie"

export async function createPanelTeamInviteAction(rawInput: unknown) {
  const parsed = createTeamInviteSchema.safeParse(rawInput)
  if (!parsed.success) return { ok: false as const, code: "invalid_input" as const }
  return createPanelTeamInvite(parsed.data)
}

export async function revokePanelTeamInviteAction(rawInput: unknown): Promise<TeamActionFailure | { ok: true }> {
  const parsed = revokeTeamInviteSchema.safeParse(rawInput)
  if (!parsed.success) return { ok: false, code: "invalid_input" }
  return revokePanelTeamInvite(parsed.data.inviteId)
}

export async function updatePanelTeamMemberRoleAction(rawInput: unknown): Promise<TeamActionFailure | { ok: true }> {
  const parsed = updateTeamRoleSchema.safeParse(rawInput)
  if (!parsed.success) return { ok: false, code: "invalid_input" }
  return updatePanelTeamMemberRole(parsed.data)
}

export async function removePanelTeamMemberAction(rawInput: unknown): Promise<TeamActionFailure | { ok: true }> {
  const parsed = removeTeamMemberSchema.safeParse(rawInput)
  if (!parsed.success) return { ok: false, code: "invalid_input" }
  return removePanelTeamMember(parsed.data.membershipId)
}

function mapSignupError(error: { code?: string; message: string }) {
  const code = error.code?.toLowerCase() ?? ""
  const message = error.message.toLowerCase()
  if (code.includes("rate") || message.includes("rate limit") || message.includes("too many")) {
    return "rate_limited" as const
  }
  if (
    code.includes("user_already_exists") ||
    message.includes("already registered") ||
    message.includes("already been registered")
  ) {
    return "account_exists" as const
  }
  return "service_unavailable" as const
}

export async function acceptPanelTeamInviteAction(
  rawInput: unknown,
): Promise<AcceptTeamInviteResult> {
  const parsed = acceptTeamInviteSchema.safeParse(rawInput)
  if (!parsed.success) return { ok: false, code: "invalid_input" }

  try {
    const input = parsed.data
    const supabase = await createSupabaseServerClient("panel")

    if (input.mode === "signup") {
      const allowed = await checkTeamInviteEmail(input.token, input.email)
      if (!allowed) return { ok: false, code: "email_mismatch" }

      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: { data: { display_name: input.displayName } },
      })
      if (error) return { ok: false, code: mapSignupError(error) }
      if (!data.user || !data.session) {
        return { ok: false, code: "confirmation_required" }
      }
    }

    const result = await acceptTeamInvite(input.token, supabase)
    if (!result.ok) return result

    await setActivePanelRestaurantId(result.restaurant.restaurantId)
    return { ok: true, restaurant: result.restaurant }
  } catch {
    return { ok: false, code: "service_unavailable" }
  }
}
