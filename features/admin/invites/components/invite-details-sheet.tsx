"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { motion, useReducedMotion } from "motion/react"
import {
  LuAtSign,
  LuCalendarClock,
  LuCheck,
  LuClock3,
  LuCopy,
  LuExternalLink,
  LuMailPlus,
  LuStore,
  LuUsers,
  LuX,
} from "react-icons/lu"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  replaceAdminInviteAction,
  revokeAdminInviteAction,
} from "@/features/admin/invites/actions"
import {
  formatInviteDate,
  getInviteRecipient,
  inviteStatusLabels,
  type PlatformInvite,
} from "@/features/admin/invites/model"

type InviteDetailsSheetProps = {
  invite: PlatformInvite | null
  onOpenChange: (open: boolean) => void
  onCreateFromInvite: (invite: PlatformInvite) => void
}

type Replacement = {
  invite: PlatformInvite
  link: string
}

export function InviteDetailsSheet({
  invite,
  onOpenChange,
  onCreateFromInvite,
}: InviteDetailsSheetProps) {
  const shouldReduceMotion = useReducedMotion()
  const [isPending, startTransition] = useTransition()
  const idempotencyKey = useRef<string | null>(null)
  const [replacementMode, setReplacementMode] = useState(false)
  const [email, setEmail] = useState("")
  const [validDays, setValidDays] = useState("7")
  const [replacement, setReplacement] = useState<Replacement | null>(null)
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle"
  )
  const [actionError, setActionError] = useState("")
  const [retryBlocked, setRetryBlocked] = useState(false)
  const [revokeConfirmationOpen, setRevokeConfirmationOpen] = useState(false)
  const [discardConfirmationOpen, setDiscardConfirmationOpen] = useState(false)

  useEffect(() => {
    if (!invite) return
    setReplacementMode(false)
    setEmail(invite.email ?? "")
    setValidDays("7")
    setReplacement(null)
    setCopyState("idle")
    setActionError("")
    setRetryBlocked(false)
    idempotencyKey.current = null
  }, [invite?.id])

  function requestClose(open: boolean) {
    if (!open && isPending) return
    if (!open && replacement && copyState !== "copied") {
      setDiscardConfirmationOpen(true)
      return
    }
    onOpenChange(open)
  }

  async function copyReplacementLink() {
    if (!replacement) return
    try {
      await navigator.clipboard.writeText(replacement.link)
      setCopyState("copied")
    } catch {
      setCopyState("error")
    }
  }

  function handleReplace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!invite) return
    if (retryBlocked) return
    const normalizedEmail = email.trim()
    const days = Number(validDays)
    if (
      (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) ||
      !Number.isInteger(days) ||
      days < 1 ||
      days > 30
    ) {
      setActionError("Confira o e-mail e escolha um prazo entre 1 e 30 dias.")
      return
    }

    setActionError("")
    startTransition(async () => {
      try {
        const result = await replaceAdminInviteAction({
          inviteId: invite.id,
          email: normalizedEmail,
          validDays: days,
          idempotencyKey:
            idempotencyKey.current ??
            (idempotencyKey.current = globalThis.crypto.randomUUID()),
        })
        if (!result.ok) {
          const messages: Record<string, string> = {
            invalid_input: "Revise os dados informados e tente novamente.",
            unauthorized: "Sua sessão de gestão expirou. Entre novamente.",
            service_unavailable: "Não foi possível substituir o convite agora.",
            rate_limited: "Aguarde um pouco antes de tentar novamente.",
            link_unavailable:
              "A substituição foi registrada, mas o link não pode ser recuperado.",
            not_replaceable: "Este convite não pode mais ser substituído.",
            not_revocable: "Este convite não pode ser revogado.",
          }
          setActionError(messages[result.code] ?? "Não foi possível substituir o convite.")
          if (result.code === "link_unavailable") {
            setRetryBlocked(true)
            setReplacementMode(false)
          }
          return
        }

        idempotencyKey.current = null
        setReplacement({ invite: result.invite, link: result.link })
        setReplacementMode(false)
        setCopyState("idle")
      } catch {
        setActionError("Não foi possível concluir a solicitação. Tente novamente.")
      }
    })
  }

  function handleRevoke() {
    if (!invite) return
    setActionError("")
    startTransition(async () => {
      try {
        const result = await revokeAdminInviteAction(invite.id)
        if (!result.ok) {
          const messages: Record<string, string> = {
            invalid_input: "Este convite não é válido.",
            unauthorized: "Sua sessão de gestão expirou. Entre novamente.",
            service_unavailable: "Não foi possível revogar o convite agora.",
            rate_limited: "Aguarde um pouco antes de tentar novamente.",
            link_unavailable: "O link não está disponível.",
            not_replaceable: "Este convite não pode ser substituído.",
            not_revocable: "Este convite não está mais pendente.",
          }
          setActionError(messages[result.code] ?? "Não foi possível revogar o convite.")
          setRevokeConfirmationOpen(false)
          return
        }

        setRevokeConfirmationOpen(false)
        onOpenChange(false)
      } catch {
        setActionError("Não foi possível concluir a solicitação. Tente novamente.")
        setRevokeConfirmationOpen(false)
      }
    })
  }

  const displayedInvite = replacement?.invite ?? invite
  const canReplace = invite?.status === "pending" || invite?.status === "expired"
  const canRevoke = invite?.status === "pending" && !replacement

  return (
    <>
      <Sheet open={Boolean(invite)} onOpenChange={requestClose}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="data-[side=right]:w-full! data-[side=right]:sm:max-w-lg! gap-0 p-0 motion-reduce:animate-none motion-reduce:transition-none motion-reduce:duration-0"
        >
          {displayedInvite && (
            <motion.div
              key={displayedInvite.id}
              initial={shouldReduceMotion ? false : { opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.26, ease: "easeOut" }}
              className="flex h-full flex-col"
            >
              <SheetHeader className="gap-3 border-b border-border/70 px-6 pt-7 pb-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <LuExternalLink aria-hidden="true" className="size-5" />
                    </span>
                    <div className="space-y-1">
                      <p className="text-[0.625rem] font-semibold tracking-[0.13em] text-muted-foreground uppercase">
                        Detalhes do convite
                      </p>
                      <SheetTitle className="text-lg font-semibold tracking-tight">
                        {replacement ? "Convite substituído" : "Acesso da plataforma"}
                      </SheetTitle>
                    </div>
                  </div>
                  <SheetClose
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Fechar detalhes do convite"
                      />
                    }
                  >
                    <LuX aria-hidden="true" />
                  </SheetClose>
                </div>
                <SheetDescription className="max-w-sm text-sm leading-6">
                  {replacement
                    ? "O convite anterior foi invalidado. Copie o novo link para compartilhá-lo."
                    : "Confira o destinatário e o prazo deste convite."}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
                <section className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground shadow-sm ring-1 ring-border/70">
                      {displayedInvite.email ? (
                        <LuAtSign aria-hidden="true" className="size-4" />
                      ) : (
                        <LuUsers aria-hidden="true" className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">Destinatário</p>
                      <p className="mt-1 text-sm font-medium break-all">
                        {getInviteRecipient(displayedInvite)}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {inviteStatusLabels[displayedInvite.status]}
                    </Badge>
                  </div>
                </section>

                {(displayedInvite.status === "redeemed" ||
                  displayedInvite.status === "revoked") && (
                  <motion.section
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 7 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="rounded-2xl border border-border/70 p-4"
                  >
                    {displayedInvite.status === "redeemed" ? (
                      <div className="flex items-start gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <LuStore aria-hidden="true" className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">
                            Restaurante vinculado
                          </p>
                          <p className="mt-1 truncate text-sm font-medium">
                            {displayedInvite.restaurantName ??
                              "Registro não disponível"}
                          </p>
                          {displayedInvite.redeemedAt && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Resgatado em {formatInviteDate(displayedInvite.redeemedAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <LuX aria-hidden="true" className="size-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Revogado em
                          </p>
                          <p className="mt-1 text-sm font-medium">
                            {formatInviteDate(displayedInvite.revokedAt)}
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.section>
                )}

                {replacement ? (
                  <motion.section
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="space-y-3"
                  >
                    <Alert className="rounded-xl border-primary/20 bg-primary/5">
                      <LuCheck aria-hidden="true" />
                      <AlertTitle>Substituição concluída</AlertTitle>
                      <AlertDescription>
                        O link anterior não pode mais ser usado.
                      </AlertDescription>
                    </Alert>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold">Novo link</p>
                      <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/30 p-2">
                        <code className="min-w-0 flex-1 truncate px-2 text-xs text-muted-foreground">
                          {replacement.link}
                        </code>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={copyReplacementLink}
                        >
                          {copyState === "copied" ? (
                            <LuCheck aria-hidden="true" />
                          ) : (
                            <LuCopy aria-hidden="true" />
                          )}
                          {copyState === "copied" ? "Copiado" : "Copiar"}
                        </Button>
                      </div>
                      {copyState === "error" && (
                        <p className="text-xs text-destructive" role="status">
                          Não foi possível copiar. Selecione e copie o link acima.
                        </p>
                      )}
                    </div>
                  </motion.section>
                ) : replacementMode ? (
                  <motion.form
                    id="replace-invite-form"
                    key="replace-form"
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    onSubmit={handleReplace}
                    className="space-y-5"
                  >
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold">Novo convite</h3>
                      <p className="text-xs text-muted-foreground">
                        A substituição invalida o link atual imediatamente.
                      </p>
                    </div>
                    <Field>
                      <FieldLabel htmlFor="replace-invite-email">
                        E-mail do destinatário
                      </FieldLabel>
                      <Input
                        id="replace-invite-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.currentTarget.value)}
                        placeholder="nome@restaurante.com.br"
                        className="h-10 rounded-xl"
                      />
                      <FieldDescription>
                        Opcional. Deixe vazio para aceitar qualquer e-mail.
                      </FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="replace-invite-days">
                        Validade em dias
                      </FieldLabel>
                      <Input
                        id="replace-invite-days"
                        type="number"
                        min={1}
                        max={30}
                        step={1}
                        value={validDays}
                        onChange={(event) => setValidDays(event.currentTarget.value)}
                        className="h-10 rounded-xl"
                      />
                      <FieldDescription>Escolha de 1 a 30 dias.</FieldDescription>
                    </Field>
                    {actionError && (
                      <Alert className="rounded-xl border-destructive/25 bg-destructive/5 text-destructive">
                        <AlertTitle>Não foi possível substituir</AlertTitle>
                        <AlertDescription>{actionError}</AlertDescription>
                      </Alert>
                    )}
                  </motion.form>
                ) : (
                  <section className="space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold">Prazo e atividade</h3>
                      <p className="text-xs text-muted-foreground">
                        Período de criação e validade do convite.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border/70 p-4">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <LuClock3 aria-hidden="true" className="size-4" />
                          <span className="text-xs">Criado em</span>
                        </div>
                        <p className="mt-3 text-sm font-medium">
                          {formatInviteDate(displayedInvite.createdAt)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/70 p-4">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <LuCalendarClock aria-hidden="true" className="size-4" />
                          <span className="text-xs">Válido até</span>
                        </div>
                        <p className="mt-3 text-sm font-medium">
                          {formatInviteDate(displayedInvite.expiresAt)}
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                {actionError && !replacementMode && !replacement && (
                  <Alert className="rounded-xl border-destructive/25 bg-destructive/5 text-destructive">
                    <AlertTitle>
                      {retryBlocked
                        ? "Substituição concluída sem link recuperável"
                        : "Ação não concluída"}
                    </AlertTitle>
                    <AlertDescription>{actionError}</AlertDescription>
                  </Alert>
                )}
              </div>

              <SheetFooter className="border-t border-border/70 px-6 py-5">
                {replacementMode ? (
                  <div className="flex w-full gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 flex-1 rounded-xl"
                      disabled={isPending}
                      onClick={() => {
                        setReplacementMode(false)
                        setActionError("")
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      form="replace-invite-form"
                      disabled={isPending}
                      className="h-10 flex-1 rounded-xl"
                    >
                      {isPending ? "Substituindo…" : "Gerar novo link"}
                    </Button>
                  </div>
                ) : retryBlocked ? (
                  <Button
                    variant="outline"
                    className="h-10 w-full rounded-xl"
                    onClick={() => onOpenChange(false)}
                  >
                    Fechar e atualizar detalhes
                  </Button>
                ) : replacement ? (
                  <Button
                    className="h-10 w-full rounded-xl"
                    onClick={() => requestClose(false)}
                  >
                    Concluir
                  </Button>
                ) : (
                  <div className="flex w-full gap-2">
                    {canRevoke && (
                      <Button
                        variant="outline"
                        className="h-10 rounded-xl text-destructive hover:text-destructive"
                        disabled={isPending}
                        onClick={() => setRevokeConfirmationOpen(true)}
                      >
                        Revogar
                      </Button>
                    )}
                    {canReplace ? (
                      <motion.div
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.985 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="flex-1"
                      >
                        <Button
                          className="h-10 w-full rounded-xl"
                          onClick={() => {
                            setEmail(invite?.email ?? "")
                            setValidDays("7")
                            setReplacementMode(true)
                          }}
                        >
                          <LuMailPlus aria-hidden="true" />
                          Gerar novo convite
                        </Button>
                      </motion.div>
                    ) : (
                      <Button
                        variant="outline"
                        className="h-10 flex-1 rounded-xl"
                        onClick={() => invite && onCreateFromInvite(invite)}
                      >
                        <LuMailPlus aria-hidden="true" />
                        Criar outro convite
                      </Button>
                    )}
                  </div>
                )}
              </SheetFooter>
            </motion.div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={revokeConfirmationOpen}
        onOpenChange={setRevokeConfirmationOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar este convite?</AlertDialogTitle>
            <AlertDialogDescription>
              O link deixará de funcionar imediatamente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Manter convite</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={handleRevoke}
            >
              {isPending ? "Revogando…" : "Revogar convite"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={discardConfirmationOpen}
        onOpenChange={setDiscardConfirmationOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar o novo link?</AlertDialogTitle>
            <AlertDialogDescription>
              Este link é exibido uma única vez. Ao fechá-lo sem copiar, será necessário gerar outra substituição.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar aqui</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setDiscardConfirmationOpen(false)
                onOpenChange(false)
              }}
            >
              Descartar link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
