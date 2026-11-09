import { getPublicRestaurantBrandMedia } from "@/features/public-profile/server/brand-media"

type BrandMediaRouteContext = {
  params: Promise<{ slug: string; slot: string }>
}

export async function GET(_request: Request, { params }: BrandMediaRouteContext) {
  const { slug, slot } = await params
  const media = await getPublicRestaurantBrandMedia(slug, slot)

  if (!media) {
    return new Response(null, {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  }

  return new Response(media.body, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      "Content-Disposition": "inline",
      "Content-Type": media.contentType,
      "X-Content-Type-Options": "nosniff",
    },
  })
}
