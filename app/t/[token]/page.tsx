import { notFound } from "next/navigation"

import { RestaurantPublicProfile } from "@/features/public-profile/components/restaurant-public-profile"
import { getPublicRestaurantMenu } from "@/features/public-profile/server/public-menu"
import { getPublicRestaurantProfile } from "@/features/public-profile/server/public-profile"
import { resolvePublicTagDestination } from "@/features/public-profile/server/public-tag"

type PublicTagPageProps = {
  params: Promise<{ token: string }>
}

export default async function PublicTagPage({ params }: PublicTagPageProps) {
  const { token } = await params
  const destination = await resolvePublicTagDestination(token)
  if (!destination) notFound()
  const [restaurant, menu] = await Promise.all([
    getPublicRestaurantProfile(destination.restaurantSlug),
    getPublicRestaurantMenu(destination.restaurantSlug),
  ])
  if (!restaurant) notFound()

  return (
    <RestaurantPublicProfile
      restaurant={restaurant}
      menu={menu}
      tableContext={{ token, tableNumber: destination.tableNumber }}
    />
  )
}

