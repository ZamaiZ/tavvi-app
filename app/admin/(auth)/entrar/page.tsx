import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { AdminAuthShell } from "@/features/admin/auth/components/admin-auth-shell"
import { AdminLoginForm } from "@/features/admin/auth/components/admin-login-form"
import {
  getAdminHomePath,
  getAdminPublicBasePath,
  normalizeAdminNextPath,
} from "@/features/admin/auth/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type AdminLoginPageProps = {
  searchParams: Promise<{
    next?: string | string[]
    status?: string | string[]
  }>
}

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function AdminLoginPage({
  searchParams,
}: AdminLoginPageProps) {
  const [requestHeaders, query] = await Promise.all([headers(), searchParams])
  const hostname =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    ""
  const publicBasePath = getAdminPublicBasePath(hostname)
  const nextPath =
    normalizeAdminNextPath(firstQueryValue(query.next), publicBasePath) ??
    getAdminHomePath(publicBasePath)

  let statusMessage: string | undefined

  if (firstQueryValue(query.status) === "indisponivel") {
    statusMessage =
      "Não foi possível verificar a sessão atual. Entre novamente para continuar."
  }

  let shouldRedirect = false

  try {
    const supabase = await createSupabaseServerClient("admin")
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
    const claims = claimsData?.claims

    if (!claimsError && claims?.sub) {
      const { data: isAdmin, error: roleError } =
        await supabase.rpc("is_platform_admin")

      shouldRedirect = !roleError && isAdmin === true
    }
  } catch {
    // Exibe o formulário sem revelar detalhes do provedor quando a verificação falha.
  }

  if (shouldRedirect) {
    redirect(nextPath)
  }

  return (
    <AdminAuthShell
      title="Entrar no Admin"
      description="Acesse a área de gestão da plataforma Tavvi."
    >
      <AdminLoginForm
        nextPath={nextPath}
        publicBasePath={publicBasePath}
        statusMessage={statusMessage}
      />
    </AdminAuthShell>
  )
}
