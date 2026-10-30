"use client"

import { useEffect, useState, useTransition } from "react"
import Image from "next/image"
import {
  AnimatePresence,
  motion,
  MotionConfig,
  useReducedMotion,
  type Variants,
} from "motion/react"
import {
  LuArrowRight,
  LuAtSign,
  LuCheck,
  LuCircleAlert,
  LuClock3,
  LuEye,
  LuEyeOff,
  LuKeyRound,
  LuMail,
  LuLockKeyhole,
  LuShieldCheck,
  LuStore,
  LuUserRound,
} from "react-icons/lu"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import {
  acceptPanelInviteAction,
  checkPanelInviteRestaurantNameAction,
} from "@/features/panel/invites/actions"
import type {
  AcceptPanelInviteResult,
  PanelInvitePreview,
  RestaurantNameAvailability,
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

const formSequence: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { delayChildren: 0.08, staggerChildren: 0.055 },
  },
}

const formItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  },
}

type NameAvailabilityState = RestaurantNameAvailability & { name: string }
  | { status: "idle" | "debouncing" | "checking"; name: string }

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
    account_exists: "Esta conta já existe. Acesse o Painel com ela e abra novamente o link original do convite.",
    confirmation_required:
      "A conta foi criada e precisa de confirmação por e-mail. Mantenha esta aba aberta, confirme o endereço e volte aqui para entrar. Se fechar ou recarregar, reabra o link original do convite.",
    rate_limited: "Muitas tentativas em sequência. Aguarde um pouco e tente novamente.",
    unavailable: "Este convite não está mais disponível para aceite.",
    slug_unavailable:
      "Este nome ou endereço já está em uso. Escolha outro nome para o restaurante.",
    service_unavailable: "O serviço está indisponível no momento. Tente novamente em instantes.",
  }
  return messages[code]
}

function availabilityMessage(state: NameAvailabilityState) {
  if (state.status === "idle") return ""
  if (state.status === "debouncing") return "Aguardando para conferir disponibilidade…"
  if (state.status === "checking") return "Verificando nome e slug…"
  if (state.status === "available") return `Slug “${state.slug}” disponível.`
  if (state.status === "error") {
    return "Não foi possível verificar agora. O aceite fará a conferência final."
  }
  if (!state.nameAvailable && !state.slugAvailable) {
    return `Esse nome e a slug “${state.slug}” já estão em uso.`
  }
  if (!state.nameAvailable) {
    return `Já existe um restaurante com esse nome; a slug “${state.slug}” está disponível.`
  }
  return `O nome está disponível, mas a slug “${state.slug}” já está em uso.`
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
  const mode = isAuthenticated ? "current" : "signup"
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [restaurantName, setRestaurantName] = useState("")
  const [nameAvailability, setNameAvailability] = useState<NameAvailabilityState>({
    status: "idle",
    name: "",
  })
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

  useEffect(() => {
    const normalizedName = restaurantName.trim()
    if (preview.status !== "available" || !token || normalizedName.length < 2) {
      setNameAvailability({ status: "idle", name: normalizedName })
      return
    }

    let isCurrent = true
    const timeout = window.setTimeout(() => {
      setNameAvailability({ status: "checking", name: normalizedName })
      void checkPanelInviteRestaurantNameAction({
        token,
        restaurantName: normalizedName,
      }).then((result) => {
        if (!isCurrent) return
        if (result.status === "error") {
          setNameAvailability({ status: "error", name: normalizedName })
          return
        }
        if (result.status === "available") {
          setNameAvailability({ status: "available", slug: result.slug, name: normalizedName })
          return
        }
        setNameAvailability({
          status: "unavailable",
          slug: result.slug,
          nameAvailable: result.nameAvailable,
          slugAvailable: result.slugAvailable,
          name: normalizedName,
        })
      }).catch(() => {
        if (!isCurrent) return
        setNameAvailability({ status: "error", name: normalizedName })
      })
    }, 550)

    return () => {
      isCurrent = false
      window.clearTimeout(timeout)
    }
  }, [preview.status, restaurantName, token])

  const currentNameAvailability =
    nameAvailability.name === restaurantName.trim() ? nameAvailability : null
  const isCheckingName =
    currentNameAvailability?.status === "debouncing" ||
    currentNameAvailability?.status === "checking"

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || !accepted || restaurantName.trim().length < 2) {
      setActionError("Informe o nome do restaurante e confirme o aceite.")
      return
    }
    if (currentNameAvailability?.status === "unavailable") {
      setActionError("Este nome ou endereço já está em uso. Escolha outro nome.")
      return
    }
    if (isCheckingName) {
      setActionError("Aguarde a conferência do nome do restaurante.")
      return
    }

    const payload = {
      mode,
      token,
      restaurantName: restaurantName.trim(),
      accepted: true as const,
      ...(mode === "signup" ? { displayName: displayName.trim() } : {}),
      ...(mode === "signup" ? { email: email.trim(), password } : {}),
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
                  {isAuthenticated
                    ? "Confirme o nome do restaurante e aceite este convite para criar seu acesso."
                    : "Crie sua conta, informe o nome do restaurante e confirme o aceite."}
                </p>
              </div>

              <motion.form
                onSubmit={handleSubmit}
                initial={shouldReduceMotion ? false : "hidden"}
                animate="visible"
                variants={formSequence}
                className="space-y-4 px-6 py-6 sm:px-9 sm:py-7"
              >
                {mode === "current" ? (
                  <motion.div variants={formItem}>
                    <Alert className="rounded-xl">
                      <LuShieldCheck aria-hidden="true" />
                      <AlertTitle>Conta conectada</AlertTitle>
                      <AlertDescription>
                        O convite será resgatado pela sessão do Painel já autenticada neste navegador.
                      </AlertDescription>
                    </Alert>
                  </motion.div>
                ) : (
                  <>
                    <motion.div variants={formItem}>
                      <Field>
                        <FieldLabel htmlFor="invite-display-name">Seu nome</FieldLabel>
                        <InputGroup className="h-11 rounded-xl bg-background/70">
                          <InputGroupAddon align="inline-start">
                            <InputGroupText>
                              <LuUserRound aria-hidden="true" />
                            </InputGroupText>
                          </InputGroupAddon>
                          <InputGroupInput
                            id="invite-display-name"
                            autoComplete="name"
                            value={displayName}
                            onChange={(event) => setDisplayName(event.currentTarget.value)}
                            required
                            minLength={2}
                            maxLength={100}
                            placeholder="Como podemos chamar você?"
                            className="h-11"
                          />
                        </InputGroup>
                      </Field>
                    </motion.div>

                    <motion.div variants={formItem}>
                      <Field>
                        <FieldLabel htmlFor="invite-account-email">E-mail</FieldLabel>
                        <InputGroup className="h-11 rounded-xl bg-background/70">
                          <InputGroupAddon align="inline-start">
                            <InputGroupText>
                              <LuAtSign aria-hidden="true" />
                            </InputGroupText>
                          </InputGroupAddon>
                          <InputGroupInput
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
                            className="h-11"
                          />
                        </InputGroup>
                        {preview.emailRequired && (
                          <FieldDescription>
                            Use o e-mail associado a este convite.
                          </FieldDescription>
                        )}
                      </Field>
                    </motion.div>

                    <motion.div variants={formItem}>
                      <Field>
                        <FieldLabel htmlFor="invite-account-password">Senha</FieldLabel>
                        <InputGroup className="h-11 rounded-xl bg-background/70">
                          <InputGroupAddon align="inline-start">
                            <InputGroupText>
                              <LuLockKeyhole aria-hidden="true" />
                            </InputGroupText>
                          </InputGroupAddon>
                          <InputGroupInput
                            id="invite-account-password"
                            type={passwordVisible ? "text" : "password"}
                            autoComplete="new-password"
                            value={password}
                            onChange={(event) => setPassword(event.currentTarget.value)}
                            required
                            minLength={8}
                            maxLength={128}
                            className="h-11"
                          />
                          <InputGroupAddon align="inline-end">
                            <motion.div
                              whileHover={{ scale: 1.06 }}
                              whileTap={{ scale: 0.92 }}
                              transition={{ duration: 0.16, ease: "easeOut" }}
                            >
                              <InputGroupButton
                                aria-label={passwordVisible ? "Ocultar senha" : "Mostrar senha"}
                                aria-pressed={passwordVisible}
                                className="mr-1 text-muted-foreground"
                                onClick={() => setPasswordVisible((current) => !current)}
                                size="icon-sm"
                              >
                                <AnimatePresence mode="wait" initial={false}>
                                  <motion.span
                                    key={passwordVisible ? "visible" : "hidden"}
                                    initial={
                                      shouldReduceMotion
                                        ? false
                                        : { opacity: 0, scale: 0.72, rotate: -24 }
                                    }
                                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                    exit={
                                      shouldReduceMotion
                                        ? { opacity: 1 }
                                        : { opacity: 0, scale: 0.72, rotate: 24 }
                                    }
                                    transition={{
                                      duration: shouldReduceMotion ? 0 : 0.16,
                                      ease: "easeOut",
                                    }}
                                    className="flex"
                                  >
                                    {passwordVisible ? (
                                      <LuEyeOff aria-hidden="true" />
                                    ) : (
                                      <LuEye aria-hidden="true" />
                                    )}
                                  </motion.span>
                                </AnimatePresence>
                              </InputGroupButton>
                            </motion.div>
                          </InputGroupAddon>
                        </InputGroup>
                        <FieldDescription>Use pelo menos 8 caracteres.</FieldDescription>
                      </Field>
                    </motion.div>
                  </>
                )}

                <motion.div variants={formItem}>
                  <Field>
                    <FieldLabel htmlFor="invite-restaurant-name">Nome do restaurante</FieldLabel>
                    <InputGroup
                      className="h-11 rounded-xl bg-background/70"
                      aria-invalid={currentNameAvailability?.status === "unavailable" || undefined}
                    >
                      <InputGroupAddon align="inline-start">
                        <InputGroupText>
                          <LuStore aria-hidden="true" />
                        </InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput
                        id="invite-restaurant-name"
                        autoComplete="organization"
                        value={restaurantName}
                        onChange={(event) => {
                          const value = event.currentTarget.value
                          const normalizedName = value.trim()
                          setRestaurantName(value)
                          setActionError("")
                          setNameAvailability(
                            normalizedName.length < 2
                              ? { status: "idle", name: normalizedName }
                              : { status: "debouncing", name: normalizedName }
                          )
                        }}
                        required
                        minLength={2}
                        maxLength={120}
                        placeholder="Nome usado para identificar o restaurante"
                        aria-invalid={currentNameAvailability?.status === "unavailable" || undefined}
                        aria-describedby="invite-restaurant-name-description invite-restaurant-name-availability"
                        className="h-11"
                      />
                    </InputGroup>
                    <FieldDescription id="invite-restaurant-name-description">
                      O cadastro inicial será criado como rascunho.
                    </FieldDescription>
                    <div
                      id="invite-restaurant-name-availability"
                      className="min-h-5"
                      aria-live="polite"
                      aria-atomic="true"
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {currentNameAvailability && currentNameAvailability.status !== "idle" && (
                          <motion.p
                            key={`${currentNameAvailability.status}-${"slug" in currentNameAvailability ? currentNameAvailability.slug : ""}`}
                            initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -3 }}
                            transition={{ duration: shouldReduceMotion ? 0 : 0.16, ease: "easeOut" }}
                            className={`flex items-center gap-1.5 pt-1 text-xs ${
                              currentNameAvailability.status === "available"
                                ? "text-primary"
                                : currentNameAvailability.status === "unavailable"
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {currentNameAvailability.status === "available" ? (
                              <LuCheck aria-hidden="true" className="size-3.5 shrink-0" />
                            ) : currentNameAvailability.status === "unavailable" || currentNameAvailability.status === "error" ? (
                              <LuCircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
                            ) : (
                              <span className="size-3.5 shrink-0 animate-spin rounded-full border border-current/30 border-t-current motion-reduce:animate-none" />
                            )}
                            <span>
                              {availabilityMessage(currentNameAvailability)}
                            </span>
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </Field>
                </motion.div>

                <motion.div variants={formItem}>
                  <div
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest('[data-slot="checkbox"]')) return
                      setAccepted((current) => !current)
                    }}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm leading-5 transition-colors ${
                      accepted
                        ? "border-primary/35 bg-primary/[0.045]"
                        : "border-border/70 bg-muted/15 hover:bg-muted/30"
                    }`}
                  >
                    <Checkbox
                      id="invite-acceptance-checkbox"
                      checked={accepted}
                      onCheckedChange={(checked) => setAccepted(checked === true)}
                      aria-labelledby="invite-acceptance-label"
                      className="mt-0.5"
                    />
                    <span id="invite-acceptance-label" className="select-none">
                      Confirmo que quero aceitar este convite e criar o acesso inicial do restaurante.
                    </span>
                  </div>
                </motion.div>

                <AnimatePresence initial={false}>
                  {actionError && (
                    <motion.div
                      key="action-error"
                      variants={formItem}
                      initial={shouldReduceMotion ? false : "hidden"}
                      animate="visible"
                      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                    >
                      <Alert className="rounded-xl border-destructive/25 bg-destructive/5 text-destructive">
                        <LuCircleAlert aria-hidden="true" />
                        <AlertTitle>Não foi possível concluir</AlertTitle>
                        <AlertDescription>{actionError}</AlertDescription>
                      </Alert>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div
                  variants={formItem}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.99 }}
                  transition={{ duration: 0.17, ease: "easeOut" }}
                  className="pt-1"
                >
                  <Button
                    type="submit"
                    disabled={
                      isPending ||
                      !accepted ||
                      isCheckingName ||
                      currentNameAvailability?.status === "unavailable"
                    }
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
                        : "Aceitar convite"}
                  </Button>
                </motion.div>
              </motion.form>
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
