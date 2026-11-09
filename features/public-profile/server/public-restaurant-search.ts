import "server-only"

import {
  parsePublicRestaurantSearchPage,
  publicRestaurantSearchInputSchema,
  type PublicRestaurantSearchPage,
} from "@/features/public-profile/model"
import { createSupabasePublicClient } from "@/lib/supabase/public"

export async function searchPublicRestaurants(input: {
  query: string
  page: number
}): Promise<PublicRestaurantSearchPage> {
  const parsedInput = publicRestaurantSearchInputSchema.safeParse(input)
  if (!parsedInput.success) throw new Error("public_restaurant_search_invalid_input")

  const supabase = createSupabasePublicClient()
  const { data, error } = await supabase.rpc("list_public_restaurants", {
    p_search: parsedInput.data.query,
    p_page: parsedInput.data.page,
  })

  if (error) {
    console.error("[public-search] restaurant query failed", {
      code: error.code ?? "unknown",
    })
    throw new Error("public_restaurant_search_unavailable")
  }

  const page = parsePublicRestaurantSearchPage(data)
  if (!page) {
    console.error("[public-search] invalid restaurant query response")
    throw new Error("public_restaurant_search_unavailable")
  }

  return page
}
