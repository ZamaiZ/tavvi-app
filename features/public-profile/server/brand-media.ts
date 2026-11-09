import "server-only"

import { z } from "zod"

import { publicRestaurantSlugSchema } from "@/features/public-profile/model"
import { getPublicRestaurantProfile } from "@/features/public-profile/server/public-profile"
import { createSupabasePublicClient } from "@/lib/supabase/public"

const brandSlotSchema = z.enum(["logo", "cover"])

export type PublicRestaurantBrandMedia = {
  body: Blob
  contentType: "image/jpeg" | "image/png" | "image/webp"
}

function contentTypeFromPath(path: string): PublicRestaurantBrandMedia["contentType"] | null {
  const extension = path.split(".").at(-1)?.toLowerCase()
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg"
  if (extension === "png") return "image/png"
  if (extension === "webp") return "image/webp"
  return null
}

export async function getPublicRestaurantBrandMedia(
  slug: unknown,
  slot: unknown,
): Promise<PublicRestaurantBrandMedia | null> {
  const parsedSlug = publicRestaurantSlugSchema.safeParse(slug)
  const parsedSlot = brandSlotSchema.safeParse(slot)
  if (!parsedSlug.success || !parsedSlot.success) return null

  const profile = await getPublicRestaurantProfile(parsedSlug.data)
  const path = parsedSlot.data === "logo" ? profile?.logoPath : profile?.coverPath
  if (!path) return null

  const contentType = contentTypeFromPath(path)
  if (!contentType) return null

  const supabase = createSupabasePublicClient()
  const { data, error } = await supabase.storage
    .from("restaurant-brand")
    .download(path)

  if (error || !data) {
    console.error("[public-profile] brand media lookup failed", {
      code: error?.name ?? "unknown",
      slot: parsedSlot.data,
    })
    return null
  }

  return { body: data, contentType }
}
