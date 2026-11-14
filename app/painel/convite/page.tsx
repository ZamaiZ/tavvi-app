import type { Metadata } from "next"
import { headers } from "next/headers"

import { InviteRedemptionPage } from "@/features/panel/invites/components/invite-redemption-page"
import { getPanelPublicBasePath } from "@/features/panel/auth/navigation"
import { previewPlatformInvite } from "@/features/panel/invites/server/redemption"
import { TeamInviteRedemptionPage } from "@/features/panel/team/components/team-invite-redemption-page"
import { previewTeamInvite } from "@/features/panel/team/server/redemption"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getRequestHostname } from "@/lib/routing/host"

export const metadata: Metadata = {
  title: "Aceitar convite",
  description: "Aceite o convite para entrar na equipe de um restaurante ou iniciar seu acesso ao Tavvi.",
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
  const platformPreview = await previewPlatformInvite(token)
  if (platformPreview.status === "available") {
    let isAuthenticated = false

    try {
      const supabase = await createSupabaseServerClient("panel")
      const { data, error } = await supabase.auth.getClaims()
      isAuthenticated = !error && Boolean(data?.claims?.sub)
    } catch {
      isAuthenticated = false
    }

    return (
      <InviteRedemptionPage
        token={token}
        preview={platformPreview}
        isAuthenticated={isAuthenticated}
        publicBasePath={publicBasePath}
      />
    )
  }

  const preview = await previewTeamInvite(token)
  if (preview.status !== "available" && platformPreview.status === "service-unavailable") {
    return (
      <InviteRedemptionPage
        token={null}
        preview={platformPreview}
        isAuthenticated={false}
        publicBasePath={publicBasePath}
      />
    )
  }

  let isAuthenticated = false
  let authenticatedEmail: string | null = null

  if (preview.status === "available") {
    try {
      const supabase = await createSupabaseServerClient("panel")
      const { data, error } = await supabase.auth.getClaims()
      isAuthenticated = !error && Boolean(data?.claims?.sub)
      const claimEmail = data?.claims?.email
      authenticatedEmail = typeof claimEmail === "string" ? claimEmail : null
    } catch {
      isAuthenticated = false
    }
  }

  return (
    <TeamInviteRedemptionPage
      token={preview.status === "available" ? token : null}
      preview={preview}
      isAuthenticated={isAuthenticated}
      authenticatedEmail={authenticatedEmail}
      publicBasePath={publicBasePath}
    />
  )
}
