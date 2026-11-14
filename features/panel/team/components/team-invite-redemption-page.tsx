"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion, MotionConfig, useReducedMotion, type Variants } from "motion/react"
import { LuArrowRight, LuAtSign, LuCheck, LuCircleAlert, LuEye, LuEyeOff, LuKeyRound, LuMail, LuShieldCheck, LuUserRound, LuUsers } from "react-icons/lu"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { ThemeToggle } from "@/components/theme-toggle"
import { acceptPanelTeamInviteAction } from "@/features/panel/team/actions"
import { teamRoleDescriptions, teamRoleLabels, type AcceptTeamInviteResult, type TeamInvitePreview } from "@/features/panel/team/model"
import { getPanelSignInPath } from "@/features/panel/auth/navigation"

const sequence: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1, transition: { delayChildren: 0.04, staggerChildren: 0.075 } },
}

const item: Variants = {
  hidden: { opacity: 0, y: 9 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.23, 1, 0.32, 1] } },
}

type TeamInviteRedemptionPageProps = {
  token: string | null
  preview: TeamInvitePreview
  isAuthenticated: boolean
  authenticatedEmail: string | null
  publicBasePath: "" | "/painel"
}

function inviteErrorMessage(code: Extract<AcceptTeamInviteResult, { ok: false }>['code']) {
  const messages: Record<typeof code, string> = {
    invalid_input: "Confira os dados e aceite o convite para continuar.",
    email_mismatch: "A conta conectada não usa o e-mail deste convite. Entre com a conta indicada e abra novamente o link.",
    account_exists: "Já existe uma conta com este e-mail. Entre no Painel com ela e abra novamente o link do convite.",
    confirmation_required: "A conta foi criada e precisa de confirmação por e-mail. Confirme o endereço e reabra o link original.",
    rate_limited: "Muitas tentativas em sequência. Aguarde um pouco e tente novamente.",
    already_member: "Este e-mail já está vinculado a este restaurante.",
    unavailable: "Este convite não está mais disponível para aceite.",
    service_unavailable: "O serviço está indisponível no momento. Tente novamente em instantes.",
  }
  return messages[code]
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(value))
  } catch {
    return "data indisponível"
  }
}

export function TeamInviteRedemptionPage({ token: initialToken, preview: initialPreview, isAuthenticated, authenticatedEmail, publicBasePath }: TeamInviteRedemptionPageProps) {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const [isPending, startTransition] = useTransition()
  const [token] = useState(initialToken)
  const [preview] = useState(initialPreview)
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState(initialPreview.status === "available" ? initialPreview.email : "")
  const [password, setPassword] = useState("")
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [actionError, setActionError] = useState("")
  const [actionErrorCode, setActionErrorCode] = useState<Extract<AcceptTeamInviteResult, { ok: false }>['code'] | null>(null)
  const [acceptedRestaurant, setAcceptedRestaurant] = useState<Extract<AcceptTeamInviteResult, { ok: true }>['restaurant'] | null>(null)
  const mode = isAuthenticated ? "current" : "signup"

  useEffect(() => {
    if (preview.status !== "available" || !token) return
    const address = new URL(window.location.href)
    if (!address.searchParams.has("token")) return
    address.searchParams.delete("token")
    window.history.replaceState(null, "", `${address.pathname}${address.search}${address.hash}`)
  }, [preview.status, token])

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || !accepted || preview.status !== "available") {
      setActionError("Confirme o aceite do convite para continuar.")
      return
    }

    setActionError("")
    setActionErrorCode(null)
    startTransition(async () => {
      try {
        const result = await acceptPanelTeamInviteAction(mode === "signup"
          ? { mode, token, accepted: true, displayName, email, password }
          : { mode, token, accepted: true })
        if (!result.ok) {
          setActionErrorCode(result.code)
          setActionError(inviteErrorMessage(result.code))
          return
        }
        setAcceptedRestaurant(result.restaurant)
      } catch {
        setActionErrorCode("service_unavailable")
        setActionError("Não foi possível conectar ao servidor. Tente novamente.")
      }
    })
  }

  if (preview.status !== "available" || !token) {
    return (
      <main className="grid min-h-svh place-items-center bg-muted/20 p-4">
        <div className="w-full max-w-md rounded-3xl border border-border/70 bg-background p-6 text-center shadow-lg sm:p-8">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground"><LuCircleAlert aria-hidden="true" className="size-5" /></span>
          <h1 className="mt-4 text-lg font-semibold tracking-tight">Convite indisponível</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Este link expirou, já foi usado ou não é válido.</p>
          {preview.status === "service-unavailable" ? <p className="mt-2 text-xs text-muted-foreground">Não foi possível conferir o convite agora. Tente abrir o link novamente em instantes.</p> : null}
        </div>
      </main>
    )
  }

  const invite = preview

  if (acceptedRestaurant) {
    return (
      <main className="grid min-h-svh place-items-center bg-muted/20 p-4">
        <motion.section initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }} className="w-full max-w-lg rounded-3xl border border-border/70 bg-background p-6 text-center shadow-xl sm:p-8">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><LuCheck aria-hidden="true" className="size-6" /></span>
          <Badge variant="secondary" className="mt-5 bg-primary/10 text-primary">Acesso confirmado</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Você entrou na equipe</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Seu acesso a <strong className="font-semibold text-foreground">{acceptedRestaurant.restaurantName}</strong> está pronto, com o cargo de {teamRoleLabels[invite.role].toLowerCase()}.</p>
          <Button type="button" onClick={() => router.replace(`${publicBasePath}/cardapio`)} className="mt-6 h-11 w-full rounded-xl sm:w-auto"><LuArrowRight aria-hidden="true" />Abrir o Painel</Button>
        </motion.section>
      </main>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <main className="relative grid min-h-svh place-items-center overflow-hidden bg-muted/20 p-4 sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--primary)_8%,transparent),transparent_55%)]" />
        <div className="absolute top-4 right-4 z-10 sm:top-6 sm:right-6"><ThemeToggle /></div>
        <motion.div initial={reduceMotion ? false : "hidden"} animate="visible" variants={sequence} className="relative w-full max-w-xl py-8">
          <motion.section variants={item} className="rounded-[1.75rem] border border-border/70 bg-background/95 p-5 shadow-2xl shadow-black/[0.05] backdrop-blur-xl sm:p-8">
            <div className="flex flex-col items-center text-center">
              <span className="grid size-14 place-items-center rounded-2xl border border-primary/15 bg-primary/[0.07] text-primary shadow-sm"><LuUsers aria-hidden="true" className="size-6" /></span>
              <Badge variant="outline" className="mt-4 border-primary/20 bg-primary/[0.05] text-primary"><LuMail aria-hidden="true" />Convite de equipe</Badge>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Entre para a equipe</h1>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground"><strong className="font-semibold text-foreground">{invite.restaurantName}</strong> convidou você para fazer parte do restaurante.</p>
            </div>

            <div className="mt-6 grid gap-3 rounded-2xl border border-border/70 bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><LuShieldCheck aria-hidden="true" className="size-4" /></span>
                <div className="min-w-0"><p className="text-sm font-semibold">{teamRoleLabels[invite.role]}</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{teamRoleDescriptions[invite.role]}</p></div>
              </div>
              <p className="text-xs text-muted-foreground sm:text-right">Válido até {formatDate(invite.expiresAt)}</p>
            </div>

            {mode === "current" ? (
              <motion.div variants={item} className="mt-5 rounded-2xl border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Conta conectada</p>
                <p className="mt-1.5 break-all text-sm font-medium">{authenticatedEmail ?? "E-mail não disponível"}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Convite enviado para {invite.email}. O aceite só será concluído com essa mesma conta.</p>
                {authenticatedEmail && authenticatedEmail.trim().toLowerCase() !== invite.email ? <p className="mt-2 text-xs font-medium text-destructive">Esta sessão usa outro e-mail. Saia e entre com o endereço do convite antes de continuar.</p> : null}
              </motion.div>
            ) : null}

            <motion.form variants={item} onSubmit={submit} className="mt-5 grid gap-4">
              {mode === "signup" ? (
                <>
                  <Field>
                    <FieldLabel htmlFor="team-invite-name">Seu nome</FieldLabel>
                    <InputGroup className="h-11 rounded-xl">
                      <InputGroupAddon align="inline-start"><InputGroupText><LuUserRound aria-hidden="true" /></InputGroupText></InputGroupAddon>
                      <InputGroupInput id="team-invite-name" autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.currentTarget.value)} required minLength={2} maxLength={100} placeholder="Como podemos chamar você?" className="h-11" />
                    </InputGroup>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="team-invite-email">E-mail da conta</FieldLabel>
                    <InputGroup className="h-11 rounded-xl">
                      <InputGroupAddon align="inline-start"><InputGroupText><LuAtSign aria-hidden="true" /></InputGroupText></InputGroupAddon>
                      <InputGroupInput id="team-invite-email" type="email" value={email} readOnly required autoComplete="email" className="h-11 bg-muted/35" />
                    </InputGroup>
                    <FieldDescription>Este endereço foi indicado no convite e não pode ser alterado.</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="team-invite-password">Crie uma senha</FieldLabel>
                    <InputGroup className="h-11 rounded-xl">
                      <InputGroupAddon align="inline-start"><InputGroupText><LuKeyRound aria-hidden="true" /></InputGroupText></InputGroupAddon>
                      <InputGroupInput id="team-invite-password" type={passwordVisible ? "text" : "password"} value={password} onChange={(event) => setPassword(event.currentTarget.value)} required minLength={8} maxLength={128} autoComplete="new-password" placeholder="No mínimo 8 caracteres" className="h-11" />
                      <InputGroupAddon align="inline-end"><InputGroupButton type="button" variant="ghost" size="icon-sm" aria-label={passwordVisible ? "Ocultar senha" : "Mostrar senha"} onClick={() => setPasswordVisible((value) => !value)}>{passwordVisible ? <LuEyeOff aria-hidden="true" /> : <LuEye aria-hidden="true" />}</InputGroupButton></InputGroupAddon>
                    </InputGroup>
                  </Field>
                </>
              ) : null}

              <div onClick={(event) => { if ((event.target as HTMLElement).closest('[data-slot="checkbox"]')) return; setAccepted((value) => !value) }} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm leading-5 transition-colors ${accepted ? "border-primary/35 bg-primary/[0.045]" : "border-border/70 bg-muted/15 hover:bg-muted/30"}`}>
                <Checkbox id="team-invite-acceptance" checked={accepted} onCheckedChange={(checked) => setAccepted(checked === true)} aria-labelledby="team-invite-acceptance-label" className="mt-0.5" />
                <span id="team-invite-acceptance-label" className="select-none">Aceito entrar para a equipe de {invite.restaurantName} com o cargo de {teamRoleLabels[invite.role].toLowerCase()}.</span>
              </div>

              <AnimatePresence initial={false}>
                {actionError ? <motion.div key="team-invite-error" initial={reduceMotion ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.16, ease: "easeOut" }}><Alert variant="destructive" className="rounded-xl"><LuCircleAlert aria-hidden="true" /><AlertTitle>Não foi possível concluir</AlertTitle><AlertDescription>{actionError}{actionErrorCode === "account_exists" ? <span className="mt-2 block"><Link href={getPanelSignInPath(publicBasePath)} className="font-semibold underline underline-offset-4">Entrar com esta conta</Link> e depois abrir novamente o link original do convite.</span> : null}</AlertDescription></Alert></motion.div> : null}
              </AnimatePresence>

              <motion.div whileHover={reduceMotion ? undefined : { y: -1 }} whileTap={reduceMotion ? undefined : { scale: 0.99 }} transition={{ duration: 0.16, ease: "easeOut" }}>
                <Button type="submit" disabled={isPending || !accepted || (mode === "signup" && (!displayName.trim() || !password))} className="h-11 w-full rounded-xl shadow-sm shadow-primary/10">
                  {isPending ? <span className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current motion-reduce:animate-none" /> : mode === "signup" ? <LuKeyRound aria-hidden="true" /> : <LuArrowRight aria-hidden="true" />}
                  {isPending ? "Confirmando acesso…" : mode === "signup" ? "Criar conta e entrar na equipe" : "Aceitar convite"}
                </Button>
              </motion.div>
            </motion.form>
          </motion.section>
          <motion.p variants={item} className="mt-4 text-center text-xs leading-5 text-muted-foreground">A equipe do restaurante poderá ver o e-mail usado para identificar seu acesso.</motion.p>
        </motion.div>
      </main>
    </MotionConfig>
  )
}
