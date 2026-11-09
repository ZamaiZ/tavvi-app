import { LuBan, LuCalendarClock, LuCircleCheck, LuClock3 } from "react-icons/lu"

import { Badge } from "@/components/ui/badge"
import {
  inviteStatusLabels,
  type PlatformInviteStatus,
} from "@/features/admin/invites/model"

const statusStyles: Record<PlatformInviteStatus, string> = {
  pending:
    "border-primary/20 bg-primary/10 text-primary dark:border-primary/25 dark:bg-primary/15",
  redeemed:
    "border-emerald-600/15 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300",
  expired:
    "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  revoked: "border-muted-foreground/15 bg-muted text-muted-foreground",
}

export function InviteStatusBadge({
  status,
}: {
  status: PlatformInviteStatus
}) {
  const Icon = {
    pending: LuClock3,
    redeemed: LuCircleCheck,
    expired: LuCalendarClock,
    revoked: LuBan,
  }[status]

  return (
    <Badge variant="outline" className={statusStyles[status]}>
      <Icon aria-hidden="true" data-icon="inline-start" />
      {inviteStatusLabels[status]}
    </Badge>
  )
}
