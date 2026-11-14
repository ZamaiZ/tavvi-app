import { z } from "zod"

import { TEAM_ROLES } from "@/features/panel/team/model"

export const teamListQuerySchema = z.object({
  search: z.string().trim().max(254).default(""),
  status: z.enum(["all", "active", "pending"]).default("all"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
})

export const createTeamInviteSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  role: z.enum(TEAM_ROLES),
})

export const revokeTeamInviteSchema = z.object({
  inviteId: z.string().uuid(),
})

export const updateTeamRoleSchema = z.object({
  membershipId: z.string().uuid(),
  role: z.enum(TEAM_ROLES),
})

export const removeTeamMemberSchema = z.object({
  membershipId: z.string().uuid(),
})

export const acceptTeamInviteSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("signup"),
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    accepted: z.literal(true),
    displayName: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
    password: z.string().min(8).max(128),
  }),
  z.object({
    mode: z.literal("current"),
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    accepted: z.literal(true),
  }),
])
