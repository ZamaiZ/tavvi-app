"use server"

import { z } from "zod"

import type {
  AcceptPanelInviteResult,
  RestaurantNameAvailability,
} from "@/features/panel/invites/model"
import {
  acceptPlatformInvite,
  checkPlatformInviteEmail,
  checkPlatformInviteRestaurantName,
} from "@/features/panel/invites/server/redemption"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { setActivePanelRestaurantId } from "@/features/panel/workspace/server/active-restaurant-cookie"

const commonFields = {
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  restaurantName: z.string().trim().min(2).max(120),
  accepted: z.literal(true),
}

const submissionSchema = z.discriminatedUnion("mode", [
  z.object({
    ...commonFields,
    mode: z.literal("signup"),
    displayName: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
    password: z.string().min(8).max(128),
  }),
  z.object({
    ...commonFields,
    mode: z.literal("current"),
  }),
])

const restaurantNameAvailabilitySchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  restaurantName: z.string().trim().min(2).max(120),
})

export async function checkPanelInviteRestaurantNameAction(
  rawInput: unknown
): Promise<RestaurantNameAvailability> {
  const parsed = restaurantNameAvailabilitySchema.safeParse(rawInput)
  if (!parsed.success) return { status: "error" }

  return checkPlatformInviteRestaurantName(
    parsed.data.token,
    parsed.data.restaurantName
  )
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

export async function acceptPanelInviteAction(
  rawInput: unknown
): Promise<AcceptPanelInviteResult> {
  const parsed = submissionSchema.safeParse(rawInput)
  if (!parsed.success) return { ok: false, code: "invalid_input" }

  try {
    const input = parsed.data
    const supabase = await createSupabaseServerClient("panel")

    if (input.mode === "signup") {
      const allowed = await checkPlatformInviteEmail(input.token, input.email)
      if (!allowed) return { ok: false, code: "email_mismatch" }

      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: { data: { display_name: input.displayName } },
      })
      if (error) {
        return { ok: false, code: mapSignupError(error) }
      }
      if (!data.user || !data.session) {
        return { ok: false, code: "confirmation_required" }
      }
    }

    const result = await acceptPlatformInvite(
      input.token,
      input.restaurantName,
      supabase
    )
    if (!result.ok) return result

    await setActivePanelRestaurantId(result.restaurant.restaurantId)

    return { ok: true, restaurant: result.restaurant }
  } catch {
    return { ok: false, code: "service_unavailable" }
  }
}
