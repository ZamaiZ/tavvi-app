import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import { createSupabaseServerClient } from "@/lib/supabase/server"

function previewFailure(code: string, status: number) {
  return new Response(null, { status, headers: { "Cache-Control": "private, no-store", "X-Tavvi-Error": code } })
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const slot = url.searchParams.get("slot")
  const expectedId = url.searchParams.get("restaurant")
  if ((slot !== "logo" && slot !== "cover") || !expectedId) return previewFailure("brand_request", 400)
  try {
    const restaurant = await getActivePanelRestaurant(expectedId)
    if (!restaurant || restaurant.status !== "draft") return previewFailure("brand_context", 404)
    const path = slot === "logo" ? restaurant.logoPath : restaurant.coverPath
    if (!path) return previewFailure("brand_context", 404)
    const supabase = await createSupabaseServerClient("panel")
    const { data, error } = await supabase.storage.from("restaurant-brand").download(path)
    if (error || !data) {
      console.error("[panel-onboarding]", JSON.stringify({ stage: "brand_download", slot, code: error?.name, status: error?.statusCode }))
      return previewFailure("brand_storage", 404)
    }
    return new Response(data, { headers: { "Content-Type": data.type || "application/octet-stream", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } })
  } catch (cause) {
    console.error("[panel-onboarding]", JSON.stringify({ stage: "brand_preview", slot, name: cause instanceof Error ? cause.name : undefined }))
    const known = cause instanceof Error ? cause.message : ""
    return previewFailure(known === "panel_auth_required" ? "brand_session" : known === "panel_restaurant_context_changed" || known === "panel_restaurant_not_found" ? "brand_context" : "brand_unavailable", 404)
  }
}
