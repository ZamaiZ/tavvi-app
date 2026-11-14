import "server-only"

import { createSupabasePublicClient } from "@/lib/supabase/public"

const PUBLIC_TOKEN_PATTERN = /^[0-9A-F]{32}$/
const PUBLIC_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export async function resolvePublicTagDestination(token: unknown): Promise<{ restaurantSlug: string; tableNumber: number } | null> {
  if (typeof token !== "string" || !PUBLIC_TOKEN_PATTERN.test(token)) return null

  const supabase = createSupabasePublicClient()
  const { data, error } = await supabase.rpc("resolve_menu_tag_token", { p_token: token })
  if (error) {
    console.error("[public-menu-tag]", JSON.stringify({ code: error.code }))
    return null
  }

  const row = Array.isArray(data) ? data[0] : null
  const slug = row && typeof row.restaurant_slug === "string" ? row.restaurant_slug : null
  const tableNumber = row && typeof row.table_number === "number" ? row.table_number : null
  return slug && PUBLIC_SLUG_PATTERN.test(slug) && tableNumber && tableNumber > 0
    ? { restaurantSlug: slug, tableNumber }
    : null
}

