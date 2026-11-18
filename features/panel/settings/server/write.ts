import "server-only"

import { z } from "zod"

import { PANEL_PAYMENT_METHOD_VALUES, type PanelCustomPaymentMethodDTO, type PanelPaymentMethod, type PanelTipPolicy } from "@/features/panel/payments/model"
import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import { createSupabaseServerClient } from "@/lib/supabase/server"

import type { PaymentSettingsFailureCode, PaymentSettingsResult } from "../model"

const responseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    enabledMethods: z.array(z.enum(PANEL_PAYMENT_METHOD_VALUES)).max(PANEL_PAYMENT_METHOD_VALUES.length),
    customMethods: z.array(z.object({
      id: z.string().uuid(),
      label: z.string().min(2).max(40),
      kind: z.enum(["cash", "electronic"]),
      isActive: z.boolean(),
    })),
    tipPolicy: z.discriminatedUnion("mode", [
      z.object({ mode: z.literal("disabled") }),
      z.object({ mode: z.literal("percentage"), percentageBps: z.number().int().min(1).max(10000) }),
      z.object({ mode: z.literal("fixed"), fixedCents: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER) }),
    ]),
  }),
  z.object({
    ok: z.literal(false),
    code: z.enum(["session_expired", "forbidden", "invalid_input", "not_found", "duplicate_method"]),
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
  customMethods: Array<{ id: string | null; label: string; kind: "cash" | "electronic"; isActive: boolean }>
  tipPolicy: PanelTipPolicy
}): Promise<PaymentSettingsResult> {
  try {
    const restaurant = await getActivePanelRestaurant(input.expectedRestaurantId)
    if (!restaurant || restaurant.status !== "active") return failure("context_changed")
    const supabase = await createSupabaseServerClient("panel")
    const { data, error } = await supabase.rpc("update_panel_financial_settings_v2", {
      p_restaurant_id: restaurant.id,
      p_enabled_methods: input.enabledMethods,
      p_custom_methods: input.customMethods,
      p_tip_mode: input.tipPolicy.mode,
      p_tip_percentage_bps: input.tipPolicy.mode === "percentage" ? input.tipPolicy.percentageBps : null,
      p_tip_fixed_cents: input.tipPolicy.mode === "fixed" ? input.tipPolicy.fixedCents : null,
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
      if (parsed.data.code === "duplicate_method") return failure("duplicate_method")
      return failure("context_changed")
    }

    const enabledMethods = parsed.data.enabledMethods
    if (enabledMethods.length !== input.enabledMethods.length
      || enabledMethods.some((method, index) => method !== input.enabledMethods[index])
      || JSON.stringify(parsed.data.tipPolicy) !== JSON.stringify(input.tipPolicy)) {
      return failure("database_error")
    }
    const customMethods: PanelCustomPaymentMethodDTO[] = parsed.data.customMethods
    return { ok: true, enabledMethods, customMethods, tipPolicy: parsed.data.tipPolicy }
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
