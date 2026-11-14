export const TEAM_ROLES = ["admin", "cashier", "attendant", "waiter"] as const

export type TeamRole = (typeof TEAM_ROLES)[number]
export type TeamFilter = "all" | "active" | "pending"

export const teamRoleLabels: Record<TeamRole, string> = {
  admin: "Administrador",
  cashier: "Caixa",
  attendant: "Atendente",
  waiter: "Garçom",
}

export const teamRoleDescriptions: Record<TeamRole, string> = {
  admin: "Responsável pelo restaurante. É o único cargo que pode alterar os cargos da equipe.",
  cashier: "Cargo de caixa. O acesso às áreas do Painel continua igual para toda a equipe.",
  attendant: "Cargo de atendente. O acesso às áreas do Painel continua igual para toda a equipe.",
  waiter: "Cargo de garçom. O acesso às áreas do Painel continua igual para toda a equipe.",
}

export type TeamRow = {
  id: string
  userId: string | null
  kind: "member" | "invite"
  name: string
  email: string
  role: TeamRole
  status: "active" | "pending"
  createdAt: string
  expiresAt: string | null
}

export type TeamListQuery = {
  search: string
  status: TeamFilter
  page: number
  pageSize: number
}

export type TeamListResult = TeamListQuery & {
  rows: TeamRow[]
  totalRows: number
  activeCount: number
  pendingCount: number
  actorId: string
  actorRole: TeamRole
}

export type TeamInvitePreview =
  | {
      status: "available"
      email: string
      role: TeamRole
      restaurantName: string
      expiresAt: string
    }
  | { status: "unavailable" }
  | { status: "service-unavailable" }

export type AcceptedTeamRestaurant = {
  restaurantId: string
  restaurantName: string
  restaurantSlug: string
  restaurantStatus: "draft" | "active" | "suspended"
  alreadyAccepted: boolean
}

export type AcceptTeamInviteResult =
  | { ok: true; restaurant: AcceptedTeamRestaurant }
  | {
      ok: false
      code:
        | "invalid_input"
        | "email_mismatch"
        | "account_exists"
        | "confirmation_required"
        | "rate_limited"
        | "already_member"
        | "unavailable"
        | "service_unavailable"
    }

export type TeamActionFailure = {
  ok: false
  code:
    | "invalid_input"
    | "unauthorized"
    | "forbidden"
    | "already_member"
    | "member_unavailable"
    | "self_role_change_blocked"
    | "self_removal_blocked"
    | "last_admin"
    | "unavailable"
    | "service_unavailable"
}

export function formatTeamDate(value: string | null) {
  if (!value) return "—"
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value))
  } catch {
    return "Data indisponível"
  }
}
