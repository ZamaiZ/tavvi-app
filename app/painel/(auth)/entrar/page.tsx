import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { AdminAuthShell } from "@/features/admin/auth/components/admin-auth-shell"
import { PanelLoginForm } from "@/features/panel/auth/components/panel-login-form"
import { getPanelPublicBasePath } from "@/features/panel/auth/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getRequestHostname } from "@/lib/routing/host"
import { getNotFoundLinks } from "@/lib/routing/not-found-links"

export const metadata: Metadata = { title: "Entrar no Painel" }

export default async function PanelLoginPage() {
  const requestHeaders = await headers()
  const publicBasePath = getPanelPublicBasePath(getRequestHostname(requestHeaders))

  let hasSession = false
  try {
    const supabase = await createSupabaseServerClient("panel")
    const { data, error } = await supabase.auth.getClaims()
    hasSession = !error && Boolean(data?.claims?.sub)
  } catch {
    // Mantém o formulário visível para erros de sessão recuperáveis.
  }
  if (hasSession) redirect(publicBasePath + "/")

  return (
    <AdminAuthShell
      title="Entrar"
      description="Acesse sua conta para continuar."
      badgeLabel="PAINEL"
    >
      <PanelLoginForm publicBasePath={publicBasePath} adminHref={getNotFoundLinks(requestHeaders).adminSignInHref} />
    </AdminAuthShell>
  )
}
