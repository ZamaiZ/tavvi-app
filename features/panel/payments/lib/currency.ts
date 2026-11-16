const paymentPriceFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatPaymentCents(cents: number) {
  return paymentPriceFormatter.format(cents / 100)
}

export function maskPaymentAmountInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 16)
  return digits ? formatPaymentCents(Number(digits)) : ""
}

export function parsePaymentAmountCents(value: string): number | null {
  const digits = value.replace(/\D/g, "")
  if (!digits) return null
  const cents = Number(digits)
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null
}
