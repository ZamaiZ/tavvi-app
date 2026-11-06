import type { ReactNode } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { OnboardingWizard } from "@/features/panel/onboarding/components/onboarding-wizard"
import { profileFromPanelRestaurant } from "@/features/panel/onboarding/profile"
import { getPanelPublicBasePath } from "@/features/panel/auth/navigation"
import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getRequestHostname } from "@/lib/routing/host"
import { requireAuthenticatedSurface } from "@/lib/supabase/require-authenticated-surface"

export default async function PanelOnboardingLayout({ children }: { children: ReactNode }) {
  await requireAuthenticatedSurface("panel")
  const requestHeaders = await headers()
  const publicBasePath = getPanelPublicBasePath(getRequestHostname(requestHeaders))
  const supabase = await createSupabaseServerClient("panel")

  let restaurant: Awaited<ReturnType<typeof getActivePanelRestaurant>>
  try {
    restaurant = await getActivePanelRestaurant()
  } catch (cause) {
    if (cause instanceof Error && cause.message === "panel_restaurant_not_found") redirect(publicBasePath + "/restaurantes")
    throw cause
  }
  if (!restaurant) redirect(publicBasePath + "/restaurantes")
  if (restaurant.status !== "draft") redirect(publicBasePath + (restaurant.status === "active" ? "/cardapio" : "/suspenso"))

  async function previewUrl(path: string | null) {
    if (!path) return null
    const { data, error } = await supabase.storage.from("restaurant-brand").createSignedUrl(path, 3600)
    return error ? null : data.signedUrl
  }
  const [logoUrl, coverUrl] = await Promise.all([
    previewUrl(restaurant.logoPath),
    previewUrl(restaurant.coverPath),
  ])
  return <OnboardingWizard
    restaurant={{ id: restaurant.id, name: restaurant.name, slug: restaurant.slug }}
    initialProfile={profileFromPanelRestaurant(restaurant)}
    initialImageUrls={{ logo: logoUrl, cover: coverUrl }}
    publicBasePath={publicBasePath}
  >{children}</OnboardingWizard>
}
