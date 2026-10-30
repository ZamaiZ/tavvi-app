import "server-only"

import { z } from "zod"

import type {
  InviteCounts,
  InviteListQuery,
  InviteListResult,
  PlatformInvite,
} from "@/features/admin/invites/model"
import {
  createInviteSchema,
  inviteListQuerySchema,
  replaceInviteSchema,
  inviteIdSchema,
} from "@/features/admin/invites/schema"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const inviteStatusSchema = z.enum([
  "pending",
  "redeemed",
  "expired",
  "revoked",
])

const platformInviteSchema = z.object({
  id: z.string().uuid(),
  email: z.string().nullable(),
  status: inviteStatusSchema,
  createdAt: z.string().min(1),
  expiresAt: z.string().min(1),
  redeemedAt: z.string().nullable(),
  redeemedBy: z.string().uuid().nullable(),
  restaurantId: z.string().uuid().nullable(),
  restaurantName: z.string().nullable(),
  revokedAt: z.string().nullable(),
}) satisfies z.ZodType<PlatformInvite>

const inviteCountsSchema = z.object({
  all: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  redeemed: z.number().int().nonnegative(),
  expired: z.number().int().nonnegative(),
  revoked: z.number().int().nonnegative(),
}) satisfies z.ZodType<InviteCounts>

const inviteListResponseSchema = z.object({
  rows: z.array(platformInviteSchema),
  counts: inviteCountsSchema,
  totalRows: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive().max(100),
})

const inviteMutationResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    created: z.boolean().optional(),
    linkAvailable: z.boolean().optional(),
    id: z.string().uuid(),
    email: z.string().nullable().optional(),
    createdAt: z.string().min(1).optional(),
    expiresAt: z.string().min(1).optional(),
    status: inviteStatusSchema.optional(),
  }),
  z.object({
    ok: z.literal(false),
    code: z.enum(["rate_limited", "not_replaceable", "not_revocable"]),
  }),
])

export class PlatformInviteAccessError extends Error {}
export class PlatformInviteInputError extends Error {}
export class PlatformInviteServiceError extends Error {}

export type InviteRecordMutation =
  | { status: "created"; invite: PlatformInvite }
  | { status: "link-unavailable"; inviteId: string }
  | { status: "revoked"; inviteId: string }
  | { status: "rate-limited" }
  | { status: "not-replaceable" }
  | { status: "not-revocable" }

function throwRpcError(error: { code?: string }) {
  if (error.code === "42501") {
    throw new PlatformInviteAccessError()
  }
  if (error.code === "22023") {
    throw new PlatformInviteInputError()
  }
  throw new PlatformInviteServiceError()
}

function mapCreatedInvite(
  response: z.infer<typeof inviteMutationResponseSchema>,
  fallbackEmail: string | null
): InviteRecordMutation {
  if (!response.ok) {
    if (response.code === "rate_limited") {
      return { status: "rate-limited" }
    }
    return response.code === "not_replaceable"
      ? { status: "not-replaceable" }
      : { status: "not-revocable" }
  }

  if (response.created === false || response.linkAvailable === false) {
    return { status: "link-unavailable", inviteId: response.id }
  }
  if (!response.createdAt || !response.expiresAt) {
    throw new PlatformInviteServiceError()
  }

  return {
    status: "created",
    invite: {
      id: response.id,
      email: response.email ?? fallbackEmail,
      status: "pending",
      createdAt: response.createdAt,
      expiresAt: response.expiresAt,
      redeemedAt: null,
      redeemedBy: null,
      restaurantId: null,
      restaurantName: null,
      revokedAt: null,
    },
  }
}

export async function listPlatformInvites(
  input: InviteListQuery
): Promise<InviteListResult> {
  const parsedInput = inviteListQuerySchema.safeParse(input)
  if (!parsedInput.success) {
    throw new PlatformInviteInputError()
  }

  const supabase = await createSupabaseServerClient("admin")
  const { data, error } = await supabase.rpc("list_platform_invites", {
    p_search: parsedInput.data.search,
    p_status: parsedInput.data.status,
    p_page: parsedInput.data.page,
    p_page_size: parsedInput.data.pageSize,
  })

  if (error) {
    if (error.code !== "42501" && error.code !== "22023") {
      console.error("[admin.invites] list_platform_invites RPC failed", {
        code: error.code ?? "unknown",
      })
    }
    throwRpcError(error)
  }

  const parsedResponse = inviteListResponseSchema.safeParse(data)
  if (!parsedResponse.success) {
    console.error("[admin.invites] list_platform_invites returned invalid data", {
      issues: parsedResponse.error.issues.map(({ code, path }) => ({
        code,
        path: path.join("."),
      })),
    })
    throw new PlatformInviteServiceError()
  }

  return parsedResponse.data
}

export async function createPlatformInviteRecord(input: {
  email: string | null
  validDays: number
  idempotencyKey: string
  tokenHashHex: string
}): Promise<InviteRecordMutation> {
  const parsedInput = createInviteSchema.safeParse({
    email: input.email ?? "",
    validDays: input.validDays,
    idempotencyKey: input.idempotencyKey,
  })
  if (!parsedInput.success) {
    throw new PlatformInviteInputError()
  }

  const supabase = await createSupabaseServerClient("admin")
  const { data, error } = await supabase.rpc("create_platform_invite", {
    p_email: parsedInput.data.email,
    p_valid_days: parsedInput.data.validDays,
    p_token_hash_hex: input.tokenHashHex,
    p_idempotency_key: parsedInput.data.idempotencyKey,
  })

  if (error) {
    throwRpcError(error)
  }

  const parsedResponse = inviteMutationResponseSchema.safeParse(data)
  if (!parsedResponse.success) {
    throw new PlatformInviteServiceError()
  }

  return mapCreatedInvite(parsedResponse.data, parsedInput.data.email)
}

export async function replacePlatformInviteRecord(input: {
  inviteId: string
  email: string | null
  validDays: number
  idempotencyKey: string
  tokenHashHex: string
}): Promise<InviteRecordMutation> {
  const parsedInput = replaceInviteSchema.safeParse({
    inviteId: input.inviteId,
    email: input.email ?? "",
    validDays: input.validDays,
    idempotencyKey: input.idempotencyKey,
  })
  if (!parsedInput.success) {
    throw new PlatformInviteInputError()
  }

  const supabase = await createSupabaseServerClient("admin")
  const { data, error } = await supabase.rpc("replace_platform_invite", {
    p_invite_id: parsedInput.data.inviteId,
    p_email: parsedInput.data.email,
    p_valid_days: parsedInput.data.validDays,
    p_token_hash_hex: input.tokenHashHex,
    p_idempotency_key: parsedInput.data.idempotencyKey,
  })

  if (error) {
    throwRpcError(error)
  }

  const parsedResponse = inviteMutationResponseSchema.safeParse(data)
  if (!parsedResponse.success) {
    throw new PlatformInviteServiceError()
  }

  return mapCreatedInvite(parsedResponse.data, parsedInput.data.email)
}

export async function revokePlatformInviteRecord(
  inviteId: string
): Promise<InviteRecordMutation> {
  const parsedId = inviteIdSchema.safeParse(inviteId)
  if (!parsedId.success) {
    throw new PlatformInviteInputError()
  }

  const supabase = await createSupabaseServerClient("admin")
  const { data, error } = await supabase.rpc("revoke_platform_invite", {
    p_invite_id: parsedId.data,
  })

  if (error) {
    throwRpcError(error)
  }

  const parsedResponse = inviteMutationResponseSchema.safeParse(data)
  if (!parsedResponse.success) {
    throw new PlatformInviteServiceError()
  }
  if (!parsedResponse.data.ok) {
    return parsedResponse.data.code === "rate_limited"
      ? { status: "rate-limited" }
      : { status: "not-revocable" }
  }

  return parsedResponse.data.status === "revoked"
    ? { status: "revoked", inviteId: parsedResponse.data.id }
    : { status: "not-revocable" }
}
