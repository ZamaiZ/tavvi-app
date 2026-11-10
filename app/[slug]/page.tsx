import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"

import { RestaurantPublicProfile } from "@/features/public-profile/components/restaurant-public-profile"
import { getPublicRestaurantProfile } from "@/features/public-profile/server/public-profile"
import { getPublicRestaurantMenu } from "@/features/public-profile/server/public-menu"

type PublicRestaurantPageProps = {
  params: Promise<{ slug: string }>
}

async function requestOrigin(): Promise<string | null> {
  const requestHeaders = await headers()
  const forwardedHost = requestHeaders.get("x-forwarded-host")
  const host = (forwardedHost ?? requestHeaders.get("host"))?.trim()
  if (!host || host.includes(",")) return null

  const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.trim()
  const protocol = forwardedProtocol === "https" || forwardedProtocol === "http"
    ? forwardedProtocol
    : process.env.NODE_ENV === "development"
      ? "http"
      : "https"

  try {
    const url = new URL(`${protocol}://${host}`)
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null
    if (url.host.toLowerCase() !== host.toLowerCase()) return null
    return url.origin
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: PublicRestaurantPageProps): Promise<Metadata> {
  const { slug } = await params
  const restaurant = await getPublicRestaurantProfile(slug)

  if (!restaurant) {
    return {
      title: "Restaurante não encontrado | Tavvi",
      robots: { index: false, follow: false },
    }
  }

  const title = `${restaurant.name} | Tavvi`
  const description = restaurant.description || `Conheça ${restaurant.name} e encontre os canais de contato do restaurante.`
  const origin = restaurant.coverPath ? await requestOrigin() : null
  const coverUrl = origin ? `${origin}/${restaurant.slug}/media/cover` : null
  const images = coverUrl ? [{ url: coverUrl, alt: `Capa de ${restaurant.name}` }] : undefined

  return {
    title,
    description,
    openGraph: {
      type: "website",
      locale: "pt_BR",
      title,
      description,
      ...(images ? { images } : {}),
    },
    twitter: {
      card: coverUrl ? "summary_large_image" : "summary",
      title,
      description,
      ...(coverUrl ? { images: [coverUrl] } : {}),
    },
  }
}

export default async function PublicRestaurantPage({ params }: PublicRestaurantPageProps) {
  const { slug } = await params
  const [restaurant, menu] = await Promise.all([
    getPublicRestaurantProfile(slug),
    getPublicRestaurantMenu(slug),
  ])

  if (!restaurant) notFound()

  return <RestaurantPublicProfile restaurant={restaurant} menu={menu} />
}
