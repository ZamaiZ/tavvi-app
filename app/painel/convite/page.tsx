import type { Metadata } from "next"
import { headers } from "next/headers"

import { InviteRedemptionPage } from "@/features/panel/invites/components/invite-redemption-page"
import { getPanelPublicBasePath } from "@/features/panel/auth/navigation"
import { previewPlatformInvite } from "@/features/panel/invites/server/redemption"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getRequestHostname } from "@/lib/routing/host"

export const metadata: Metadata = {
  title: "Aceitar convite",
  description: "Acesse a plataforma Tavvi pelo seu convite.",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
}

type InvitePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function InvitePage({ searchParams }: InvitePageProps) {
  const requestHeaders = await headers()
  const publicBasePath = getPanelPublicBasePath(getRequestHostname(requestHeaders))
  const params = await searchParams
  const rawToken = params.token
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken ?? null
  const preview = await previewPlatformInvite(token)
  let isAuthenticated = false

  if (preview.status === "available") {
    try {
      const supabase = await createSupabaseServerClient("panel")
      const { data, error } = await supabase.auth.getClaims()
      isAuthenticated = !error && Boolean(data?.claims?.sub)
    } catch {
      isAuthenticated = false
    }
  }

  return (
    <InviteRedemptionPage
      token={preview.status === "available" ? token : null}
      preview={preview}
      isAuthenticated={isAuthenticated}
      publicBasePath={publicBasePath}
    />
  )
}
