import "server-only"

import { z } from "zod"

import { PANEL_PAYMENT_METHOD_VALUES, type PanelPaymentMethod } from "@/features/panel/payments/model"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const paymentMethodsResponseSchema = z.object({
  enabled_payment_methods: z.array(z.enum(PANEL_PAYMENT_METHOD_VALUES)).min(1).max(PANEL_PAYMENT_METHOD_VALUES.length),
}).refine(
  (response) => new Set(response.enabled_payment_methods).size === response.enabled_payment_methods.length,
)

export async function getPanelPaymentMethods(restaurantId: string): Promise<PanelPaymentMethod[]> {
  const supabase = await createSupabaseServerClient("panel")
  const { data, error } = await supabase
    .from("restaurants")
    .select("enabled_payment_methods")
    .eq("id", restaurantId)
    .maybeSingle()

  if (error || !data) {
    console.error("[panel-settings]", JSON.stringify({ stage: "payment_methods_read", code: error?.code }))
    throw new Error("panel_payment_settings_unavailable")
  }

  const parsed = paymentMethodsResponseSchema.safeParse(data)
  if (!parsed.success) {
    console.error("[panel-settings]", JSON.stringify({ stage: "payment_methods_response_invalid" }))
    throw new Error("panel_payment_settings_unavailable")
  }
  return parsed.data.enabled_payment_methods
}
