"use client"

import { useEffect, useState, useTransition } from "react"
import Image from "next/image"
import { motion, MotionConfig, useReducedMotion, type Variants } from "motion/react"
import {
  LuArrowRight,
  LuCheck,
  LuCircleAlert,
  LuClock3,
  LuKeyRound,
  LuMail,
  LuShieldCheck,
  LuStore,
} from "react-icons/lu"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { acceptPanelInviteAction } from "@/features/panel/invites/actions"
import type {
  AcceptPanelInviteResult,
  PanelInvitePreview,
} from "@/features/panel/invites/model"

const sequence: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { delayChildren: 0.05, staggerChildren: 0.085 },
  },
}

const item: Variants = {
  hidden: { opacity: 0, y: 11 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] },
  },
}

type AuthMode = "signup" | "login" | "current"

type InviteRedemptionPageProps = {
  token: string | null
  preview: PanelInvitePreview
  isAuthenticated: boolean
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value))
}

function restaurantStatusLabel(status: "draft" | "active" | "suspended") {
  return {
    draft: "Rascunho",
    active: "Ativo",
    suspended: "Suspenso",
  }[status]
}

function errorMessage(code: Extract<AcceptPanelInviteResult, { ok: false }>['code']) {
  const messages: Record<typeof code, string> = {
    invalid_input: "Confira os dados e aceite os termos para continuar.",
    email_mismatch: "Este convite não pode ser usado com este e-mail. Confira se ele ainda está válido e se você informou o endereço correto.",
    invalid_credentials: "E-mail ou senha não conferem.",
    account_exists: "Esta conta já existe. Entre com ela para aceitar o convite.",
    confirmation_required:
      "A conta foi criada e precisa de confirmação por e-mail. Mantenha esta aba aberta, confirme o endereço e volte aqui para entrar. Se fechar ou recarregar, reabra o link original do convite.",
    rate_limited: "Muitas tentativas em sequência. Aguarde um pouco e tente novamente.",
    unavailable: "Este convite não está mais disponível para aceite.",
    slug_unavailable:
      "Não foi possível reservar um endereço para este restaurante. Tente novamente com outro nome.",
    service_unavailable: "O serviço está indisponível no momento. Tente novamente em instantes.",
  }
  return messages[code]
}

export function InviteRedemptionPage({
  token: initialToken,
  preview: initialPreview,
  isAuthenticated,
}: InviteRedemptionPageProps) {
  const shouldReduceMotion = useReducedMotion()
  const [isPending, startTransition] = useTransition()
  const [token] = useState(initialToken)
  const [preview] = useState(initialPreview)
  const [mode, setMode] = useState<AuthMode>(isAuthenticated ? "current" : "signup")
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [restaurantName, setRestaurantName] = useState("")
  const [accepted, setAccepted] = useState(false)
  const [actionError, setActionError] = useState("")
  const [acceptedRestaurant, setAcceptedRestaurant] = useState<
    Extract<AcceptPanelInviteResult, { ok: true }>['restaurant'] | null
  >(null)

  useEffect(() => {
    if (preview.status !== "available" || !token) return
    const address = new URL(window.location.href)
    if (!address.searchParams.has("token")) return
    address.searchParams.delete("token")
    window.history.replaceState(null, "", `${address.pathname}${address.search}${address.hash}`)
  }, [preview.status, token])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || !accepted || restaurantName.trim().length < 2) {
      setActionError("Informe o nome do restaurante e confirme o aceite.")
      return
    }

    const payload = {
      mode,
      token,
      restaurantName: restaurantName.trim(),
      accepted: true as const,
      ...(mode === "signup" ? { displayName: displayName.trim() } : {}),
      ...(mode !== "current"
        ? { email: email.trim(), password }
        : {}),
    }

    setActionError("")
    startTransition(async () => {
      try {
        const result = await acceptPanelInviteAction(payload)
        if (!result.ok) {
          setActionError(errorMessage(result.code))
          return
        }
        setAcceptedRestaurant(result.restaurant)
      } catch {
        setActionError("Não foi possível concluir o aceite. Tente novamente.")
      }
    })
  }

  return (
    <MotionConfig reducedMotion="user">
      <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-muted/35 px-4 py-10 sm:px-6">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-44 left-1/2 size-[34rem] -translate-x-1/2 rounded-full bg-primary/[0.055] blur-3xl" />
          <div className="absolute right-[-14rem] bottom-[-18rem] size-[34rem] rounded-full bg-primary/[0.035] blur-3xl" />
        </div>

        <motion.div
          initial={shouldReduceMotion ? false : "hidden"}
          animate="visible"
          variants={sequence}
          className="relative z-10 w-full max-w-[560px]"
        >
          <motion.header variants={item} className="mb-6 flex items-center justify-center">
            <Image
              src="/brand/tavvi-lockup-horizontal-light.png"
              alt="Tavvi"
              width={240}
              height={94}
              priority
              className="h-auto w-32 object-contain dark:hidden"
            />
            <Image
              src="/brand/tavvi-lockup-horizontal-dark.png"
              alt="Tavvi"
              width={240}
              height={94}
              priority
              className="hidden h-auto w-32 object-contain dark:block"
            />
          </motion.header>

          {acceptedRestaurant ? (
            <motion.section
              key="success"
              variants={item}
              className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-xl shadow-foreground/[0.035]"
            >
              <div className="border-b border-border/60 bg-gradient-to-br from-primary/[0.08] via-card to-card px-6 py-8 text-center sm:px-10">
                <motion.span
                  initial={shouldReduceMotion ? false : { scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"
                >
                  <LuCheck aria-hidden="true" className="size-7" />
                </motion.span>
                <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Acesso confirmado
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                  Convite resgatado
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  A confirmação veio do registro concluído para esta conta.
                </p>
              </div>
              <div className="space-y-4 px-6 py-6 sm:px-10 sm:py-8">
                <div className="flex items-center gap-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-background text-primary shadow-sm ring-1 ring-border/70">
                    <LuStore aria-hidden="true" className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Restaurante criado</p>
                    <p className="mt-1 truncate text-base font-semibold">
                      {acceptedRestaurant.restaurantName}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {restaurantStatusLabel(acceptedRestaurant.restaurantStatus)}
                  </Badge>
                </div>
                <Alert className="rounded-2xl">
                  <LuShieldCheck aria-hidden="true" />
                  <AlertTitle>Restaurante registrado</AlertTitle>
                  <AlertDescription>
                    Estado atual registrado: {restaurantStatusLabel(acceptedRestaurant.restaurantStatus)}.
                  </AlertDescription>
                </Alert>
              </div>
            </motion.section>
          ) : preview.status !== "available" ? (
            <motion.section
              key="unavailable"
              variants={item}
              className="rounded-3xl border border-border/70 bg-card px-6 py-9 text-center shadow-xl shadow-foreground/[0.035] sm:px-10"
            >
              <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <LuCircleAlert aria-hidden="true" className="size-5" />
              </span>
              <h1 className="text-xl font-semibold tracking-tight">
                {preview.status === "service-unavailable"
                  ? "Não foi possível validar o convite"
                  : "Convite indisponível"}
              </h1>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                {preview.status === "service-unavailable"
                  ? "O serviço está temporariamente indisponível. Atualize esta página para tentar novamente."
                  : "Este link pode estar inválido, vencido, revogado ou já utilizado."}
              </p>
              {preview.status === "service-unavailable" && (
                <Button className="mt-5" variant="outline" onClick={() => window.location.reload()}>
                  Tentar novamente
                </Button>
              )}
            </motion.section>
          ) : (
            <motion.section
              key="accept"
              variants={item}
              className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-xl shadow-foreground/[0.035]"
            >
              <div className="border-b border-border/60 px-6 pt-7 pb-6 sm:px-9 sm:pt-8">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <LuMail aria-hidden="true" className="size-5" />
                  </span>
                  <span className="flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-[0.6875rem] text-muted-foreground">
                    <LuClock3 aria-hidden="true" className="size-3" />
                    Válido até {formatDate(preview.expiresAt)}
                  </span>
                </div>
                <p className="text-xs font-semibold tracking-[0.13em] text-muted-foreground uppercase">
                  Convite para a plataforma
                </p>
                <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
                  Comece seu restaurante
                </h1>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Crie ou acesse sua conta, informe o nome do restaurante e confirme o aceite.
                </p>
              </div>

              <div className={`grid ${isAuthenticated ? "grid-cols-3" : "grid-cols-2"} gap-1 border-b border-border/60 bg-muted/30 p-1.5`}>
                  {(isAuthenticated
                    ? (["current", "signup", "login"] as const)
                    : (["signup", "login"] as const)
                  ).map((authMode) => (
                    <motion.button
                      key={authMode}
                      type="button"
                      whileTap={{ scale: 0.985 }}
                      onClick={() => {
                        setMode(authMode)
                        setActionError("")
                      }}
                      aria-pressed={mode === authMode}
                      className={`h-9 rounded-xl px-3 text-sm font-medium transition-colors ${
                        mode === authMode
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {authMode === "current"
                        ? "Conta atual"
                        : authMode === "signup"
                          ? "Criar conta"
                          : "Já tenho conta"}
                    </motion.button>
                  ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6 sm:px-9 sm:py-7">
                {mode === "current" ? (
                  <Alert className="rounded-xl">
                    <LuShieldCheck aria-hidden="true" />
                    <AlertTitle>Conta conectada</AlertTitle>
                    <AlertDescription>
                      O convite será resgatado pela sessão do Painel já autenticada neste navegador.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <motion.div
                    key={mode}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 7 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="space-y-4"
                  >
                    {mode === "signup" && (
                      <Field>
                        <FieldLabel htmlFor="invite-display-name">Seu nome</FieldLabel>
                        <Input
                          id="invite-display-name"
                          autoComplete="name"
                          value={displayName}
                          onChange={(event) => setDisplayName(event.currentTarget.value)}
                          required
                          minLength={2}
                          maxLength={100}
                          placeholder="Como podemos chamar você?"
                          className="h-11 rounded-xl"
                        />
                      </Field>
                    )}
                    <Field>
                      <FieldLabel htmlFor="invite-account-email">E-mail</FieldLabel>
                      <Input
                        id="invite-account-email"
                        type="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        value={email}
                        onChange={(event) => setEmail(event.currentTarget.value)}
                        required
                        maxLength={254}
                        placeholder="voce@exemplo.com"
                        className="h-11 rounded-xl"
                      />
                      {preview.emailRequired && (
                        <FieldDescription>
                          Use o e-mail associado a este convite.
                        </FieldDescription>
                      )}
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="invite-account-password">Senha</FieldLabel>
                      <Input
                        id="invite-account-password"
                        type="password"
                        autoComplete={mode === "signup" ? "new-password" : "current-password"}
                        value={password}
                        onChange={(event) => setPassword(event.currentTarget.value)}
                        required
                        minLength={mode === "signup" ? 8 : 1}
                        maxLength={128}
                        className="h-11 rounded-xl"
                      />
                      {mode === "signup" && (
                        <FieldDescription>
                          Use pelo menos 8 caracteres.
                        </FieldDescription>
                      )}
                    </Field>
                  </motion.div>
                )}

                <Field>
                  <FieldLabel htmlFor="invite-restaurant-name">Nome do restaurante</FieldLabel>
                  <Input
                    id="invite-restaurant-name"
                    autoComplete="organization"
                    value={restaurantName}
                    onChange={(event) => setRestaurantName(event.currentTarget.value)}
                    required
                    minLength={2}
                    maxLength={120}
                    placeholder="Nome usado para identificar o restaurante"
                    className="h-11 rounded-xl"
                  />
                  <FieldDescription>
                    O cadastro inicial será criado como rascunho.
                  </FieldDescription>
                </Field>

                <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/15 p-3.5 text-sm leading-5 transition-colors hover:bg-muted/30">
                  <Checkbox
                    id="invite-acceptance-checkbox"
                    checked={accepted}
                    onCheckedChange={(checked) => setAccepted(checked === true)}
                    aria-labelledby="invite-acceptance-label"
                    className="mt-0.5"
                  />
                  <span id="invite-acceptance-label">
                    Confirmo que quero aceitar este convite e criar o acesso inicial do restaurante.
                  </span>
                </div>

                {actionError && (
                  <motion.div
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Alert className="rounded-xl border-destructive/25 bg-destructive/5 text-destructive">
                      <LuCircleAlert aria-hidden="true" />
                      <AlertTitle>Não foi possível concluir</AlertTitle>
                      <AlertDescription>{actionError}</AlertDescription>
                    </Alert>
                  </motion.div>
                )}

                <motion.div
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.99 }}
                  transition={{ duration: 0.17, ease: "easeOut" }}
                  className="pt-1"
                >
                  <Button
                    type="submit"
                    disabled={isPending || !accepted}
                    className="h-11 w-full rounded-xl shadow-sm shadow-primary/10"
                  >
                    {isPending ? (
                      <span className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current motion-reduce:animate-none" />
                    ) : mode === "signup" ? (
                      <LuKeyRound aria-hidden="true" />
                    ) : (
                      <LuArrowRight aria-hidden="true" />
                    )}
                    {isPending
                      ? "Confirmando acesso…"
                      : mode === "signup"
                        ? "Criar conta e aceitar convite"
                        : mode === "login"
                          ? "Entrar e aceitar convite"
                          : "Aceitar convite"}
                  </Button>
                </motion.div>
              </form>
            </motion.section>
          )}

          <motion.p variants={item} className="mt-5 text-center text-xs text-muted-foreground">
            A conexão do convite é protegida e usada somente para concluir este acesso.
          </motion.p>
        </motion.div>
      </main>
    </MotionConfig>
  )
}
