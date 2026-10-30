"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LuArrowRight, LuMail, LuTriangleAlert } from "react-icons/lu"
import { motion } from "motion/react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { loginAdminAction } from "@/app/admin/(auth)/actions"
import { PasswordInput } from "@/features/admin/auth/components/password-input"
import { adminLoginSchema } from "@/features/admin/auth/schema"
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

type AdminLoginFormProps = {
  nextPath: string
  publicBasePath: "" | "/admin"
  statusMessage?: string
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

export function AdminLoginForm({
  nextPath,
  publicBasePath,
  statusMessage,
}: AdminLoginFormProps) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    loginAdminAction,
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
        title: "Acesso autorizado",
        description: "Abrindo sua área de gestão.",
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
    }
  }, [router, state])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget)
    const result = adminLoginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
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

  const emailErrors = fieldErrors("email")
  const passwordErrors = fieldErrors("password")
  const feedback =
    state.status === "feedback" ? getAdminAuthFeedback(state.code) : null

  return (
    <motion.form
      action={formAction}
      onSubmit={handleSubmit}
      noValidate
      aria-busy={pending}
      variants={authFormVariants}
      className="space-y-5"
    >
      {(feedback || statusMessage) && (
        <motion.div variants={authItemVariants}>
          <Alert variant="destructive">
            <LuTriangleAlert aria-hidden="true" />
            <AlertTitle>
              {feedback?.title ?? "Acesso temporariamente indisponível"}
            </AlertTitle>
            <AlertDescription>
              {feedback?.description ??
                "Não foi possível verificar a sessão. Tente entrar novamente."}
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

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
          <FieldDescription>Use o e-mail da sua conta.</FieldDescription>
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
          autoComplete="current-password"
          errors={passwordErrors}
        />
      </motion.div>

      <input type="hidden" name="next" value={nextPath} />

      <motion.div
        variants={authItemVariants}
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
              <Spinner aria-label="Verificando acesso" />
              Verificando acesso...
            </>
          ) : (
            <>
              Entrar
              <LuArrowRight data-icon="inline-end" aria-hidden="true" />
            </>
          )}
        </Button>
      </motion.div>

      <motion.p
        variants={authItemVariants}
        className="text-center text-sm text-muted-foreground"
      >
        Primeiro acesso?{" "}
        <Link
          href={publicBasePath + "/criar-conta"}
          className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary"
        >
          <motion.span whileHover={{ x: 2 }} transition={{ duration: 0.18 }}>
            Criar conta
          </motion.span>
        </Link>
      </motion.p>
    </motion.form>
  )
}
