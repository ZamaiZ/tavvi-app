"use server"

import { revalidatePath } from "next/cache"

import {
  createInviteSchema,
  inviteIdSchema,
  replaceInviteSchema,
} from "@/features/admin/invites/schema"
import type { PlatformInvite } from "@/features/admin/invites/model"
import {
  PlatformInviteAccessError,
  PlatformInviteInputError,
  PlatformInviteServiceError,
  createPlatformInviteRecord,
  replacePlatformInviteRecord,
  revokePlatformInviteRecord,
} from "@/features/admin/invites/server/invites"
import { createPlatformInviteToken } from "@/features/admin/invites/server/token"
import { createPanelInviteUrl } from "@/lib/routing/panel"

type InviteActionFailure = {
  ok: false
  code:
    | "invalid_input"
    | "unauthorized"
    | "service_unavailable"
    | "rate_limited"
    | "link_unavailable"
    | "not_replaceable"
    | "not_revocable"
  inviteId?: string
  fieldErrors?: Record<string, string[] | undefined>
}

export type CreateInviteActionResult =
  | {
      ok: true
      invite: PlatformInvite
      link: string
    }
  | InviteActionFailure

function mapError(error: unknown): InviteActionFailure {
  if (error instanceof PlatformInviteAccessError) {
    return { ok: false, code: "unauthorized" }
  }
  if (error instanceof PlatformInviteInputError) {
    return { ok: false, code: "invalid_input" }
  }
  if (error instanceof PlatformInviteServiceError) {
    return { ok: false, code: "service_unavailable" }
  }

  return { ok: false, code: "service_unavailable" }
}

export async function createAdminInviteAction(
  rawInput: unknown
): Promise<CreateInviteActionResult> {
  const parsedInput = createInviteSchema.safeParse(rawInput)
  if (!parsedInput.success) {
    return {
      ok: false,
      code: "invalid_input",
      fieldErrors: parsedInput.error.flatten().fieldErrors,
    }
  }

  const { token, tokenHashHex } = createPlatformInviteToken()
  let link: string

  try {
    // Validate the configured destination before committing a non-recoverable token.
    link = createPanelInviteUrl(token)
  } catch {
    return { ok: false, code: "service_unavailable" }
  }

  try {
    const result = await createPlatformInviteRecord({
      ...parsedInput.data,
      tokenHashHex,
    })

    if (result.status === "rate-limited") {
      return { ok: false, code: "rate_limited" }
    }
    if (result.status === "link-unavailable") {
      revalidatePath("/admin")
      return {
        ok: false,
        code: "link_unavailable",
        inviteId: result.inviteId,
      }
    }
    if (result.status !== "created") {
      return { ok: false, code: "service_unavailable" }
    }

    revalidatePath("/admin")
    return { ok: true, invite: result.invite, link }
  } catch (error) {
    return mapError(error)
  }
}

export async function replaceAdminInviteAction(
  rawInput: unknown
): Promise<CreateInviteActionResult> {
  const parsedInput = replaceInviteSchema.safeParse(rawInput)
  if (!parsedInput.success) {
    return {
      ok: false,
      code: "invalid_input",
      fieldErrors: parsedInput.error.flatten().fieldErrors,
    }
  }

  const { token, tokenHashHex } = createPlatformInviteToken()
  let link: string

  try {
    link = createPanelInviteUrl(token)
  } catch {
    return { ok: false, code: "service_unavailable" }
  }

  try {
    const result = await replacePlatformInviteRecord({
      ...parsedInput.data,
      tokenHashHex,
    })

    if (result.status === "rate-limited") {
      return { ok: false, code: "rate_limited" }
    }
    if (result.status === "link-unavailable") {
      revalidatePath("/admin")
      return {
        ok: false,
        code: "link_unavailable",
        inviteId: result.inviteId,
      }
    }
    if (result.status === "not-replaceable") {
      return { ok: false, code: "not_replaceable" }
    }
    if (result.status !== "created") {
      return { ok: false, code: "service_unavailable" }
    }

    revalidatePath("/admin")
    return { ok: true, invite: result.invite, link }
  } catch (error) {
    return mapError(error)
  }
}

export async function revokeAdminInviteAction(
  rawInviteId: unknown
): Promise<InviteActionFailure | { ok: true; inviteId: string }> {
  const parsedId = inviteIdSchema.safeParse(rawInviteId)
  if (!parsedId.success) {
    return { ok: false, code: "invalid_input" }
  }

  try {
    const result = await revokePlatformInviteRecord(parsedId.data)

    if (result.status === "rate-limited") {
      return { ok: false, code: "rate_limited" }
    }
    if (result.status === "not-revocable") {
      return { ok: false, code: "not_revocable" }
    }
    if (result.status !== "revoked") {
      return { ok: false, code: "service_unavailable" }
    }

    revalidatePath("/admin")
    return { ok: true, inviteId: result.inviteId }
  } catch (error) {
    return mapError(error)
  }
}
