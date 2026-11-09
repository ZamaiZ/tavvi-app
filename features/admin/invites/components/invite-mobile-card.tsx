"use client"

import { motion, useReducedMotion } from "motion/react"
import {
  LuAtSign,
  LuCalendarClock,
  LuCalendarDays,
  LuUsers,
} from "react-icons/lu"

import {
  InviteRowActions,
  InviteContextMenu,
} from "@/features/admin/invites/components/invite-record-menus"
import { InviteStatusBadge } from "@/features/admin/invites/components/invite-status-badge"
import {
  formatInviteDate,
  getInviteRecipient,
  inviteStatusLabels,
  type PlatformInvite,
} from "@/features/admin/invites/model"

type InviteMobileCardProps = {
  invite: PlatformInvite
  index: number
  onOpen: (invite: PlatformInvite) => void
  onCreateFromInvite: (invite: PlatformInvite) => void
}

export function InviteMobileCard({
  invite,
  index,
  onOpen,
  onCreateFromInvite,
}: InviteMobileCardProps) {
  const shouldReduceMotion = useReducedMotion()
  const recipient = getInviteRecipient(invite)
  const hasEmail = Boolean(invite.email)
  const RecipientIcon = hasEmail ? LuAtSign : LuUsers

  return (
    <article className="relative min-w-0">
      <InviteContextMenu
        invite={invite}
        onOpen={onOpen}
        onCreateFromInvite={onCreateFromInvite}
        trigger={
          <motion.button
            type="button"
            aria-label={`Abrir detalhes de ${recipient}, convite ${inviteStatusLabels[invite.status].toLowerCase()}`}
            aria-haspopup="dialog"
            onClick={() => onOpen(invite)}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{
              opacity: 1,
              y: 0,
              transition: {
                duration: shouldReduceMotion ? 0 : 0.22,
                delay: shouldReduceMotion ? 0 : Math.min(index * 0.025, 0.12),
                ease: "easeOut",
              },
            }}
            whileHover={
              shouldReduceMotion
                ? undefined
                : { y: -1, transition: { duration: 0.16, delay: 0 } }
            }
            whileTap={
              shouldReduceMotion
                ? undefined
                : { scale: 0.995, transition: { duration: 0.1, delay: 0 } }
            }
            className="w-full rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-muted/25 p-4 text-left shadow-sm transition-[border-color,background-color,box-shadow] hover:border-border hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none"
          />
        }
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background text-muted-foreground shadow-sm">
            <RecipientIcon aria-hidden="true" className="size-4" />
          </span>
          <span className="min-w-0 flex-1 pr-10">
            <span className="block truncate text-sm font-semibold tracking-tight text-foreground">
              {recipient}
            </span>
            <span className="mt-1 block truncate text-[0.6875rem] text-muted-foreground">
              {hasEmail ? "Convite individual" : "Acesso sem e-mail definido"}
            </span>
          </span>
        </div>
        <span className="mt-3 flex items-center">
          <InviteStatusBadge status={invite.status} />
        </span>
        <span className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-3">
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-[0.625rem] font-medium tracking-wide text-muted-foreground uppercase">
              <LuCalendarDays aria-hidden="true" className="size-3" />
              Criado em
            </span>
            <span className="mt-1 block truncate text-xs font-medium text-foreground/85 tabular-nums">
              {formatInviteDate(invite.createdAt)}
            </span>
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-[0.625rem] font-medium tracking-wide text-muted-foreground uppercase">
              <LuCalendarClock aria-hidden="true" className="size-3" />
              Válido até
            </span>
            <span className="mt-1 block truncate text-xs font-medium text-foreground/85 tabular-nums">
              {formatInviteDate(invite.expiresAt)}
            </span>
          </span>
        </span>
      </InviteContextMenu>
      <InviteRowActions
        invite={invite}
        onOpen={onOpen}
        onCreateFromInvite={onCreateFromInvite}
        className="absolute top-2 right-2 z-10"
        buttonClassName="size-8 rounded-lg bg-background/90 text-muted-foreground shadow-sm ring-1 ring-border/70 hover:bg-background hover:text-foreground"
      />
    </article>
  )
}
