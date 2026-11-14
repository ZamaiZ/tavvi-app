import "server-only"

import { z } from "zod"

import type {
  AcceptedTeamRestaurant,
  TeamInvitePreview,
} from "@/features/panel/team/model"
import { TEAM_ROLES } from "@/features/panel/team/model"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { hashTeamInviteToken } from "./token"

const inviteTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/)
export type PanelTeamSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

const previewResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    email: z.string().email().max(254),
    role: z.enum(TEAM_ROLES),
    restaurantName: z.string().min(1).max(120),
    expiresAt: z.string().datetime({ offset: true }),
  }),
  z.object({ ok: z.literal(false), code: z.literal("unavailable") }),
])

const acceptResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    alreadyAccepted: z.boolean(),
    restaurantId: z.string().uuid(),
    restaurantName: z.string().min(1).max(120),
    restaurantSlug: z.string().min(1).max(89),
    restaurantStatus: z.enum(["draft", "active", "suspended"]),
  }),
  z.object({
    ok: z.literal(false),
    code: z.enum(["unavailable", "email_mismatch", "already_member"]),
  }),
])

export async function previewTeamInvite(
  token: string | null | undefined,
): Promise<TeamInvitePreview> {
  const parsedToken = inviteTokenSchema.safeParse(token)
  if (!parsedToken.success) return { status: "unavailable" }

  try {
    const supabase = await createSupabaseServerClient("panel")
    const { data, error } = await supabase.rpc("preview_team_invite", {
      p_token_hash_hex: hashTeamInviteToken(parsedToken.data),
    })
    if (error) return { status: "service-unavailable" }

    const parsed = previewResponseSchema.safeParse(data)
    if (!parsed.success || !parsed.data.ok) return { status: "unavailable" }
    return {
      status: "available",
      email: parsed.data.email,
      role: parsed.data.role,
      restaurantName: parsed.data.restaurantName,
      expiresAt: parsed.data.expiresAt,
    }
  } catch {
    return { status: "service-unavailable" }
  }
}

export async function checkTeamInviteEmail(token: string, email: string) {
  const parsedToken = inviteTokenSchema.safeParse(token)
  if (!parsedToken.success) return false

  const supabase = await createSupabaseServerClient("panel")
  const { data, error } = await supabase.rpc("check_team_invite_email", {
    p_token_hash_hex: hashTeamInviteToken(parsedToken.data),
    p_email: email.trim().toLowerCase(),
  })
  return !error && data === true
}

export async function acceptTeamInvite(
  token: string,
  authenticatedClient?: PanelTeamSupabaseClient,
): Promise<
  | { ok: true; restaurant: AcceptedTeamRestaurant }
  | { ok: false; code: "email_mismatch" | "already_member" | "unavailable" }
> {
  const parsedToken = inviteTokenSchema.safeParse(token)
  if (!parsedToken.success) return { ok: false, code: "unavailable" }

  const supabase = authenticatedClient ?? (await createSupabaseServerClient("panel"))
  const { data, error } = await supabase.rpc("accept_team_invite", {
    p_token_hash_hex: hashTeamInviteToken(parsedToken.data),
  })

  if (error) {
    if (error.code === "28000" || error.code === "42501" || error.code === "22023") {
      return { ok: false, code: "unavailable" }
    }
    throw new Error("team_invite_accept_unavailable")
  }

  const parsed = acceptResponseSchema.safeParse(data)
  if (!parsed.success) throw new Error("team_invite_accept_unavailable")
  if (!parsed.data.ok) return { ok: false, code: parsed.data.code }

  return {
    ok: true,
    restaurant: {
      restaurantId: parsed.data.restaurantId,
      restaurantName: parsed.data.restaurantName,
      restaurantSlug: parsed.data.restaurantSlug,
      restaurantStatus: parsed.data.restaurantStatus,
      alreadyAccepted: parsed.data.alreadyAccepted,
    },
  }
}
