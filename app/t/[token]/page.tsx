import { notFound, redirect } from "next/navigation"

import { resolvePublicTagDestination } from "@/features/public-profile/server/public-tag"

type PublicTagPageProps = {
  params: Promise<{ token: string }>
}

export default async function PublicTagPage({ params }: PublicTagPageProps) {
  const { token } = await params
  const destination = await resolvePublicTagDestination(token)
  if (!destination) notFound()
  redirect(`/${destination.restaurantSlug}`)
}

