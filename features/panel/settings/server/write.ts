import "server-only"

import { z } from "zod"

import { PANEL_PAYMENT_METHOD_VALUES, type PanelPaymentMethod } from "@/features/panel/payments/model"
import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import { createSupabaseServerClient } from "@/lib/supabase/server"

import type { PaymentSettingsFailureCode, PaymentSettingsResult } from "../model"

const responseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    enabledMethods: z.array(z.enum(PANEL_PAYMENT_METHOD_VALUES)).min(1).max(PANEL_PAYMENT_METHOD_VALUES.length),
  }),
  z.object({
    ok: z.literal(false),
    code: z.enum(["session_expired", "forbidden", "invalid_input", "not_found"]),
  }),
]).refine(
  (response) => !response.ok || new Set(response.enabledMethods).size === response.enabledMethods.length,
)

function failure(code: PaymentSettingsFailureCode): PaymentSettingsResult {
  return { ok: false, code }
}

export async function savePanelPaymentMethods(input: {
  expectedRestaurantId: string
  enabledMethods: PanelPaymentMethod[]
}): Promise<PaymentSettingsResult> {
  try {
    const restaurant = await getActivePanelRestaurant(input.expectedRestaurantId)
    if (!restaurant || restaurant.status !== "active") return failure("context_changed")
    const supabase = await createSupabaseServerClient("panel")
    const { data, error } = await supabase.rpc("update_panel_payment_methods", {
      p_restaurant_id: restaurant.id,
      p_enabled_methods: input.enabledMethods,
    })
    if (error) {
      console.error("[panel-settings]", JSON.stringify({ stage: "payment_methods_write", code: error.code }))
      return failure(error.code === "42501" ? "forbidden" : "unavailable")
    }

    const parsed = responseSchema.safeParse(data)
    if (!parsed.success) {
      console.error("[panel-settings]", JSON.stringify({ stage: "payment_methods_response_invalid" }))
      return failure("database_error")
    }
    if (!parsed.data.ok) {
      if (parsed.data.code === "session_expired") return failure("session_expired")
      if (parsed.data.code === "forbidden") return failure("forbidden")
      if (parsed.data.code === "invalid_input") return failure("invalid_input")
      return failure("context_changed")
    }

    const enabledMethods = parsed.data.enabledMethods
    if (enabledMethods.length !== input.enabledMethods.length
      || enabledMethods.some((method, index) => method !== input.enabledMethods[index])) {
      return failure("database_error")
    }
    return { ok: true, enabledMethods }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : ""
    if (message === "panel_auth_required") return failure("session_expired")
    if (message === "panel_restaurant_context_changed" || message === "panel_restaurant_not_found") {
      return failure("context_changed")
    }
    console.error("[panel-settings]", JSON.stringify({ stage: "payment_methods_context", code: "unavailable" }))
    return failure("unavailable")
  }
}
