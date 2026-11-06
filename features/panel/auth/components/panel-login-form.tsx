"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { LuArrowRight, LuMail, LuTriangleAlert } from "react-icons/lu"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { PasswordInput } from "@/features/admin/auth/components/password-input"
import { authFormVariants, authItemVariants } from "@/features/admin/auth/components/auth-motion"
import { panelLoginSchema } from "@/features/panel/auth/schema"
import { getPanelAuthFeedback, initialPanelAuthFormState, type PanelAuthField, type PanelAuthFormState } from "@/features/panel/auth/state"
import { loginPanelAction } from "@/app/painel/(auth)/actions"

function getZodFieldErrors(issues: ReadonlyArray<{ path: readonly PropertyKey[]; message: string }>) {
  const errors: Partial<Record<PanelAuthField, string[]>> = {}
  for (const issue of issues) {
    const field = issue.path[0]
    if (field !== "email" && field !== "password") continue
    errors[field] ??= []
    errors[field]?.push(issue.message)
  }
  return errors
}

export function PanelLoginForm({ publicBasePath }: { publicBasePath: "" | "/painel" }) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(loginPanelAction, initialPanelAuthFormState)
  const [clientErrors, setClientErrors] = useState<Partial<Record<PanelAuthField, string[]>>>({})
  const handledState = useRef<PanelAuthFormState | null>(null)

  useEffect(() => {
    if (handledState.current === state) return
    if (state.status === "success") {
      handledState.current = state
      toast.add({ title: "Acesso autorizado", description: "Abrindo seu painel.", type: "success" })
      router.replace(state.destination)
      return
    }
    if (state.status === "feedback") {
      handledState.current = state
      const feedback = getPanelAuthFeedback(state.code)
      toast.add({ title: feedback.title, description: feedback.description, type: "error" })
    }
  }, [router, state])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget)
    const parsed = panelLoginSchema.safeParse({ email: data.get("email"), password: data.get("password") })
    if (!parsed.success) {
      event.preventDefault()
      setClientErrors(getZodFieldErrors(parsed.error.issues))
      toast.add({ title: "Revise seus dados", description: "Confira os campos destacados antes de continuar.", type: "error" })
      return
    }
    setClientErrors({})
  }

  const fieldErrors = (field: PanelAuthField) => clientErrors[field] ?? (state.status === "invalid" ? state.fieldErrors[field] ?? [] : [])
  const emailErrors = fieldErrors("email")
  const passwordErrors = fieldErrors("password")
  const feedback = state.status === "feedback" ? getPanelAuthFeedback(state.code) : null

  return (
    <motion.form action={formAction} onSubmit={handleSubmit} noValidate aria-busy={pending} variants={authFormVariants} className="space-y-5">
      {feedback ? (
        <motion.div variants={authItemVariants}>
          <Alert variant="destructive">
            <LuTriangleAlert aria-hidden="true" />
            <AlertTitle>{feedback.title}</AlertTitle>
            <AlertDescription>{feedback.description}</AlertDescription>
          </Alert>
        </motion.div>
      ) : null}
      <motion.div variants={authItemVariants}>
        <Field data-invalid={emailErrors.length > 0 || undefined}>
          <FieldLabel htmlFor="panel-email">Email</FieldLabel>
          <InputGroup className="h-11 rounded-lg bg-background/70" aria-invalid={emailErrors.length > 0 || undefined}>
            <InputGroupAddon align="inline-start"><InputGroupText><LuMail aria-hidden="true" /></InputGroupText></InputGroupAddon>
            <InputGroupInput id="panel-email" name="email" type="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} required aria-invalid={emailErrors.length > 0 || undefined} aria-describedby={emailErrors.length ? "panel-email-error" : undefined} className="h-11" />
          </InputGroup>
          <FieldDescription>Use o e-mail da sua conta.</FieldDescription>
          <FieldError id="panel-email-error" errors={emailErrors.map((message) => ({ message }))} />
        </Field>
      </motion.div>
      <motion.div variants={authItemVariants}>
        <PasswordInput id="panel-password" name="password" label="Senha" autoComplete="current-password" errors={passwordErrors} />
      </motion.div>
      <motion.div variants={authItemVariants} whileHover={{ y: -1 }} whileTap={{ scale: 0.985 }} transition={{ duration: 0.18, ease: "easeOut" }}>
        <Button type="submit" size="lg" disabled={pending} className="h-11 w-full rounded-lg">
          {pending ? <><Spinner aria-label="Verificando acesso" />Verificando acesso...</> : <>Entrar<LuArrowRight data-icon="inline-end" aria-hidden="true" /></>}
        </Button>
      </motion.div>
      <motion.p variants={authItemVariants} className="text-center text-sm text-muted-foreground">
        Primeiro acesso?{" "}
        <Link href={publicBasePath + "/criar-conta"} className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary">
          Criar conta
        </Link>
      </motion.p>
    </motion.form>
  )
}
