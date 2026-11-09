import "server-only"

import { cache } from "react"

import {
  parsePublicRestaurantProfile,
  publicRestaurantSlugSchema,
} from "@/features/public-profile/model"
import { createSupabasePublicClient } from "@/lib/supabase/public"

async function loadPublicRestaurantProfile(slug: unknown) {
  const parsedSlug = publicRestaurantSlugSchema.safeParse(slug)
  if (!parsedSlug.success) return null

  const supabase = createSupabasePublicClient()
  const { data, error } = await supabase.rpc("get_public_restaurant_profile", {
    p_slug: parsedSlug.data,
  })

  if (error) {
    console.error("[public-profile] restaurant lookup failed", {
      code: error.code ?? "unknown",
    })
    return null
  }

  return parsePublicRestaurantProfile(data)
}

export const getPublicRestaurantProfile = cache(loadPublicRestaurantProfile)
