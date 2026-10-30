import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { LuLogOut, LuShieldCheck } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { logoutAdminAction } from "@/app/admin/(auth)/actions"
import { AdminInvitesPage } from "@/features/admin/invites/components/admin-invites-page"
import {
  getAdminHomePath,
  getAdminPublicBasePath,
} from "@/features/admin/auth/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getRequestHostname } from "@/lib/routing/host"

export const metadata: Metadata = {
  title: "Convites",
}

export default async function AdminHomePage() {
  const requestHeaders = await headers()
  const hostname = getRequestHostname(requestHeaders)
  const publicBasePath = getAdminPublicBasePath(hostname)
  const loginPath = publicBasePath + "/entrar"
  const supabase = await createSupabaseServerClient("admin")

  let authorization: "allowed" | "denied" | "unavailable" = "denied"

  try {
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims()
    const claims = claimsData?.claims

    if (claimsError) {
      authorization = "unavailable"
    } else if (claims?.sub) {
      const { data: isAdmin, error: roleError } =
        await supabase.rpc("is_platform_admin")

      if (roleError || typeof isAdmin !== "boolean") {
        authorization = "unavailable"
        await supabase.auth.signOut({ scope: "local" })
      } else if (isAdmin) {
        authorization = "allowed"
      } else {
        await supabase.auth.signOut({ scope: "local" })
      }
    }
  } catch {
    authorization = "unavailable"
  }

  if (authorization !== "allowed") {
    redirect(
      authorization === "unavailable"
        ? loginPath + "?status=indisponivel"
        : loginPath
    )
  }

  return (
    <main className="min-h-svh overflow-x-hidden bg-muted/30 px-4 pb-8 sm:px-8">
      <AdminInvitesPage
        header={
          <header className="flex items-center justify-between border-b border-border/70 py-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <LuShieldCheck aria-hidden="true" className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">Tavvi — Gestão</p>
                <p className="text-xs text-muted-foreground">
                  Administração da plataforma
                </p>
              </div>
            </div>
            <form action={logoutAdminAction}>
              <Button type="submit" variant="outline" size="sm">
                <LuLogOut aria-hidden="true" />
                Sair
              </Button>
            </form>
          </header>
        }
        footer={`${getAdminHomePath(publicBasePath)} · Sessão administrativa isolada`}
      />
    </main>
  )
}
