export const RESERVED_RESTAURANT_SLUGS = ["admin", "painel"] as const

export function isReservedRestaurantSlug(value: string): boolean {
  return (RESERVED_RESTAURANT_SLUGS as readonly string[]).includes(value)
}
