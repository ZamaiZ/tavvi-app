export type PlatformInviteStatus =
  | "pending"
  | "redeemed"
  | "expired"
  | "revoked"

export type InviteFilter = "all" | PlatformInviteStatus

export type PlatformInvite = {
  id: string
  email: string | null
  status: PlatformInviteStatus
  createdAt: string
  expiresAt: string
  redeemedAt: string | null
  redeemedBy: string | null
  restaurantId: string | null
  restaurantName: string | null
  revokedAt: string | null
}

export type InviteCounts = Record<InviteFilter, number>

export type InviteListQuery = {
  search: string
  status: InviteFilter
  page: number
  pageSize: number
}

export type InviteListResult = {
  rows: PlatformInvite[]
  counts: InviteCounts
  totalRows: number
  page: number
  pageSize: number
}

export const inviteStatusOptions: {
  value: InviteFilter
  label: string
}[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendentes" },
  { value: "redeemed", label: "Resgatados" },
  { value: "expired", label: "Vencidos" },
  { value: "revoked", label: "Revogados" },
]

export const inviteStatusLabels: Record<PlatformInviteStatus, string> = {
  pending: "Pendente",
  redeemed: "Resgatado",
  expired: "Vencido",
  revoked: "Revogado",
}

export function formatInviteDate(value: string | null) {
  if (!value) {
    return "—"
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value))
}

export function getInviteRecipient(invite: PlatformInvite) {
  return invite.email ?? "Qualquer e-mail"
}
