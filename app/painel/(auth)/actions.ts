"use server"

import { headers } from "next/headers"

import { panelLoginSchema } from "@/features/panel/auth/schema"
import { signInPanel } from "@/features/panel/auth/server"
import type { PanelAuthField, PanelAuthFormState } from "@/features/panel/auth/state"
import { getPanelPublicBasePath } from "@/features/panel/auth/navigation"
import { getRequestHostname } from "@/lib/routing/host"

function toFieldErrors(issues: ReadonlyArray<{ path: readonly PropertyKey[]; message: string }>) {
  const fieldErrors: Partial<Record<PanelAuthField, string[]>> = {}
  for (const issue of issues) {
    const field = issue.path[0]
    if (field !== "email" && field !== "password") continue
    fieldErrors[field] ??= []
    fieldErrors[field]?.push(issue.message)
  }
  return fieldErrors
}

export async function loginPanelAction(
  _previousState: PanelAuthFormState,
  formData: FormData,
): Promise<PanelAuthFormState> {
  const parsed = panelLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return { status: "invalid", fieldErrors: toFieldErrors(parsed.error.issues) }
  }

  const requestHeaders = await headers()
  const hostname = getRequestHostname(requestHeaders)
  const result = await signInPanel(parsed.data, getPanelPublicBasePath(hostname))
  if (!result.ok) return { status: "feedback", code: result.code }

  return { status: "success", destination: result.destination }
}
