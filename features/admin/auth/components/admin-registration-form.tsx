"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  LuArrowRight,
  LuCircleCheck,
  LuMail,
  LuTriangleAlert,
  LuUserRound,
} from "react-icons/lu"
import { motion } from "motion/react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import {
  registerAdminAction,
  retryAdminClaimAction,
} from "@/app/admin/(auth)/actions"
import { PasswordInput } from "@/features/admin/auth/components/password-input"
import { adminRegistrationSchema } from "@/features/admin/auth/schema"
import {
  getAdminAuthFeedback,
  initialAdminAuthFormState,
  type AdminAuthField,
  type AdminAuthFormState,
} from "@/features/admin/auth/state"
import {
  authFormVariants,
  authItemVariants,
} from "@/features/admin/auth/components/auth-motion"

type AdminRegistrationFormProps = {
  mode: "create" | "resume-claim"
  publicBasePath: "" | "/admin"
}

function getZodFieldErrors(
  issues: ReadonlyArray<{ path: readonly PropertyKey[]; message: string }>
): Partial<Record<AdminAuthField, string[]>> {
  const errors: Partial<Record<AdminAuthField, string[]>> = {}

  for (const issue of issues) {
    const field = issue.path[0]

    if (
      field === "email" ||
      field === "password" ||
      field === "name" ||
      field === "passwordConfirmation"
    ) {
      errors[field] ??= []
      errors[field]?.push(issue.message)
    }
  }

  return errors
}

export function AdminRegistrationForm({
  mode,
  publicBasePath,
}: AdminRegistrationFormProps) {
  const router = useRouter()
  const action = mode === "create" ? registerAdminAction : retryAdminClaimAction
  const [state, formAction, pending] = useActionState(
    action,
    initialAdminAuthFormState
  )
  const [clientErrors, setClientErrors] = useState<
    Partial<Record<AdminAuthField, string[]>>
  >({})
  const handledState = useRef<AdminAuthFormState | null>(null)

  useEffect(() => {
    if (handledState.current === state) {
      return
    }

    if (state.status === "success") {
      handledState.current = state
      toast.add({
        title:
          state.kind === "registration"
            ? "Conta Admin criada"
            : "Ativação concluída",
        description: "Abrindo a área administrativa.",
        type: "success",
      })
      router.replace(state.destination)
      return
    }

    if (state.status === "feedback") {
      handledState.current = state
      const feedback = getAdminAuthFeedback(state.code)
      toast.add({
        title: feedback.title,
        description: feedback.description,
        type: "error",
      })

      if (
        state.code === "registration_closed" ||
        state.code === "claim_retryable"
      ) {
        router.refresh()
      }
    }
  }, [router, state])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (mode !== "create") {
      return
    }

    const formData = new FormData(event.currentTarget)
    const result = adminRegistrationSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      passwordConfirmation: formData.get("passwordConfirmation"),
    })

    if (!result.success) {
      event.preventDefault()
      setClientErrors(getZodFieldErrors(result.error.issues))
      toast.add({
        title: "Revise seus dados",
        description: "Confira os campos destacados antes de continuar.",
        type: "error",
      })
      return
    }

    setClientErrors({})
  }

  function fieldErrors(field: AdminAuthField) {
    const client = clientErrors[field]
    if (client) {
      return client
    }

    return state.status === "invalid" ? (state.fieldErrors[field] ?? []) : []
  }

  const feedback =
    state.status === "feedback" ? getAdminAuthFeedback(state.code) : null

  if (mode === "resume-claim") {
    return (
      <motion.div variants={authFormVariants} className="space-y-5">
        <motion.div variants={authItemVariants}>
          <Alert>
            <LuCircleCheck aria-hidden="true" />
            <AlertTitle>Sua conta já foi criada</AlertTitle>
            <AlertDescription>
              A ativação administrativa ficou pendente. Vamos tentar concluir
              somente essa etapa, sem criar outra conta.
            </AlertDescription>
          </Alert>
        </motion.div>

        {feedback && (
          <motion.div variants={authItemVariants}>
            <Alert variant="destructive">
              <LuTriangleAlert aria-hidden="true" />
              <AlertTitle>{feedback.title}</AlertTitle>
              <AlertDescription>{feedback.description}</AlertDescription>
            </Alert>
          </motion.div>
        )}

        <motion.form
          action={formAction}
          aria-busy={pending}
          variants={authItemVariants}
        >
          <motion.div
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.985 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <Button
              type="submit"
              size="lg"
              disabled={pending}
              className="h-11 w-full rounded-lg"
            >
              {pending ? (
                <>
                  <Spinner aria-label="Concluindo ativação" />
                  Concluindo ativação...
                </>
              ) : (
                <>
                  Tentar concluir ativação
                  <LuArrowRight data-icon="inline-end" aria-hidden="true" />
                </>
              )}
            </Button>
          </motion.div>
        </motion.form>

        <motion.p
          variants={authItemVariants}
          className="text-center text-sm text-muted-foreground"
        >
          Acessou esta página por engano?{" "}
          <Link
            href={publicBasePath + "/entrar"}
            className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
          >
            Ir para login
          </Link>
        </motion.p>
      </motion.div>
    )
  }

  const nameErrors = fieldErrors("name")
  const emailErrors = fieldErrors("email")
  const passwordErrors = fieldErrors("password")
  const confirmationErrors = fieldErrors("passwordConfirmation")

  return (
    <motion.form
      action={formAction}
      onSubmit={handleSubmit}
      noValidate
      aria-busy={pending}
      variants={authFormVariants}
      className="space-y-4"
    >
      {feedback && (
        <motion.div variants={authItemVariants}>
          <Alert variant="destructive">
            <LuTriangleAlert aria-hidden="true" />
            <AlertTitle>{feedback.title}</AlertTitle>
            <AlertDescription>{feedback.description}</AlertDescription>
          </Alert>
        </motion.div>
      )}

      <motion.div variants={authItemVariants}>
        <Field data-invalid={nameErrors.length > 0 || undefined}>
          <FieldLabel htmlFor="admin-name">Nome</FieldLabel>
          <InputGroup
            className="h-11 rounded-lg bg-background/70"
            aria-invalid={nameErrors.length > 0 || undefined}
          >
            <InputGroupAddon align="inline-start">
              <InputGroupText>
                <LuUserRound aria-hidden="true" />
              </InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              id="admin-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
              aria-invalid={nameErrors.length > 0 || undefined}
              aria-describedby={
                nameErrors.length ? "admin-name-error" : undefined
              }
              className="h-11"
            />
          </InputGroup>
          <FieldError
            id="admin-name-error"
            errors={nameErrors.map((message) => ({ message }))}
          />
        </Field>
      </motion.div>

      <motion.div variants={authItemVariants}>
        <Field data-invalid={emailErrors.length > 0 || undefined}>
          <FieldLabel htmlFor="admin-email">Email</FieldLabel>
          <InputGroup
            className="h-11 rounded-lg bg-background/70"
            aria-invalid={emailErrors.length > 0 || undefined}
          >
            <InputGroupAddon align="inline-start">
              <InputGroupText>
                <LuMail aria-hidden="true" />
              </InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              id="admin-email"
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              aria-invalid={emailErrors.length > 0 || undefined}
              aria-describedby={
                emailErrors.length ? "admin-email-error" : undefined
              }
              className="h-11"
            />
          </InputGroup>
          <FieldError
            id="admin-email-error"
            errors={emailErrors.map((message) => ({ message }))}
          />
        </Field>
      </motion.div>

      <motion.div variants={authItemVariants}>
        <PasswordInput
          id="admin-password"
          name="password"
          label="Senha"
          autoComplete="new-password"
          minLength={8}
          errors={passwordErrors}
        />
      </motion.div>

      <motion.div variants={authItemVariants}>
        <PasswordInput
          id="admin-password-confirmation"
          name="passwordConfirmation"
          label="Confirmar senha"
          autoComplete="new-password"
          minLength={8}
          errors={confirmationErrors}
        />
      </motion.div>

      <motion.div variants={authItemVariants} className="space-y-4 pt-1">
        <motion.div
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.985 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <Button
            type="submit"
            size="lg"
            disabled={pending}
            className="h-11 w-full rounded-lg"
          >
            {pending ? (
              <>
                <Spinner aria-label="Criando conta" />
                Criando conta...
              </>
            ) : (
              <>
                Criar conta Admin
                <LuArrowRight data-icon="inline-end" aria-hidden="true" />
              </>
            )}
          </Button>
        </motion.div>
        <motion.p className="text-center text-sm text-muted-foreground">
          Já possui acesso?{" "}
          <Link
            href={publicBasePath + "/entrar"}
            className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary"
          >
            <motion.span whileHover={{ x: 2 }} transition={{ duration: 0.18 }}>
              Entrar
            </motion.span>
          </Link>
        </motion.p>
      </motion.div>
    </motion.form>
  )
}
