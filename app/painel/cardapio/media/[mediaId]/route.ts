import { NextResponse, type NextRequest } from "next/server"

import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import { createSupabaseServerClient } from "@/lib/supabase/server"

function unavailable() {
  return new NextResponse(null, {
    status: 404,
    headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
  })
}

export async function GET(request: NextRequest, context: { params: Promise<{ mediaId: string }> }) {
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
    .from("menu_item_media")
    .select("id,restaurant_id,kind,storage_path,poster_path")
    .eq("id", mediaId)
    .eq("restaurant_id", restaurant.id)
    .maybeSingle()
  if (!media) return unavailable()

  const poster = request.nextUrl.searchParams.get("poster") === "1"
  const path = poster ? media.poster_path : media.storage_path
  if (!path) return unavailable()
  const bucket = poster || media.kind === "image" ? "menu-images" : "menu-videos"
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 90)
  if (error || !data?.signedUrl) return unavailable()

  return NextResponse.redirect(data.signedUrl, {
    status: 302,
    headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
  })
}
