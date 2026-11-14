import { NextResponse } from "next/server"

import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import { createSupabaseServerClient } from "@/lib/supabase/server"

function unavailable() {
  return new NextResponse(null, {
    status: 404,
    headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
  })
}

export async function GET(_request: Request, context: { params: Promise<{ mediaId: string }> }) {
  const { mediaId } = await context.params
  if (!/^[0-9a-f-]{36}$/i.test(mediaId)) return unavailable()

  let restaurant
  try {
    restaurant = await getActivePanelRestaurant()
  } catch {
    return unavailable()
  }
  if (!restaurant || restaurant.status !== "active") return unavailable()

  const supabase = await createSupabaseServerClient("panel")
  const { data: media } = await supabase
    .from("restaurant_feedback_media")
    .select("id,feedback_id,restaurant_id,kind,storage_path")
    .eq("id", mediaId)
    .eq("restaurant_id", restaurant.id)
    .maybeSingle()
  if (!media || (media.kind !== "image" && media.kind !== "video")) return unavailable()

  const { data: feedback } = await supabase
    .from("restaurant_feedback")
    .select("id")
    .eq("id", media.feedback_id)
    .eq("restaurant_id", restaurant.id)
    .eq("status", "published")
    .maybeSingle()
  if (!feedback) return unavailable()

  const bucket = media.kind === "image" ? "feedback-images" : "feedback-videos"
  const { data: signed, error } = await supabase.storage.from(bucket).createSignedUrl(media.storage_path, 90)
  if (error || !signed?.signedUrl) return unavailable()

  return NextResponse.redirect(signed.signedUrl, {
    status: 302,
    headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
  })
}
