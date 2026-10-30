import { z } from "zod"

const inviteStatusSchema = z.enum([
  "pending",
  "redeemed",
  "expired",
  "revoked",
])

const optionalEmailSchema = z
  .union([
    z.literal(""),
    z.string().trim().max(254).email("Informe um e-mail válido."),
  ])
  .transform((email) => (email === "" ? null : email.toLowerCase()))

const idempotencyKeySchema = z.string().uuid("Chave de operação inválida.")

export const inviteListQuerySchema = z.object({
  search: z.string().trim().max(254).default(""),
  status: z
    .enum(["all", "pending", "redeemed", "expired", "revoked"])
    .default("all"),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
})

export const createInviteSchema = z.object({
  email: optionalEmailSchema,
  validDays: z.number().int().min(1).max(30),
  idempotencyKey: idempotencyKeySchema,
})

export const replaceInviteSchema = createInviteSchema.extend({
  inviteId: z.string().uuid("Convite inválido."),
})

export const inviteIdSchema = z.string().uuid("Convite inválido.")

export type CreateInviteInput = z.infer<typeof createInviteSchema>
export type ReplaceInviteInput = z.infer<typeof replaceInviteSchema>
