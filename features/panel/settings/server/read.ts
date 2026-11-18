import "server-only"

import { z } from "zod"

import { PANEL_PAYMENT_METHOD_VALUES, type PanelPaymentConfiguration } from "@/features/panel/payments/model"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const paymentMethodsResponseSchema = z.object({
  enabled_payment_methods: z.array(z.enum(PANEL_PAYMENT_METHOD_VALUES)).max(PANEL_PAYMENT_METHOD_VALUES.length),
  tip_mode: z.enum(["disabled", "percentage", "fixed"]),
  tip_percentage_bps: z.number().int().positive().max(10000).nullable(),
  tip_fixed_cents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
}).refine(
  (response) => new Set(response.enabled_payment_methods).size === response.enabled_payment_methods.length
    && (response.tip_mode === "disabled"
      ? response.tip_percentage_bps === null && response.tip_fixed_cents === null
      : response.tip_mode === "percentage"
        ? response.tip_percentage_bps !== null && response.tip_fixed_cents === null
        : response.tip_percentage_bps === null && response.tip_fixed_cents !== null),
)

const customPaymentMethodResponseSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(2).max(40),
  kind: z.enum(["cash", "electronic"]),
  is_active: z.boolean(),
})

export async function getPanelPaymentMethods(restaurantId: string): Promise<PanelPaymentConfiguration> {
  const supabase = await createSupabaseServerClient("panel")
  const [{ data, error }, customResult] = await Promise.all([
    supabase
    .from("restaurants")
    .select("enabled_payment_methods, tip_mode, tip_percentage_bps, tip_fixed_cents")
    .eq("id", restaurantId)
    .maybeSingle(),
    supabase
      .from("restaurant_custom_payment_methods")
      .select("id, label, kind, is_active")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
  ])

  if (error || !data || customResult.error) {
    console.error("[panel-settings]", JSON.stringify({ stage: "payment_methods_read", code: error?.code }))
    throw new Error("panel_payment_settings_unavailable")
  }

  const parsed = paymentMethodsResponseSchema.safeParse(data)
  if (!parsed.success) {
    console.error("[panel-settings]", JSON.stringify({ stage: "payment_methods_response_invalid" }))
    throw new Error("panel_payment_settings_unavailable")
  }
  const customMethods = z.array(customPaymentMethodResponseSchema).safeParse(customResult.data)
  if (!customMethods.success) {
    console.error("[panel-settings]", JSON.stringify({ stage: "custom_payment_methods_response_invalid" }))
    throw new Error("panel_payment_settings_unavailable")
  }
  return {
    enabledMethods: parsed.data.enabled_payment_methods,
    tipPolicy: parsed.data.tip_mode === "percentage"
      ? { mode: "percentage", percentageBps: parsed.data.tip_percentage_bps as number }
      : parsed.data.tip_mode === "fixed"
        ? { mode: "fixed", fixedCents: parsed.data.tip_fixed_cents as number }
        : { mode: "disabled" },
    customMethods: customMethods.data.map((method) => ({
      id: method.id,
      label: method.label,
      kind: method.kind,
      isActive: method.is_active,
    })),
  }
}
