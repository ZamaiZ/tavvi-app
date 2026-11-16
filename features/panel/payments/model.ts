export const PANEL_PAYMENT_METHOD_VALUES = [
  "cash",
  "debit",
  "credit",
  "meal_voucher",
  "food_voucher",
  "partnership",
] as const

export const PANEL_PAYMENT_METHODS = [
  { value: PANEL_PAYMENT_METHOD_VALUES[0], label: "Dinheiro" },
  { value: PANEL_PAYMENT_METHOD_VALUES[1], label: "Débito" },
  { value: PANEL_PAYMENT_METHOD_VALUES[2], label: "Crédito" },
  { value: PANEL_PAYMENT_METHOD_VALUES[3], label: "VA" },
  { value: PANEL_PAYMENT_METHOD_VALUES[4], label: "VR" },
  { value: PANEL_PAYMENT_METHOD_VALUES[5], label: "Parceria" },
] as const

export type PanelPaymentMethod = (typeof PANEL_PAYMENT_METHOD_VALUES)[number]

export type PaymentSplitInput = {
  method: PanelPaymentMethod
  amountCents: number
}
