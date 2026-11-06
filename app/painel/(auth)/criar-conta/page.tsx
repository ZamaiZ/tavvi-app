import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { AdminAuthShell } from "@/features/admin/auth/components/admin-auth-shell"
import { PanelContactCommercial } from "@/features/panel/auth/components/panel-contact-commercial"
import { getPanelPublicBasePath } from "@/features/panel/auth/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getRequestHostname } from "@/lib/routing/host"

export const metadata: Metadata = { title: "Criar conta do Painel" }

export default async function PanelRegistrationPage() {
  const requestHeaders = await headers()
  const publicBasePath = getPanelPublicBasePath(getRequestHostname(requestHeaders))

  let hasSession = false
  try {
    const supabase = await createSupabaseServerClient("panel")
    const { data, error } = await supabase.auth.getClaims()
    hasSession = !error && Boolean(data?.claims?.sub)
  } catch {
    // A orientação de convite continua disponível se não for possível ler sessão.
  }
  if (hasSession) redirect(publicBasePath + "/")

  return (
    <AdminAuthShell
      title="Criar conta"
      description="Seu acesso começa com um convite Tavvi."
      badgeLabel="PAINEL"
    >
      <PanelContactCommercial loginHref={publicBasePath + "/entrar"} />
    </AdminAuthShell>
  )
}
