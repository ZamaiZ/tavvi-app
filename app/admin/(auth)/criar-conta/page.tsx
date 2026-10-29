import Link from "next/link"
import { headers } from "next/headers"
import {
  LuArrowRight,
  LuCircleCheck,
  LuCircleHelp,
  LuLoaderCircle,
  LuShieldAlert,
} from "react-icons/lu"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AdminAuthShell } from "@/features/admin/auth/components/admin-auth-shell"
import { AdminRegistrationForm } from "@/features/admin/auth/components/admin-registration-form"
import {
  getAdminHomePath,
  getAdminPublicBasePath,
} from "@/features/admin/auth/navigation"
import { getAdminRegistrationViewState } from "@/features/admin/auth/server"

export const dynamic = "force-dynamic"

export default async function AdminRegistrationPage() {
  const requestHeaders = await headers()
  const hostname =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    ""
  const publicBasePath = getAdminPublicBasePath(hostname)
  const registrationState = await getAdminRegistrationViewState()

  if (registrationState === "open") {
    return (
      <AdminAuthShell
        title="Criar conta Admin"
        description="Configure o acesso inicial responsável pela administração da plataforma."
      >
        <AdminRegistrationForm
          mode="create"
          publicBasePath={publicBasePath}
        />
      </AdminAuthShell>
    )
  }

  if (registrationState === "resume-claim") {
    return (
      <AdminAuthShell
        title="Concluir ativação"
        description="Sua conta existe. Falta apenas concluir a associação administrativa."
      >
        <AdminRegistrationForm
          mode="resume-claim"
          publicBasePath={publicBasePath}
        />
      </AdminAuthShell>
    )
  }

  if (registrationState === "already-admin") {
    return (
      <AdminAuthShell
        title="Conta Admin já criada"
        description="Esta instalação aceita uma única conta Admin da plataforma."
      >
        <div className="space-y-5">
          <Alert>
            <LuCircleCheck aria-hidden="true" />
            <AlertTitle>O cadastro inicial foi concluído</AlertTitle>
            <AlertDescription>
              Nenhuma outra conta Admin pode ser criada enquanto esta conta
              estiver ativa.
            </AlertDescription>
          </Alert>

          <Button
            render={
              <Link href={getAdminHomePath(publicBasePath)}>
                Acessar área Admin
                <LuArrowRight aria-hidden="true" />
              </Link>
            }
            size="lg"
            className="h-11 w-full rounded-lg"
          />
        </div>
      </AdminAuthShell>
    )
  }

  const closed = registrationState === "closed"

  return (
    <AdminAuthShell
      title={closed ? "Cadastro já encerrado" : "Não foi possível verificar"}
      description={
        closed
          ? "A conta inicial do Admin já foi criada. Entre para continuar."
          : "Não conseguimos confirmar se a configuração do Admin está disponível."
      }
    >
      <div className="space-y-5">
        <Alert variant={closed ? "default" : "destructive"}>
          {closed ? (
            <LuCircleCheck aria-hidden="true" />
          ) : (
            <LuShieldAlert aria-hidden="true" />
          )}
          <AlertTitle>
            {closed ? "Cadastro inicial concluído" : "Verificação indisponível"}
          </AlertTitle>
          <AlertDescription>
            {closed
              ? "Esta instalação aceita uma única conta Admin ativa."
              : "Por segurança, o formulário não será exibido até que a conexão seja verificada."}
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            render={
              <Link href={publicBasePath + "/entrar"}>
                {closed ? (
                  <LuCircleCheck aria-hidden="true" />
                ) : (
                  <LuCircleHelp aria-hidden="true" />
                )}
                Ir para login
              </Link>
            }
            size="lg"
            className="h-11 flex-1 rounded-lg"
          />
          {!closed && (
            <Button
              render={
                <a href={publicBasePath + "/criar-conta"}>
                  <LuLoaderCircle aria-hidden="true" />
                  Tentar novamente
                </a>
              }
              variant="outline"
              size="lg"
              className="h-11 flex-1 rounded-lg"
            />
          )}
        </div>
      </div>
    </AdminAuthShell>
  )
}
