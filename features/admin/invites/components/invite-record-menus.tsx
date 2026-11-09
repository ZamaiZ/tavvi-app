import type { ReactElement, ReactNode } from "react"
import { LuExternalLink, LuEllipsis, LuMailPlus } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  getInviteRecipient,
  type PlatformInvite,
} from "@/features/admin/invites/model"

type InviteRecordActions = {
  invite: PlatformInvite
  onOpen: (invite: PlatformInvite) => void
  onCreateFromInvite: (invite: PlatformInvite) => void
}

export function InviteRowActions({
  invite,
  onOpen,
  onCreateFromInvite,
  className,
  buttonClassName,
}: InviteRecordActions & {
  className?: string
  buttonClassName?: string
}) {
  return (
    <div className={className} onClick={(event) => event.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Ações para ${getInviteRecipient(invite)}`}
              className={
                buttonClassName ?? "text-muted-foreground hover:text-foreground"
              }
            />
          }
        >
          <LuEllipsis aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem onClick={() => onOpen(invite)}>
            <LuExternalLink aria-hidden="true" />
            Abrir detalhes
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onCreateFromInvite(invite)}>
            <LuMailPlus aria-hidden="true" />
            Gerar novo convite
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function InviteContextMenu({
  invite,
  onOpen,
  onCreateFromInvite,
  trigger,
  children,
}: InviteRecordActions & {
  trigger: ReactElement
  children?: ReactNode
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger render={trigger}>{children}</ContextMenuTrigger>
      <ContextMenuContent className="min-w-52">
        <ContextMenuItem onClick={() => onOpen(invite)}>
          <LuExternalLink aria-hidden="true" />
          Abrir detalhes
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onCreateFromInvite(invite)}>
          <LuMailPlus aria-hidden="true" />
          Gerar novo convite
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
