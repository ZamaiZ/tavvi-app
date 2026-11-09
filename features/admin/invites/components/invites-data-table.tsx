"use client"

import { useMemo } from "react"
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { motion, useReducedMotion } from "motion/react"
import { LuAtSign, LuCircleX, LuSearchX, LuUsers } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
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
} from "@/features/admin/invites/model"
import { InviteMobileCard } from "@/features/admin/invites/components/invite-mobile-card"
import {
  InviteContextMenu,
  InviteRowActions,
} from "@/features/admin/invites/components/invite-record-menus"
import { InviteStatusBadge } from "@/features/admin/invites/components/invite-status-badge"

const features = tableFeatures({})
const columnHelper = createColumnHelper<typeof features, PlatformInvite>()

type InvitesDataTableProps = {
  invites: PlatformInvite[]
  filter: InviteFilter
  query: string
  page: number
  pageCount: number
  pageSize: number
  totalRows: number
  onPageChange: (page: number) => void
  onOpen: (invite: PlatformInvite) => void
  onCreateFromInvite: (invite: PlatformInvite) => void
  onClearFilters: () => void
}

export function InvitesDataTable({
  invites,
  filter,
  query,
  page,
  pageCount,
  pageSize,
  totalRows,
  onPageChange,
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
  const firstVisiblePage = Math.max(1, page - 3)
  const lastVisiblePage = Math.min(pageCount, page + 4)
  const visiblePages = Array.from(
    { length: lastVisiblePage - firstVisiblePage + 1 },
    (_, index) => firstVisiblePage + index
  )

  if (rows.length === 0) {
    const hasFilter = Boolean(query) || filter !== "all"

    return (
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
      >
        <Empty className="min-h-64 rounded-2xl border border-dashed border-border/70 bg-muted/15">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="size-11 rounded-2xl">
              <LuSearchX aria-hidden="true" className="size-5" />
            </EmptyMedia>
            <EmptyTitle>
              {hasFilter
                ? "Nenhum convite encontrado"
                : "Ainda não há convites"}
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
      </motion.div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="hidden overflow-x-auto rounded-2xl border border-border/70 bg-background md:block">
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
                <InviteContextMenu
                  key={row.id}
                  invite={invite}
                  onOpen={onOpen}
                  onCreateFromInvite={onCreateFromInvite}
                  trigger={
                    <motion.tr
                      initial={
                        shouldReduceMotion ? false : { opacity: 0, y: 7 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.25,
                        delay: Math.min(index * 0.025, 0.16),
                        ease: "easeOut",
                      }}
                      tabIndex={0}
                      aria-label={`Abrir detalhes de ${recipient}, convite ${inviteStatusLabels[invite.status].toLowerCase()}`}
                      aria-haspopup="dialog"
                      onClick={() => onOpen(invite)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) {
                          return
                        }

                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          onOpen(invite)
                        }
                      }}
                      className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset motion-reduce:transition-none"
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
                </InviteContextMenu>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:hidden">
        {rows.map((row, index) => (
          <InviteMobileCard
            key={row.id}
            invite={row.original}
            index={index}
            onOpen={onOpen}
            onCreateFromInvite={onCreateFromInvite}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2 px-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite">
          Mostrando {(page - 1) * pageSize + 1}–
          {Math.min(page * pageSize, totalRows)} de {totalRows} convites
        </p>
        <Pagination
          aria-label="Paginação dos convites"
          className="mx-0 w-full justify-between sm:w-auto sm:justify-end"
        >
          <PaginationContent className="w-full justify-between gap-1 sm:w-auto sm:justify-end">
            <PaginationItem>
              <PaginationPrevious
                href="#"
                text="Anterior"
                aria-disabled={page <= 1}
                tabIndex={page <= 1 ? -1 : undefined}
                className={`h-8 rounded-lg ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
                onClick={(event) => {
                  event.preventDefault()
                  if (page > 1) onPageChange(page - 1)
                }}
              />
            </PaginationItem>
            {firstVisiblePage > 1 && (
              <PaginationItem className="hidden sm:block">
                <PaginationEllipsis />
              </PaginationItem>
            )}
            {visiblePages.map((visiblePage) => (
              <PaginationItem key={visiblePage}>
                <PaginationLink
                  href="#"
                  isActive={visiblePage === page}
                  size="icon"
                  aria-label={`Página ${visiblePage}`}
                  className="size-7 rounded-lg p-0 text-xs tabular-nums"
                  onClick={(event) => {
                    event.preventDefault()
                    if (visiblePage !== page) onPageChange(visiblePage)
                  }}
                >
                  {visiblePage}
                </PaginationLink>
              </PaginationItem>
            ))}
            {lastVisiblePage < pageCount && (
              <PaginationItem className="hidden sm:block">
                <PaginationEllipsis />
              </PaginationItem>
            )}
            <PaginationItem>
              <PaginationNext
                href="#"
                text="Próxima"
                aria-disabled={page >= pageCount}
                tabIndex={page >= pageCount ? -1 : undefined}
                className={`h-8 rounded-lg ${page >= pageCount ? "pointer-events-none opacity-50" : ""}`}
                onClick={(event) => {
                  event.preventDefault()
                  if (page < pageCount) onPageChange(page + 1)
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  )
}
