import { MENU_MAX_PRICE_CENTS } from "../model"

const menuPriceFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const MENU_PRICE_INPUT_DIGIT_LIMIT = String(MENU_MAX_PRICE_CENTS).length + 1

export function formatMenuPriceCents(cents: number) {
  return menuPriceFormatter.format(cents / 100)
}

export function maskMenuPriceInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, MENU_PRICE_INPUT_DIGIT_LIMIT)
  if (!digits) return ""
  return formatMenuPriceCents(Number(digits))
}

export function parseMenuPriceCents(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, "").replace(/^R\$/i, "").replace(/\./g, "").replace(",", ".")
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null
  const cents = Math.round(Number(normalized) * 100)
  return Number.isSafeInteger(cents) && cents <= MENU_MAX_PRICE_CENTS ? cents : null
}

export function normalizeMenuPriceInput(value: string) {
  const cents = parseMenuPriceCents(value)
  return cents === null ? maskMenuPriceInput(value) : formatMenuPriceCents(cents)
}
