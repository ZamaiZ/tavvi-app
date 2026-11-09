import { NextResponse, type NextRequest } from "next/server"

import { publicRestaurantSearchInputSchema } from "@/features/public-profile/model"
import { searchPublicRestaurants } from "@/features/public-profile/server/public-restaurant-search"

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" }

function invalidQuery() {
  return NextResponse.json(
    { error: "invalid_query" },
    { status: 400, headers: noStoreHeaders },
  )
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? ""
  const rawPage = request.nextUrl.searchParams.get("page") ?? "1"

  if (query.length > 120) return invalidQuery()
  if (!/^\d+$/.test(rawPage)) return invalidQuery()

  const parsedInput = publicRestaurantSearchInputSchema.safeParse({
    query,
    page: Number(rawPage),
  })
  if (!parsedInput.success) return invalidQuery()

  try {
    const results = await searchPublicRestaurants(parsedInput.data)
    return NextResponse.json(results, { headers: noStoreHeaders })
  } catch {
    return NextResponse.json(
      { error: "unavailable" },
      { status: 503, headers: noStoreHeaders },
    )
  }
}
