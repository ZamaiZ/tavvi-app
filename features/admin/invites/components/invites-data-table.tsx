"use client"

import { useMemo } from "react"
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { motion, useReducedMotion } from "motion/react"
import {
  LuAtSign,
  LuBan,
  LuCalendarClock,
  LuCircleCheck,
  LuClock3,
  LuEllipsis,
  LuExternalLink,
  LuMailPlus,
  LuSearchX,
  LuUsers,
  LuCircleX,
} from "react-icons/lu"

import { Badge } from "@/components/ui/badge"
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
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableCaption,
  TableRow,
} from "@/components/ui/table"
import {
  formatInviteDate,
  getInviteRecipient,
  inviteStatusLabels,
  type InviteFilter,
  type PlatformInvite,
  type PlatformInviteStatus,
} from "@/features/admin/invites/data"

const features = tableFeatures({})
const columnHelper = createColumnHelper<typeof features, PlatformInvite>()

type InvitesDataTableProps = {
  invites: PlatformInvite[]
  filter: InviteFilter
  query: string
  onOpen: (invite: PlatformInvite) => void
  onCreateFromInvite: (invite: PlatformInvite) => void
  onClearFilters: () => void
}

const statusStyles: Record<PlatformInviteStatus, string> = {
  pending:
    "border-primary/20 bg-primary/10 text-primary dark:border-primary/25 dark:bg-primary/15",
  redeemed:
    "border-emerald-600/15 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300",
  expired:
    "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  revoked: "border-muted-foreground/15 bg-muted text-muted-foreground",
}

function InviteStatusBadge({ status }: { status: PlatformInviteStatus }) {
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

function InviteRowActions({
  invite,
  onOpen,
  onCreateFromInvite,
}: {
  invite: PlatformInvite
  onOpen: (invite: PlatformInvite) => void
  onCreateFromInvite: (invite: PlatformInvite) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Ações para ${getInviteRecipient(invite)}`}
            className="text-muted-foreground hover:text-foreground"
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
  )
}

export function InvitesDataTable({
  invites,
  filter,
  query,
  onOpen,
  onCreateFromInvite,
  onClearFilters,
}: InvitesDataTableProps) {
  const shouldReduceMotion = useReducedMotion()
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor("email", {
          id: "recipient",
          header: "Destinatário",
          cell: ({ row }) => {
            const invite = row.original
            const hasEmail = Boolean(invite.email)

            return (
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-muted/70 text-muted-foreground">
                  {hasEmail ? (
                    <LuAtSign aria-hidden="true" className="size-4" />
                  ) : (
                    <LuUsers aria-hidden="true" className="size-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="max-w-[15rem] truncate font-medium text-foreground">
                    {getInviteRecipient(invite)}
                  </p>
                  <p className="mt-0.5 text-[0.625rem] text-muted-foreground">
                    {hasEmail
                      ? "Convite individual"
                      : "Acesso sem e-mail definido"}
                  </p>
                </div>
              </div>
            )
          },
        }),
        columnHelper.accessor("status", {
          header: "Situação",
          cell: ({ getValue }) => <InviteStatusBadge status={getValue()} />,
        }),
        columnHelper.accessor("createdAt", {
          header: "Criado em",
          cell: ({ getValue }) => (
            <span className="text-muted-foreground">
              {formatInviteDate(getValue())}
            </span>
          ),
        }),
        columnHelper.accessor("expiresAt", {
          header: "Válido até",
          cell: ({ getValue }) => (
            <span className="text-muted-foreground">
              {formatInviteDate(getValue())}
            </span>
          ),
        }),
        columnHelper.display({
          id: "actions",
          header: () => <span className="sr-only">Ações</span>,
          cell: ({ row }) => (
            <InviteRowActions
              invite={row.original}
              onOpen={onOpen}
              onCreateFromInvite={onCreateFromInvite}
            />
          ),
        }),
      ]),
    [onCreateFromInvite, onOpen]
  )
  const table = useTable({
    features,
    columns,
    data: invites,
    getRowId: (invite) => invite.id,
  })
  const rows = table.getRowModel().rows

  if (rows.length === 0) {
    const hasFilter = Boolean(query) || filter !== "all"

    return (
      <Empty className="min-h-64 rounded-2xl border border-dashed border-border/70 bg-muted/15">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="size-11 rounded-2xl">
            <LuSearchX aria-hidden="true" className="size-5" />
          </EmptyMedia>
          <EmptyTitle>
            {hasFilter ? "Nenhum convite encontrado" : "Ainda não há convites"}
          </EmptyTitle>
          <EmptyDescription>
            {hasFilter
              ? "Ajuste sua busca ou escolha outra situação para ver resultados."
              : "Os convites criados para a plataforma aparecerão nesta lista."}
          </EmptyDescription>
        </EmptyHeader>
        {hasFilter && (
          <EmptyContent>
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              <LuCircleX aria-hidden="true" />
              Limpar filtros
            </Button>
          </EmptyContent>
        )}
      </Empty>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-background">
      <Table className="min-w-[720px]">
        <TableCaption className="sr-only">
          Lista de convites com destinatário, situação, criação, validade e
          ações.
        </TableCaption>
        <TableHeader className="bg-muted/25">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="h-12 px-4 text-[0.625rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase"
                >
                  {header.isPlaceholder ? null : (
                    <table.FlexRender header={header} />
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const invite = row.original
            const recipient = getInviteRecipient(invite)

            return (
              <ContextMenu key={row.id}>
                <ContextMenuTrigger
                  render={
                    <motion.tr
                      initial={
                        shouldReduceMotion ? false : { opacity: 0, y: 7 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ backgroundColor: "var(--muted)" }}
                      transition={{
                        duration: 0.25,
                        delay: Math.min(index * 0.025, 0.16),
                        ease: "easeOut",
                      }}
                      tabIndex={0}
                      aria-label={`${recipient}, convite ${inviteStatusLabels[invite.status].toLowerCase()}`}
                      className="border-b border-border/60 transition-colors last:border-0 focus-visible:bg-muted/60 focus-visible:outline-none"
                    />
                  }
                >
                  {row.getAllCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="px-4 py-3.5 align-middle first:min-w-[17rem]"
                    >
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </ContextMenuTrigger>
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
          })}
        </TableBody>
      </Table>
    </div>
  )
}
