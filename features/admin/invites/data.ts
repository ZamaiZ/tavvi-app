export type PlatformInviteStatus =
  "pending" | "redeemed" | "expired" | "revoked"

export type InviteFilter = "all" | PlatformInviteStatus

export type PlatformInvite = {
  id: string
  email: string | null
  status: PlatformInviteStatus
  createdAt: string
  expiresAt: string
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

export const inviteSummaryCounts: Record<InviteFilter, number> = {
  all: 181,
  pending: 24,
  redeemed: 146,
  expired: 8,
  revoked: 3,
}

export const demoInvites: PlatformInvite[] = [
  {
    id: "invite-01",
    email: "marina@exemplo.com",
    status: "pending",
    createdAt: "2026-10-24T12:00:00.000Z",
    expiresAt: "2026-10-31T12:00:00.000Z",
  },
  {
    id: "invite-02",
    email: null,
    status: "pending",
    createdAt: "2026-10-23T12:00:00.000Z",
    expiresAt: "2026-10-30T12:00:00.000Z",
  },
  {
    id: "invite-03",
    email: "bruno@exemplo.com",
    status: "redeemed",
    createdAt: "2026-10-22T12:00:00.000Z",
    expiresAt: "2026-10-29T12:00:00.000Z",
  },
  {
    id: "invite-04",
    email: "camila@exemplo.com",
    status: "pending",
    createdAt: "2026-10-21T12:00:00.000Z",
    expiresAt: "2026-10-28T12:00:00.000Z",
  },
  {
    id: "invite-05",
    email: "lucas@exemplo.com",
    status: "expired",
    createdAt: "2026-10-13T12:00:00.000Z",
    expiresAt: "2026-10-20T12:00:00.000Z",
  },
  {
    id: "invite-06",
    email: "carla@exemplo.com",
    status: "revoked",
    createdAt: "2026-10-11T12:00:00.000Z",
    expiresAt: "2026-10-18T12:00:00.000Z",
  },
  {
    id: "invite-07",
    email: "rafael@exemplo.com",
    status: "redeemed",
    createdAt: "2026-10-08T12:00:00.000Z",
    expiresAt: "2026-10-15T12:00:00.000Z",
  },
  {
    id: "invite-08",
    email: "isabela.sousa@exemplo.com",
    status: "pending",
    createdAt: "2026-10-27T12:00:00.000Z",
    expiresAt: "2026-11-03T12:00:00.000Z",
  },
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
