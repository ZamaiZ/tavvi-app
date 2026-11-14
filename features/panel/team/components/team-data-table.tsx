"use client"

import { useMemo, type ReactElement, type ReactNode } from "react"
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table"
import { motion, useReducedMotion } from "motion/react"
import {
  LuAtSign,
  LuBan,
  LuCalendarClock,
  LuCalendarDays,
  LuCircleX,
  LuClock3,
  LuCopy,
  LuExternalLink,
  LuMailPlus,
  LuSearchX,
  LuShieldCheck,
  LuEllipsis,
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
  DropdownMenuSeparator,
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
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  formatTeamDate,
  teamRoleLabels,
  type TeamFilter,
  type TeamRow,
} from "@/features/panel/team/model"

const features = tableFeatures({})
const columnHelper = createColumnHelper<typeof features, TeamRow>()

type TeamDataTableProps = {
  rows: TeamRow[]
  filter: TeamFilter
  query: string
  page: number
  pageCount: number
  pageSize: number
  totalRows: number
  actorId: string
  onPageChange: (page: number) => void
  onOpen: (row: TeamRow) => void
  onCopyEmail: (row: TeamRow) => void
  onRegenerateInvite: (row: TeamRow) => void
  onRevokeInvite: (row: TeamRow) => void
  onRemoveMember: (row: TeamRow) => void
  onClearFilters: () => void
}

function stateBadge(row: TeamRow) {
  if (row.kind === "member") {
    return <Badge variant="outline" className="border-emerald-600/20 bg-emerald-600/[0.06] text-emerald-700 dark:text-emerald-300"><LuShieldCheck aria-hidden="true" />Ativo</Badge>
  }
  return <Badge variant="outline" className="border-amber-600/25 bg-amber-500/[0.08] text-amber-800 dark:text-amber-300"><LuClock3 aria-hidden="true" />Pendente</Badge>
}

function TeamRowActions({
  row,
  actorId,
  onOpen,
  onCopyEmail,
  onRegenerateInvite,
  onRevokeInvite,
  onRemoveMember,
  className,
}: Pick<TeamDataTableProps, "actorId" | "onOpen" | "onCopyEmail" | "onRegenerateInvite" | "onRevokeInvite" | "onRemoveMember"> & {
  row: TeamRow
  className?: string
}) {
  return (
    <div className={className} onClick={(event) => event.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Ações para ${row.name}`}
              className="text-muted-foreground hover:text-foreground"
            />
          }
        >
          <LuEllipsis aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem onClick={() => onOpen(row)}>
            <LuExternalLink aria-hidden="true" />
            Abrir detalhes
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onCopyEmail(row)}>
            <LuCopy aria-hidden="true" />
            Copiar e-mail
          </DropdownMenuItem>
          {row.kind === "invite" ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onRegenerateInvite(row)}>
                <LuMailPlus aria-hidden="true" />
                Gerar novo link
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => onRevokeInvite(row)}>
                Revogar convite
              </DropdownMenuItem>
            </>
          ) : null}
          {row.kind === "member" && row.userId !== actorId ? <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onClick={() => onRemoveMember(row)}><LuBan aria-hidden="true" />Remover acesso</DropdownMenuItem></> : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function TeamContextMenu({
  row,
  actorId,
  onOpen,
  onCopyEmail,
  onRegenerateInvite,
  onRevokeInvite,
  onRemoveMember,
  trigger,
  children,
}: Pick<TeamDataTableProps, "actorId" | "onOpen" | "onCopyEmail" | "onRegenerateInvite" | "onRevokeInvite" | "onRemoveMember"> & {
  row: TeamRow
  trigger: ReactElement
  children?: ReactNode
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger render={trigger}>{children}</ContextMenuTrigger>
      <ContextMenuContent className="min-w-52">
        <ContextMenuItem onClick={() => onOpen(row)}>
          <LuExternalLink aria-hidden="true" />
          Abrir detalhes
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onCopyEmail(row)}>
          <LuCopy aria-hidden="true" />
          Copiar e-mail
        </ContextMenuItem>
        {row.kind === "invite" ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onRegenerateInvite(row)}>
              <LuMailPlus aria-hidden="true" />
              Gerar novo link
            </ContextMenuItem>
            <ContextMenuItem variant="destructive" onClick={() => onRevokeInvite(row)}>
              Revogar convite
            </ContextMenuItem>
          </>
        ) : null}
        {row.kind === "member" && row.userId !== actorId ? <><ContextMenuSeparator /><ContextMenuItem variant="destructive" onClick={() => onRemoveMember(row)}><LuBan aria-hidden="true" />Remover acesso</ContextMenuItem></> : null}
      </ContextMenuContent>
    </ContextMenu>
  )
}

function TeamMobileCard({
  row,
  index,
  ...actions
}: {
  row: TeamRow
  index: number
} & Pick<TeamDataTableProps, "actorId" | "onOpen" | "onCopyEmail" | "onRegenerateInvite" | "onRevokeInvite" | "onRemoveMember">) {
  const reduceMotion = useReducedMotion()
  const initials = row.name.trim().slice(0, 1).toLocaleUpperCase("pt-BR")
  return (
    <article className="relative min-w-0">
      <TeamContextMenu
        row={row}
        {...actions}
        trigger={
          <motion.button
            type="button"
            aria-label={`Abrir detalhes de ${row.name}, ${teamRoleLabels[row.role]}`}
            aria-haspopup="dialog"
            onClick={() => actions.onOpen(row)}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { duration: reduceMotion ? 0 : 0.22, delay: reduceMotion ? 0 : Math.min(index * 0.025, 0.12), ease: "easeOut" } }}
            whileHover={reduceMotion ? undefined : { y: -1, transition: { duration: 0.16 } }}
            whileTap={reduceMotion ? undefined : { scale: 0.995, transition: { duration: 0.1 } }}
            className="w-full rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-muted/25 p-4 text-left shadow-sm transition-[border-color,box-shadow] hover:border-border hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none"
          />
        }
      >
        <span className="flex min-w-0 items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-border/60 bg-background text-sm font-semibold text-primary shadow-sm">{initials}</span>
          <span className="min-w-0 flex-1 pr-10">
            <span className="block truncate text-sm font-semibold tracking-tight text-foreground">{row.name}</span>
            <span className="mt-1 block truncate text-xs text-muted-foreground">{row.email || "E-mail não informado"}</span>
          </span>
        </span>
        <span className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="bg-muted/75 text-foreground/80">{teamRoleLabels[row.role]}</Badge>
          {stateBadge(row)}
        </span>
        <span className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-3">
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-[0.625rem] font-medium tracking-wide text-muted-foreground uppercase"><LuCalendarDays aria-hidden="true" className="size-3" />Criado</span>
            <span className="mt-1 block truncate text-xs font-medium tabular-nums">{formatTeamDate(row.createdAt)}</span>
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-[0.625rem] font-medium tracking-wide text-muted-foreground uppercase"><LuCalendarClock aria-hidden="true" className="size-3" />{row.kind === "invite" ? "Válido até" : "Acesso"}</span>
            <span className="mt-1 block truncate text-xs font-medium tabular-nums">{row.kind === "invite" ? formatTeamDate(row.expiresAt) : "Membership ativa"}</span>
          </span>
        </span>
      </TeamContextMenu>
      <TeamRowActions row={row} {...actions} className="absolute top-2 right-2 z-10" />
    </article>
  )
}

export function TeamDataTable(props: TeamDataTableProps) {
  const {
    rows: data,
    filter,
    query,
    page,
    pageCount,
    pageSize,
    totalRows,
    actorId,
    onPageChange,
    onOpen,
    onCopyEmail,
    onRegenerateInvite,
    onRevokeInvite,
    onRemoveMember,
    onClearFilters,
  } = props
  const reduceMotion = useReducedMotion()
  const columns = useMemo(() => columnHelper.columns([
    columnHelper.accessor("name", {
      header: "Pessoa",
      cell: ({ row }) => {
        const person = row.original
        const initials = person.name.trim().slice(0, 1).toLocaleUpperCase("pt-BR")
        return (
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-border/70 bg-primary/[0.06] text-xs font-semibold text-primary">{initials}</span>
            <div className="min-w-0">
              <p className="max-w-[16rem] truncate font-medium text-foreground">{person.name}</p>
              <p className="mt-0.5 flex items-center gap-1 truncate text-[0.6875rem] text-muted-foreground">{person.email ? <LuAtSign aria-hidden="true" className="size-3 shrink-0" /> : null}{person.email || "E-mail não informado"}</p>
            </div>
          </div>
        )
      },
    }),
    columnHelper.accessor("role", {
      header: "Cargo",
      cell: ({ getValue }) => <Badge variant="secondary" className="bg-muted/75 text-foreground/80">{teamRoleLabels[getValue()]}</Badge>,
    }),
    columnHelper.accessor("status", {
      header: "Situação",
      cell: ({ row }) => stateBadge(row.original),
    }),
    columnHelper.accessor("createdAt", {
      header: "Entrada / envio",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatTeamDate(row.original.kind === "invite" ? row.original.expiresAt : row.original.createdAt)}
          <span className="ml-1.5 text-[0.625rem]">{row.original.kind === "invite" ? "validade" : "entrada"}</span>
        </span>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: () => <span className="sr-only">Ações</span>,
      cell: ({ row }) => <TeamRowActions row={row.original} actorId={actorId} onOpen={onOpen} onCopyEmail={onCopyEmail} onRegenerateInvite={onRegenerateInvite} onRevokeInvite={onRevokeInvite} onRemoveMember={onRemoveMember} />,
    }),
  ]), [actorId, onCopyEmail, onOpen, onRegenerateInvite, onRemoveMember, onRevokeInvite])
  const table = useTable({ features, columns, data, getRowId: (row) => `${row.kind}:${row.id}` })
  const rows = table.getRowModel().rows
  const firstVisiblePage = Math.max(1, page - 3)
  const lastVisiblePage = Math.min(pageCount, page + 4)
  const visiblePages = Array.from({ length: lastVisiblePage - firstVisiblePage + 1 }, (_, index) => firstVisiblePage + index)

  if (!rows.length) {
    const hasFilter = Boolean(query) || filter !== "all"
    return (
      <motion.div initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: "easeOut" }}>
        <Empty className="min-h-64 rounded-2xl border border-dashed border-border/70 bg-muted/15">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="size-11 rounded-2xl"><LuSearchX aria-hidden="true" className="size-5" /></EmptyMedia>
            <EmptyTitle>{hasFilter ? "Nenhuma pessoa encontrada" : "Sua equipe começa aqui"}</EmptyTitle>
            <EmptyDescription>{hasFilter ? "Ajuste a busca ou escolha outro filtro para ver resultados." : "Convide sua equipe para que cada pessoa entre no restaurante com o cargo certo."}</EmptyDescription>
          </EmptyHeader>
          {hasFilter ? <EmptyContent><Button variant="outline" size="sm" onClick={onClearFilters}><LuCircleX aria-hidden="true" />Limpar filtros</Button></EmptyContent> : null}
        </Empty>
      </motion.div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="hidden overflow-x-auto rounded-2xl border border-border/70 bg-background md:block">
        <Table className="min-w-[760px]">
          <TableCaption className="sr-only">Equipe ativa e convites pendentes do restaurante.</TableCaption>
          <TableHeader className="bg-muted/25">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="h-12 px-4 text-[0.625rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => {
              const person = row.original
              return (
                <TeamContextMenu
                  key={row.id}
                  row={person}
                  actorId={actorId}
                  onOpen={onOpen}
                  onCopyEmail={onCopyEmail}
                  onRegenerateInvite={onRegenerateInvite}
                  onRevokeInvite={onRevokeInvite}
                  onRemoveMember={onRemoveMember}
                  trigger={
                    <motion.tr
                      initial={reduceMotion ? false : { opacity: 0, y: 7 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: reduceMotion ? 0 : 0.22, delay: reduceMotion ? 0 : Math.min(index * 0.025, 0.15), ease: "easeOut" }}
                      tabIndex={0}
                      aria-label={`Abrir detalhes de ${person.name}, ${teamRoleLabels[person.role]}`}
                      aria-haspopup="dialog"
                      onClick={() => onOpen(person)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          onOpen(person)
                        }
                      }}
                      className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset motion-reduce:transition-none"
                    />
                  }
                >
                  {row.getAllCells().map((cell) => <TableCell key={cell.id} className="px-4 py-3.5 align-middle first:min-w-[18rem]"><table.FlexRender cell={cell} /></TableCell>)}
                </TeamContextMenu>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:hidden">
        {rows.map((row, index) => <TeamMobileCard key={row.id} row={row.original} index={index} actorId={actorId} onOpen={onOpen} onCopyEmail={onCopyEmail} onRegenerateInvite={onRegenerateInvite} onRevokeInvite={onRevokeInvite} onRemoveMember={onRemoveMember} />)}
      </div>

      <div className="flex flex-col gap-2 px-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite">Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalRows)} de {totalRows} registros</p>
        <Pagination aria-label="Paginação da equipe" className="mx-0 w-full justify-between sm:w-auto sm:justify-end">
          <PaginationContent className="w-full justify-between gap-1 sm:w-auto sm:justify-end">
            <PaginationItem><PaginationPrevious href="#" text="Anterior" aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined} className={`h-8 rounded-lg ${page <= 1 ? "pointer-events-none opacity-50" : ""}`} onClick={(event) => { event.preventDefault(); if (page > 1) onPageChange(page - 1) }} /></PaginationItem>
            {firstVisiblePage > 1 ? <PaginationItem className="hidden sm:block"><PaginationEllipsis /></PaginationItem> : null}
            {visiblePages.map((visiblePage) => <PaginationItem key={visiblePage}><PaginationLink href="#" isActive={visiblePage === page} size="icon" aria-label={`Página ${visiblePage}`} className="size-7 rounded-lg p-0 text-xs tabular-nums" onClick={(event) => { event.preventDefault(); if (visiblePage !== page) onPageChange(visiblePage) }}>{visiblePage}</PaginationLink></PaginationItem>)}
            {lastVisiblePage < pageCount ? <PaginationItem className="hidden sm:block"><PaginationEllipsis /></PaginationItem> : null}
            <PaginationItem><PaginationNext href="#" text="Próxima" aria-disabled={page >= pageCount} tabIndex={page >= pageCount ? -1 : undefined} className={`h-8 rounded-lg ${page >= pageCount ? "pointer-events-none opacity-50" : ""}`} onClick={(event) => { event.preventDefault(); if (page < pageCount) onPageChange(page + 1) }} /></PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  )
}
