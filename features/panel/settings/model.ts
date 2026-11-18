import type { PanelCustomPaymentMethodDTO, PanelPaymentMethod, PanelTipPolicy } from "@/features/panel/payments/model"

export type PaymentSettingsFailureCode =
  | "invalid_input"
  | "session_expired"
  | "context_changed"
  | "forbidden"
  | "unavailable"
  | "database_error"
  | "duplicate_method"

export type PaymentSettingsResult =
  | { ok: true; enabledMethods: PanelPaymentMethod[]; customMethods: PanelCustomPaymentMethodDTO[]; tipPolicy: PanelTipPolicy }
  | { ok: false; code: PaymentSettingsFailureCode }
