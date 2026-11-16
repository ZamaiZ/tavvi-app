import type { PanelPaymentMethod } from "@/features/panel/payments/model"

export type PaymentSettingsFailureCode =
  | "invalid_input"
  | "session_expired"
  | "context_changed"
  | "forbidden"
  | "unavailable"
  | "database_error"

export type PaymentSettingsResult =
  | { ok: true; enabledMethods: PanelPaymentMethod[] }
  | { ok: false; code: PaymentSettingsFailureCode }
