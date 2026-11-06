import type { Metadata } from "next"
import { headers } from "next/headers"

import { NotFoundExperience } from "@/components/not-found/not-found-experience"
import { getNotFoundLinks } from "@/lib/routing/not-found-links"

export const metadata: Metadata = {
  title: "Página não encontrada · Tavvi",
  description: "O endereço pode estar incorreto ou não estar mais disponível.",
}

export default async function NotFound() {
  const requestHeaders = await headers()
  const links = getNotFoundLinks(requestHeaders)

  return (
    <NotFoundExperience
      homeHref={links.homeHref}
      adminSignInHref={links.adminSignInHref}
      panelSignInHref={links.panelSignInHref}
    />
  )
}
