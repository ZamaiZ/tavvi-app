"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { motion, useReducedMotion } from "motion/react"
import {
  LuCalendarClock,
  LuCheck,
  LuCopy,
  LuMail,
  LuMailPlus,
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
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { createAdminInviteAction } from "@/features/admin/invites/actions"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type InviteCreateSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialEmail?: string
}

export function InviteCreateSheet({
  open,
  onOpenChange,
  initialEmail,
}: InviteCreateSheetProps) {
  const shouldReduceMotion = useReducedMotion()
  const [isPending, startTransition] = useTransition()
  const idempotencyKey = useRef<string | null>(null)
  const [email, setEmail] = useState(initialEmail ?? "")
  const [validDays, setValidDays] = useState("7")
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [emailError, setEmailError] = useState("")
  const [validityError, setValidityError] = useState("")
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle"
  )
  const [actionError, setActionError] = useState("")
  const [retryBlocked, setRetryBlocked] = useState(false)
  const [discardConfirmationOpen, setDiscardConfirmationOpen] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    setEmail(initialEmail ?? "")
    setValidDays("7")
    setGeneratedLink(null)
    setEmailError("")
    setValidityError("")
    setCopyState("idle")
    setActionError("")
    setRetryBlocked(false)
  }, [initialEmail, open])

  function requestClose(nextOpen: boolean) {
    if (!nextOpen && isPending) return
    if (!nextOpen && generatedLink && copyState !== "copied") {
      setDiscardConfirmationOpen(true)
      return
    }
    onOpenChange(nextOpen)
  }

  function discardLink() {
    setGeneratedLink(null)
    setActionError("")
    setDiscardConfirmationOpen(false)
    onOpenChange(false)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (retryBlocked) return
    const normalizedEmail = email.trim()
    const emailIsValid =
      !normalizedEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    const days = Number(validDays)
    const validityIsValid = Number.isInteger(days) && days >= 1 && days <= 30

    setEmailError(
      emailIsValid ? "" : "Informe um e-mail válido ou deixe o campo vazio."
    )
    setValidityError(
      validityIsValid ? "" : "Escolha um prazo entre 1 e 30 dias."
    )

    if (!emailIsValid || !validityIsValid) {
      return
    }

    setActionError("")
    startTransition(async () => {
      try {
        const result = await createAdminInviteAction({
          email: normalizedEmail,
          validDays: days,
          idempotencyKey:
            idempotencyKey.current ??
            (idempotencyKey.current = globalThis.crypto.randomUUID()),
        })

        if (!result.ok) {
          const errorMessages: Record<string, string> = {
            invalid_input: "Revise os dados informados e tente novamente.",
            unauthorized: "Sua sessão de gestão expirou. Entre novamente.",
            service_unavailable:
              "Não foi possível criar o convite agora. Tente novamente.",
            rate_limited:
              "Muitas operações em sequência. Aguarde um pouco e tente novamente.",
            link_unavailable:
              "O convite foi criado, mas o link não pode ser recuperado. Abra os detalhes e gere uma substituição.",
            not_replaceable: "Este convite não pode ser substituído.",
            not_revocable: "Este convite não pode ser revogado.",
          }
          setActionError(errorMessages[result.code] ?? "Não foi possível criar o convite.")
          setRetryBlocked(result.code === "link_unavailable")
          if (result.code === "link_unavailable") {
            idempotencyKey.current = null
          }
          return
        }

        idempotencyKey.current = null
        setGeneratedLink(result.link)
        setCopyState("idle")
      } catch {
        setActionError("Não foi possível concluir a solicitação. Tente novamente.")
      }
    })
  }

  async function handleCopyLink() {
    if (!generatedLink) {
      return
    }

    try {
      await navigator.clipboard.writeText(generatedLink)
      setCopyState("copied")
    } catch {
      setCopyState("error")
    }
  }

  return (
    <>
    <Sheet open={open} onOpenChange={requestClose}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="data-[side=right]:w-full! data-[side=right]:sm:max-w-lg! gap-0 p-0 motion-reduce:animate-none motion-reduce:transition-none motion-reduce:duration-0"
      >
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.26, ease: "easeOut" }}
          className="flex h-full flex-col"
        >
          <SheetHeader className="gap-3 border-b border-border/70 px-6 pt-7 pb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  {generatedLink ? (
                    <LuCheck aria-hidden="true" className="size-5" />
                  ) : (
                    <LuMailPlus aria-hidden="true" className="size-5" />
                  )}
                </span>
                <div className="space-y-1">
                  <p className="text-[0.625rem] font-semibold tracking-[0.13em] text-muted-foreground uppercase">
                    Convites da plataforma
                  </p>
                  <SheetTitle className="text-lg font-semibold tracking-tight">
                    {generatedLink ? "Convite criado" : "Novo convite"}
                  </SheetTitle>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Fechar criação de convite"
                onClick={() => requestClose(false)}
              >
                <LuX aria-hidden="true" />
              </Button>
            </div>
            <SheetDescription className="max-w-sm text-sm leading-6">
              {generatedLink
                ? "O convite está pronto para ser compartilhado."
                : "Defina o destinatário e por quanto tempo o link deve ficar disponível."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            {generatedLink ? (
              <motion.div
                key="success"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="space-y-5"
              >
                <Alert className="rounded-2xl border-primary/20 bg-primary/5">
                  <LuCheck aria-hidden="true" />
                  <AlertTitle>Convite criado</AlertTitle>
                  <AlertDescription>
                    O link já pode ser compartilhado com o destinatário.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <p className="text-xs font-semibold">Link do convite</p>
                  <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/30 p-2">
                    <code className="min-w-0 flex-1 truncate px-2 text-xs text-muted-foreground">
                      {generatedLink}
                    </code>
                    <motion.div
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                    >
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleCopyLink}
                      >
                        {copyState === "copied" ? (
                          <LuCheck aria-hidden="true" />
                        ) : (
                          <LuCopy aria-hidden="true" />
                        )}
                        {copyState === "copied" ? "Copiado" : "Copiar"}
                      </Button>
                    </motion.div>
                  </div>
                  {copyState === "error" && (
                    <p className="text-xs text-destructive" role="status">
                      Não foi possível copiar. Selecione e copie o link acima.
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-border/70 p-4">
                  <p className="text-xs text-muted-foreground">Destinatário</p>
                  <p className="mt-1 text-sm font-medium break-all">
                    {email.trim() || "Qualquer e-mail"}
                  </p>
                  <p className="mt-4 text-xs text-muted-foreground">Validade</p>
                  <p className="mt-1 text-sm font-medium">
                    {validDays} {Number(validDays) === 1 ? "dia" : "dias"}
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.form
                id="invite-create-form"
                key="form"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                onSubmit={handleSubmit}
                noValidate
                className="space-y-6"
              >
                <Field data-invalid={Boolean(emailError) || undefined}>
                  <FieldLabel htmlFor="invite-email">
                    E-mail do destinatário
                  </FieldLabel>
                  <div className="relative">
                    <LuMail
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      id="invite-email"
                      type="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      onChange={(event) => setEmail(event.currentTarget.value)}
                      placeholder="nome@restaurante.com.br"
                      value={email}
                      aria-invalid={Boolean(emailError) || undefined}
                      aria-describedby={
                        emailError
                          ? "invite-email-error"
                          : "invite-email-description"
                      }
                      className="h-11 rounded-xl bg-background pl-10"
                    />
                  </div>
                  <FieldDescription id="invite-email-description">
                    Opcional. Sem e-mail, qualquer pessoa com o link poderá
                    concluir o cadastro.
                  </FieldDescription>
                  <FieldError
                    id="invite-email-error"
                    errors={emailError ? [{ message: emailError }] : []}
                  />
                </Field>

                <Field data-invalid={Boolean(validityError) || undefined}>
                  <FieldLabel htmlFor="invite-valid-days">
                    Validade do convite
                  </FieldLabel>
                  <div className="relative">
                    <LuCalendarClock
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      id="invite-valid-days"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={30}
                      step={1}
                      onChange={(event) =>
                        setValidDays(event.currentTarget.value)
                      }
                      value={validDays}
                      aria-invalid={Boolean(validityError) || undefined}
                      aria-describedby={
                        validityError
                          ? "invite-valid-days-error"
                          : "invite-valid-days-description"
                      }
                      className="h-11 rounded-xl bg-background pl-10"
                    />
                  </div>
                  <FieldDescription id="invite-valid-days-description">
                    Escolha de 1 a 30 dias. O padrão é 7 dias.
                  </FieldDescription>
                  <FieldError
                    id="invite-valid-days-error"
                    errors={validityError ? [{ message: validityError }] : []}
                  />
                </Field>

                {actionError && (
                  <Alert className="rounded-xl border-destructive/25 bg-destructive/5 text-destructive">
                    <AlertTitle>
                      {retryBlocked
                        ? "Convite criado sem link recuperável"
                        : "Não foi possível criar o convite"}
                    </AlertTitle>
                    <AlertDescription>{actionError}</AlertDescription>
                  </Alert>
                )}

              </motion.form>
            )}
          </div>

          <SheetFooter className="border-t border-border/70 px-6 py-5">
            {generatedLink ? (
              <div className="w-full">
                <Button
                  className="h-10 w-full rounded-xl"
                  onClick={() => requestClose(false)}
                >
                  Concluir
                </Button>
              </div>
            ) : retryBlocked ? (
              <Button
                variant="outline"
                className="h-10 w-full rounded-xl"
                onClick={() => onOpenChange(false)}
              >
                Voltar para convites
              </Button>
            ) : (
              <motion.div
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.985 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="w-full"
              >
                <Button
                  type="submit"
                  form="invite-create-form"
                  disabled={isPending || retryBlocked}
                  className="h-10 w-full rounded-xl"
                >
                  {isPending ? (
                    <span className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current motion-reduce:animate-none" />
                  ) : (
                    <LuMailPlus aria-hidden="true" />
                  )}
                  {isPending ? "Criando convite…" : "Criar convite"}
                </Button>
              </motion.div>
            )}
          </SheetFooter>
        </motion.div>
      </SheetContent>
    </Sheet>
    <AlertDialog
      open={discardConfirmationOpen}
      onOpenChange={setDiscardConfirmationOpen}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Descartar o link do convite?</AlertDialogTitle>
          <AlertDialogDescription>
            Este link é exibido uma única vez. Se você fechar agora sem copiá-lo,
            será necessário gerar uma substituição.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Continuar aqui</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={discardLink}>
            Descartar link
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
