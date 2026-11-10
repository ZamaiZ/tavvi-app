import "server-only"

import { cache } from "react"

import { parsePublicMenu } from "@/features/public-profile/menu-model"
import { publicRestaurantSlugSchema } from "@/features/public-profile/model"
import { createSupabasePublicClient } from "@/lib/supabase/public"

async function loadPublicRestaurantMenu(slug: unknown) {
  const parsedSlug = publicRestaurantSlugSchema.safeParse(slug)
  if (!parsedSlug.success) return null
  const supabase = createSupabasePublicClient()
  const { data, error } = await supabase.rpc("get_public_restaurant_menu", { p_slug: parsedSlug.data })
  if (error) {
    console.error("[public-menu] restaurant menu lookup failed", { code: error.code ?? "unknown" })
    return null
  }
  return parsePublicMenu(data)
}

export const getPublicRestaurantMenu = cache(loadPublicRestaurantMenu)
