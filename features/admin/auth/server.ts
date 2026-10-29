import "server-only"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import type {
  AdminAuthFeedbackCode,
  AdminAuthOperationResult,
} from "@/features/admin/auth/state"
import type {
  AdminLoginInput,
  AdminRegistrationInput,
} from "@/features/admin/auth/schema"

type AdminRegistrationViewState =
  | "open"
  | "closed"
  | "resume-claim"
  | "already-admin"
  | "unavailable"

type AdminSupabaseClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>

function isRateLimited(code: string, message: string) {
  return (
    code.includes("rate") ||
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("too many attempts")
  )
}

function isExistingEmail(code: string, message: string) {
  return (
    code.includes("user_already_exists") ||
    message.includes("user already registered") ||
    message.includes("already been registered")
  )
}

function isInvalidCredentials(code: string, message: string) {
  return (
    code.includes("invalid_credentials") ||
    message.includes("invalid login credentials") ||
    message.includes("invalid credentials") ||
    message.includes("email not confirmed")
  )
}

function isNetworkFailure(message: string) {
  return (
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("failed to fetch") ||
    message.includes("timeout")
  )
}

function mapAuthError(error: { code?: string; message: string }): AdminAuthFeedbackCode {
  const code = error.code?.toLowerCase() ?? ""
  const message = error.message.toLowerCase()

  if (isRateLimited(code, message)) {
    return "rate_limited"
  }

  if (isExistingEmail(code, message)) {
    return "email_unavailable"
  }

  if (isInvalidCredentials(code, message)) {
    return "invalid_credentials"
  }

  if (isNetworkFailure(message)) {
    return "service_unavailable"
  }

  return "unexpected"
}

async function readRegistrationOpen(
  supabase: AdminSupabaseClient
): Promise<boolean | null> {
  try {
    const { data, error } = await supabase.rpc("admin_registration_open")

    if (error || typeof data !== "boolean") {
      return null
    }

    return data
  } catch {
    return null
  }
}

async function signOutAdminLocally(supabase: AdminSupabaseClient) {
  try {
    await supabase.auth.signOut({ scope: "local" })
  } catch {
    // A rejected login must never be treated as an authorized Admin session.
  }
}

export async function getAdminRegistrationViewState(): Promise<AdminRegistrationViewState> {
  try {
    const supabase = await createSupabaseServerClient("admin")
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError) {
      return "unavailable"
    }

    if (session) {
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
      const claims = claimsData?.claims

      if (claimsError || !claims?.sub) {
        return "unavailable"
      }

      const { data: isAdmin, error: roleError } =
        await supabase.rpc("is_platform_admin")

      if (roleError || typeof isAdmin !== "boolean") {
        return "unavailable"
      }

      if (isAdmin) {
        return "already-admin"
      }
    }

    const registrationOpen = await readRegistrationOpen(supabase)

    if (registrationOpen === null) {
      return "unavailable"
    }

    if (!registrationOpen) {
      return "closed"
    }

    return session ? "resume-claim" : "open"
  } catch {
    return "unavailable"
  }
}

export async function signInPlatformAdmin(
  input: AdminLoginInput
): Promise<AdminAuthOperationResult> {
  try {
    const supabase = await createSupabaseServerClient("admin")
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    })

    if (signInError) {
      return { status: "feedback", code: mapAuthError(signInError) }
    }

    const { data: isAdmin, error: roleError } =
      await supabase.rpc("is_platform_admin")

    if (roleError || typeof isAdmin !== "boolean") {
      await signOutAdminLocally(supabase)
      return { status: "feedback", code: "service_unavailable" }
    }

    if (!isAdmin) {
      await signOutAdminLocally(supabase)
      return { status: "feedback", code: "invalid_credentials" }
    }

    return { status: "success" }
  } catch {
    return { status: "feedback", code: "service_unavailable" }
  }
}

export async function registerFirstPlatformAdmin(
  input: Omit<AdminRegistrationInput, "passwordConfirmation">
): Promise<AdminAuthOperationResult> {
  try {
    const supabase = await createSupabaseServerClient("admin")
    const registrationOpen = await readRegistrationOpen(supabase)

    if (registrationOpen === null) {
      return { status: "feedback", code: "service_unavailable" }
    }

    if (!registrationOpen) {
      return { status: "feedback", code: "registration_closed" }
    }

    let signUpResult

    try {
      signUpResult = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            display_name: input.name,
          },
        },
      })
    } catch {
      return { status: "feedback", code: "service_unavailable" }
    }

    if (signUpResult.error) {
      return {
        status: "feedback",
        code: mapAuthError(signUpResult.error),
      }
    }

    if (!signUpResult.data.user || !signUpResult.data.session) {
      return { status: "feedback", code: "registration_incomplete" }
    }

    let claimResult

    try {
      claimResult = await supabase.rpc("claim_platform_admin")
    } catch {
      return { status: "feedback", code: "claim_retryable" }
    }

    if (claimResult.error) {
      return { status: "feedback", code: "claim_retryable" }
    }

    if (claimResult.data === false) {
      await signOutAdminLocally(supabase)
      return { status: "feedback", code: "registration_closed" }
    }

    if (claimResult.data !== true) {
      return { status: "feedback", code: "claim_retryable" }
    }

    return { status: "success" }
  } catch {
    return { status: "feedback", code: "service_unavailable" }
  }
}

export async function retryPlatformAdminClaim(): Promise<AdminAuthOperationResult> {
  try {
    const supabase = await createSupabaseServerClient("admin")
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return { status: "feedback", code: "registration_incomplete" }
    }

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
    const claims = claimsData?.claims

    if (claimsError || !claims?.sub) {
      return { status: "feedback", code: "service_unavailable" }
    }

    let claimResult

    try {
      claimResult = await supabase.rpc("claim_platform_admin")
    } catch {
      return { status: "feedback", code: "claim_retryable" }
    }

    if (claimResult.error) {
      return { status: "feedback", code: "claim_retryable" }
    }

    if (claimResult.data === false) {
      await signOutAdminLocally(supabase)
      return { status: "feedback", code: "registration_closed" }
    }

    if (claimResult.data !== true) {
      return { status: "feedback", code: "claim_retryable" }
    }

    return { status: "success" }
  } catch {
    return { status: "feedback", code: "service_unavailable" }
  }
}

export async function signOutPlatformAdmin() {
  const supabase = await createSupabaseServerClient("admin")
  await signOutAdminLocally(supabase)
}
