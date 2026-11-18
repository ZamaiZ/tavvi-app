export const PANEL_PAYMENT_METHOD_VALUES = [
  "cash",
  "debit",
  "credit",
  "pix",
  "meal_voucher",
  "food_voucher",
  "partnership",
] as const

export const PANEL_PAYMENT_METHODS = [
  { value: PANEL_PAYMENT_METHOD_VALUES[0], label: "Dinheiro" },
  { value: PANEL_PAYMENT_METHOD_VALUES[1], label: "Débito" },
  { value: PANEL_PAYMENT_METHOD_VALUES[2], label: "Crédito" },
  { value: PANEL_PAYMENT_METHOD_VALUES[3], label: "PIX" },
  { value: PANEL_PAYMENT_METHOD_VALUES[4], label: "VA" },
  { value: PANEL_PAYMENT_METHOD_VALUES[5], label: "VR" },
  { value: PANEL_PAYMENT_METHOD_VALUES[6], label: "Parceria" },
] as const

export type PanelPaymentMethod = (typeof PANEL_PAYMENT_METHOD_VALUES)[number]
export type PaymentMethodKind = "cash" | "electronic"

export type PanelCustomPaymentMethodDTO = {
  id: string
  label: string
  kind: PaymentMethodKind
  isActive: boolean
}

export type PanelPaymentMethodOption = {
  value: string
  label: string
  kind: PaymentMethodKind
}

export type PanelTipPolicy =
  | { mode: "disabled" }
  | { mode: "percentage"; percentageBps: number }
  | { mode: "fixed"; fixedCents: number }

export type PanelPaymentConfiguration = {
  enabledMethods: PanelPaymentMethod[]
  customMethods: PanelCustomPaymentMethodDTO[]
  tipPolicy: PanelTipPolicy
}

export function getPanelPaymentOptions(configuration: PanelPaymentConfiguration): PanelPaymentMethodOption[] {
  const fixed = PANEL_PAYMENT_METHODS
    .filter((method) => configuration.enabledMethods.includes(method.value))
    .map((method) => ({ value: method.value, label: method.label, kind: method.value === "cash" ? "cash" as const : "electronic" as const }))
  const custom = configuration.customMethods
    .filter((method) => method.isActive)
    .map((method) => ({ value: `custom:${method.id}`, label: method.label, kind: method.kind }))
  return [...fixed, ...custom]
}

export type PaymentSplitInput = {
  method: string
  amountCents: number
  cashReceivedCents?: number
}
