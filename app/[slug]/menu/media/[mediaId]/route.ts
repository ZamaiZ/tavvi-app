import { NextResponse, type NextRequest } from "next/server"

import { publicRestaurantSlugSchema } from "@/features/public-profile/model"
import { createSupabasePublicClient } from "@/lib/supabase/public"

function unavailable() {
  return new NextResponse(null, {
    status: 404,
    headers: { "Cache-Control": "public, max-age=0, must-revalidate", "Referrer-Policy": "no-referrer" },
  })
}

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string; mediaId: string }> }) {
  const { slug: rawSlug, mediaId: rawMediaId } = await context.params
  const parsedSlug = publicRestaurantSlugSchema.safeParse(rawSlug)
  if (!parsedSlug.success || !/^[0-9a-f-]{36}$/i.test(rawMediaId)) return unavailable()

  const supabase = createSupabasePublicClient()
  const { data, error } = await supabase.rpc("get_public_menu_media_path", {
    p_slug: parsedSlug.data,
    p_media_id: rawMediaId,
    p_poster: request.nextUrl.searchParams.get("poster") === "1",
  })
  const result = data as { bucket?: unknown; path?: unknown } | null
  if (error || !result || (result.bucket !== "menu-images" && result.bucket !== "menu-videos") || typeof result.path !== "string") {
    return unavailable()
  }
  const { data: signed, error: signedError } = await supabase.storage.from(result.bucket).createSignedUrl(result.path, 120)
  if (signedError || !signed?.signedUrl) return unavailable()

  return NextResponse.redirect(signed.signedUrl, {
    status: 302,
    headers: { "Cache-Control": "public, max-age=0, must-revalidate", "Referrer-Policy": "no-referrer" },
  })
}
