"use client"

import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import {
  LuArrowLeft,
  LuCalendarClock,
  LuCheck,
  LuCopy,
  LuMail,
  LuMailPlus,
  LuSparkles,
  LuX,
} from "react-icons/lu"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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
  const [email, setEmail] = useState(initialEmail ?? "")
  const [validDays, setValidDays] = useState("7")
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [emailError, setEmailError] = useState("")
  const [validityError, setValidityError] = useState("")
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle"
  )

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
  }, [initialEmail, open])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
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

    setGeneratedLink(
      `https://tavvi.app/convite/demo-${Math.random().toString(36).slice(2, 10)}`
    )
    setCopyState("idle")
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
    <Sheet open={open} onOpenChange={(nextOpen) => onOpenChange(nextOpen)}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 p-0 motion-reduce:animate-none motion-reduce:transition-none motion-reduce:duration-0 sm:max-w-lg"
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
                    <LuSparkles aria-hidden="true" className="size-5" />
                  ) : (
                    <LuMailPlus aria-hidden="true" className="size-5" />
                  )}
                </span>
                <div className="space-y-1">
                  <p className="text-[0.625rem] font-semibold tracking-[0.13em] text-muted-foreground uppercase">
                    Convites da plataforma
                  </p>
                  <SheetTitle className="text-lg font-semibold tracking-tight">
                    {generatedLink ? "Prévia do convite" : "Novo convite"}
                  </SheetTitle>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Fechar criação de convite"
                onClick={() => onOpenChange(false)}
              >
                <LuX aria-hidden="true" />
              </Button>
            </div>
            <SheetDescription className="max-w-sm text-sm leading-6">
              {generatedLink
                ? "O link abaixo é apenas demonstrativo e não ativa nenhum acesso."
                : "Defina o destinatário e por quanto tempo o link deve ficar disponível."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            {generatedLink ? (
              <motion.div
                key="preview"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="space-y-5"
              >
                <Alert className="rounded-2xl border-primary/20 bg-primary/5">
                  <LuCheck aria-hidden="true" />
                  <AlertTitle>Convite demonstrativo preparado</AlertTitle>
                  <AlertDescription>
                    Nenhuma mensagem foi enviada e nenhum convite foi salvo.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <p className="text-xs font-semibold">Link de demonstração</p>
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

                <Alert className="rounded-xl border-dashed bg-muted/20">
                  <LuSparkles aria-hidden="true" />
                  <AlertTitle>Prévia visual</AlertTitle>
                  <AlertDescription>
                    Esta etapa não cria nem envia um convite real.
                  </AlertDescription>
                </Alert>
              </motion.form>
            )}
          </div>

          <SheetFooter className="border-t border-border/70 px-6 py-5">
            {generatedLink ? (
              <div className="flex w-full gap-2">
                <Button
                  variant="outline"
                  className="h-10 flex-1 rounded-xl"
                  onClick={() => {
                    setGeneratedLink(null)
                    setCopyState("idle")
                  }}
                >
                  <LuArrowLeft aria-hidden="true" />
                  Editar dados
                </Button>
                <Button
                  className="h-10 flex-1 rounded-xl"
                  onClick={() => onOpenChange(false)}
                >
                  Concluir
                </Button>
              </div>
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
                  className="h-10 w-full rounded-xl"
                >
                  <LuMailPlus aria-hidden="true" />
                  Gerar prévia
                </Button>
              </motion.div>
            )}
          </SheetFooter>
        </motion.div>
      </SheetContent>
    </Sheet>
  )
}
