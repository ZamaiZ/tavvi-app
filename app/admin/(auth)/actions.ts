"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import {
  adminLoginSchema,
  adminRegistrationSchema,
} from "@/features/admin/auth/schema"
import {
  type AdminAuthField,
  type AdminAuthFormState,
} from "@/features/admin/auth/state"
import {
  getAdminHomePath,
  getAdminPublicBasePath,
  normalizeAdminNextPath,
} from "@/features/admin/auth/navigation"
import {
  registerFirstPlatformAdmin,
  retryPlatformAdminClaim,
  signInPlatformAdmin,
  signOutPlatformAdmin,
} from "@/features/admin/auth/server"

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

function toFieldErrors(
  issues: ReadonlyArray<{ path: readonly PropertyKey[]; message: string }>
): Partial<Record<AdminAuthField, string[]>> {
  const fieldErrors: Partial<Record<AdminAuthField, string[]>> = {}
  const knownFields: AdminAuthField[] = [
    "name",
    "email",
    "password",
    "passwordConfirmation",
  ]

  for (const issue of issues) {
    const field = issue.path[0]

    if (typeof field !== "string" || !knownFields.includes(field as AdminAuthField)) {
      continue
    }

    const knownField = field as AdminAuthField
    fieldErrors[knownField] ??= []
    fieldErrors[knownField]?.push(issue.message)
  }

  return fieldErrors
}

async function getRequestAdminBasePath(): Promise<"" | "/admin"> {
  const requestHeaders = await headers()
  const hostHeader =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    ""
  const hostname = hostHeader.split(",")[0].trim().split(":")[0]

  return getAdminPublicBasePath(hostname)
}

export async function loginAdminAction(
  _previousState: AdminAuthFormState,
  formData: FormData
): Promise<AdminAuthFormState> {
  const parsed = adminLoginSchema.safeParse({
    email: getString(formData, "email"),
    password: getString(formData, "password"),
  })

  if (!parsed.success) {
    return {
      status: "invalid",
      fieldErrors: toFieldErrors(parsed.error.issues),
    }
  }

  const result = await signInPlatformAdmin(parsed.data)

  if (result.status === "feedback") {
    return result
  }

  const publicBasePath = await getRequestAdminBasePath()
  const destination =
    normalizeAdminNextPath(getString(formData, "next"), publicBasePath) ??
    getAdminHomePath(publicBasePath)

  return {
    status: "success",
    kind: "login",
    destination,
  }
}

export async function registerAdminAction(
  _previousState: AdminAuthFormState,
  formData: FormData
): Promise<AdminAuthFormState> {
  const parsed = adminRegistrationSchema.safeParse({
    name: getString(formData, "name"),
    email: getString(formData, "email"),
    password: getString(formData, "password"),
    passwordConfirmation: getString(formData, "passwordConfirmation"),
  })

  if (!parsed.success) {
    return {
      status: "invalid",
      fieldErrors: toFieldErrors(parsed.error.issues),
    }
  }

  const { passwordConfirmation: _confirmation, ...input } = parsed.data
  const result = await registerFirstPlatformAdmin(input)

  if (result.status === "feedback") {
    return result
  }

  const publicBasePath = await getRequestAdminBasePath()

  return {
    status: "success",
    kind: "registration",
    destination: getAdminHomePath(publicBasePath),
  }
}

export async function retryAdminClaimAction(
  _previousState: AdminAuthFormState,
  _formData: FormData
): Promise<AdminAuthFormState> {
  const result = await retryPlatformAdminClaim()

  if (result.status === "feedback") {
    return result
  }

  const publicBasePath = await getRequestAdminBasePath()

  return {
    status: "success",
    kind: "registration",
    destination: getAdminHomePath(publicBasePath),
  }
}

export async function logoutAdminAction(_formData: FormData): Promise<never> {
  await signOutPlatformAdmin()
  const publicBasePath = await getRequestAdminBasePath()

  redirect(publicBasePath + "/entrar")
}
