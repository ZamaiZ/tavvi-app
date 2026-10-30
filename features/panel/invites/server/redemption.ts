import "server-only"

import { z } from "zod"

import type {
  AcceptedRestaurant,
  PanelInvitePreview,
  RestaurantNameAvailability,
} from "@/features/panel/invites/model"
import { hashPlatformInviteToken } from "@/features/admin/invites/server/token"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const inviteTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/)
type PanelSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

const previewResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    expiresAt: z.string().min(1),
    emailRequired: z.boolean(),
  }),
  z.object({ ok: z.literal(false), code: z.literal("unavailable") }),
])

const acceptedRestaurantSchema = z.object({
  restaurantId: z.string().uuid(),
  restaurantName: z.string().min(2).max(120),
  restaurantSlug: z.string().min(1).max(89),
  restaurantStatus: z.enum(["draft", "active", "suspended"]),
  alreadyAccepted: z.boolean(),
}) satisfies z.ZodType<AcceptedRestaurant>

const restaurantAvailabilityResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    available: z.boolean(),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
    nameAvailable: z.boolean(),
    slugAvailable: z.boolean(),
  }),
  z.object({
    ok: z.literal(false),
    code: z.enum(["invalid_input", "unavailable", "rate_limited"]),
  }),
])

const acceptResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    alreadyAccepted: z.boolean(),
    restaurantId: z.string().uuid(),
    restaurantName: z.string().min(2).max(120),
    restaurantSlug: z.string().min(1).max(89),
    restaurantStatus: z.enum(["draft", "active", "suspended"]),
  }),
  z.object({
    ok: z.literal(false),
    code: z.enum([
      "unavailable",
      "rate_limited",
      "email_mismatch",
      "slug_unavailable",
    ]),
  }),
])

export async function previewPlatformInvite(
  token: string | null | undefined
): Promise<PanelInvitePreview> {
  const parsedToken = inviteTokenSchema.safeParse(token)
  if (!parsedToken.success) return { status: "unavailable" }

  try {
    const supabase = await createSupabaseServerClient("panel")
    const { data, error } = await supabase.rpc("preview_platform_invite", {
      p_token_hash_hex: hashPlatformInviteToken(parsedToken.data),
    })
    if (error) return { status: "service-unavailable" }

    const parsedResponse = previewResponseSchema.safeParse(data)
    if (!parsedResponse.success || !parsedResponse.data.ok) {
      return { status: "unavailable" }
    }

    return {
      status: "available",
      expiresAt: parsedResponse.data.expiresAt,
      emailRequired: parsedResponse.data.emailRequired,
    }
  } catch {
    return { status: "service-unavailable" }
  }
}

export async function checkPlatformInviteEmail(
  token: string,
  email: string
): Promise<boolean> {
  const parsedToken = inviteTokenSchema.safeParse(token)
  if (!parsedToken.success) return false

  const supabase = await createSupabaseServerClient("panel")
  const { data, error } = await supabase.rpc("check_platform_invite_email", {
    p_token_hash_hex: hashPlatformInviteToken(parsedToken.data),
    p_email: email.trim().toLowerCase(),
  })

  if (error || typeof data !== "boolean") {
    throw new Error("invite_email_check_unavailable")
  }

  return data
}

export async function checkPlatformInviteRestaurantName(
  token: string,
  restaurantName: string
): Promise<RestaurantNameAvailability> {
  const parsedToken = inviteTokenSchema.safeParse(token)
  const parsedName = z.string().trim().min(2).max(120).safeParse(restaurantName)
  if (!parsedToken.success || !parsedName.success) return { status: "error" }

  try {
    const supabase = await createSupabaseServerClient("panel")
    const { data, error } = await supabase.rpc("check_platform_invite_restaurant_name", {
      p_token_hash_hex: hashPlatformInviteToken(parsedToken.data),
      p_restaurant_name: parsedName.data,
    })
    if (error) return { status: "error" }

    const parsedResponse = restaurantAvailabilityResponseSchema.safeParse(data)
    if (!parsedResponse.success || !parsedResponse.data.ok) return { status: "error" }

    if (parsedResponse.data.available) {
      return { status: "available", slug: parsedResponse.data.slug }
    }

    return {
      status: "unavailable",
      slug: parsedResponse.data.slug,
      nameAvailable: parsedResponse.data.nameAvailable,
      slugAvailable: parsedResponse.data.slugAvailable,
    }
  } catch {
    return { status: "error" }
  }
}

export async function acceptPlatformInvite(
  token: string,
  restaurantName: string,
  authenticatedClient?: PanelSupabaseClient
): Promise<
  | { ok: true; restaurant: AcceptedRestaurant }
  | { ok: false; code: "email_mismatch" | "rate_limited" | "unavailable" | "slug_unavailable" }
> {
  const parsedToken = inviteTokenSchema.safeParse(token)
  if (!parsedToken.success) return { ok: false, code: "unavailable" }

  const supabase =
    authenticatedClient ?? (await createSupabaseServerClient("panel"))
  const { data, error } = await supabase.rpc("accept_platform_invite", {
    p_token_hash_hex: hashPlatformInviteToken(parsedToken.data),
    p_restaurant_name: restaurantName.trim(),
  })

  if (error) {
    if (error.code === "28000" || error.code === "42501") {
      return { ok: false, code: "unavailable" }
    }
    if (error.code === "22023") {
      return { ok: false, code: "unavailable" }
    }
    throw new Error("invite_accept_unavailable")
  }

  const parsedResponse = acceptResponseSchema.safeParse(data)
  if (!parsedResponse.success) {
    throw new Error("invite_accept_unavailable")
  }
  if (!parsedResponse.data.ok) {
    return { ok: false, code: parsedResponse.data.code }
  }

  const restaurant = acceptedRestaurantSchema.safeParse({
    restaurantId: parsedResponse.data.restaurantId,
    restaurantName: parsedResponse.data.restaurantName,
    restaurantSlug: parsedResponse.data.restaurantSlug,
    restaurantStatus: parsedResponse.data.restaurantStatus,
    alreadyAccepted: parsedResponse.data.alreadyAccepted,
  })
  if (!restaurant.success) throw new Error("invite_accept_unavailable")

  return { ok: true, restaurant: restaurant.data }
}
