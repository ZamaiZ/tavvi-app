import { headers } from "next/headers"
import { redirect } from "next/navigation"
import {
  LuLogOut,
  LuShieldCheck,
} from "react-icons/lu"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import { logoutAdminAction } from "@/app/admin/(auth)/actions"
import {
  getAdminHomePath,
  getAdminPublicBasePath,
} from "@/features/admin/auth/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export default async function AdminHomePage() {
  const requestHeaders = await headers()
  const hostname =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    ""
  const publicBasePath = getAdminPublicBasePath(hostname)
  const loginPath = publicBasePath + "/entrar"
  const supabase = await createSupabaseServerClient("admin")

  let authorization: "allowed" | "denied" | "unavailable" = "denied"

  try {
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
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
    <main className="min-h-svh bg-muted/30 p-4 sm:p-8">
      <div className="mx-auto flex min-h-[calc(100svh-2rem)] max-w-5xl flex-col">
        <header className="flex items-center justify-between border-b border-border/70 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <LuShieldCheck aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">Tavvi Admin</p>
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

        <section className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-2xl space-y-5">
            <Alert>
              <LuShieldCheck aria-hidden="true" />
              <AlertTitle>Sessão Admin verificada</AlertTitle>
              <AlertDescription>
                A autenticação está funcionando e a rota está protegida pela
                associação de Admin no Supabase.
              </AlertDescription>
            </Alert>

            <Card className="gap-0">
              <CardHeader className="gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                  Área Admin em preparação
                </h1>
                <CardDescription className="text-sm leading-6">
                  Este destino protegido confirma o fluxo de acesso. Convites e
                  gestão de restaurantes serão adicionados em uma etapa própria.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2 text-sm text-muted-foreground">
                Nenhuma ação administrativa foi antecipada nesta tela.
              </CardContent>
            </Card>
          </div>
        </section>

        <footer className="py-4 text-center text-xs text-muted-foreground">
          {getAdminHomePath(publicBasePath)} · Sessão administrativa isolada
        </footer>
      </div>
    </main>
  )
}
