"use client"

import { createContext, useContext, useMemo, useState } from "react"
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_basic,
  tableFeatures,
  useTable,
  type Column,
  type SortingState,
} from "@tanstack/react-table"
import {
  LuArrowDown,
  LuArrowUp,
  LuArrowUpDown,
  LuCheck,
  LuCopy,
  LuEllipsis,
  LuPencil,
} from "react-icons/lu"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { IdentifierDTO } from "../model"
import { IdentifierNfcStatus } from "./identifier-nfc-status"

const identifierTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { basic: sortFn_basic },
})

const columnHelper = createColumnHelper<
  typeof identifierTableFeatures,
  IdentifierDTO
>()

export type IdentifiersDataTableProps = {
  rows: IdentifierDTO[]
  busyIdentifierId: string | null
  copiedIdentifierId: string | null
  onOpen: (identifier: IdentifierDTO) => void
  onToggleActive: (identifier: IdentifierDTO) => void
  onEdit: (identifier: IdentifierDTO) => void
  onCopyLink: (identifier: IdentifierDTO) => Promise<void>
}

type IdentifierTableActions = Omit<IdentifiersDataTableProps, "rows">

const IdentifierTableActionsContext =
  createContext<IdentifierTableActions | null>(null)

function useIdentifierTableActions() {
  const actions = useContext(IdentifierTableActionsContext)
  if (!actions) throw new Error("identifier_table_actions_context_missing")
  return actions
}

function TableNumberHeader({
  column,
}: {
  column: Column<typeof identifierTableFeatures, IdentifierDTO, number>
}) {
  const direction = column.getIsSorted()
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => column.toggleSorting(direction === "asc")}
      className="-ml-2 h-8 rounded-lg px-2 text-[0.65rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase hover:bg-background hover:text-foreground"
    >
      Mesa
      {direction === "asc" ? (
        <LuArrowUp aria-hidden="true" className="size-3.5 text-primary" />
      ) : direction === "desc" ? (
        <LuArrowDown aria-hidden="true" className="size-3.5 text-primary" />
      ) : (
        <LuArrowUpDown aria-hidden="true" className="size-3.5" />
      )}
    </Button>
  )
}

function IdentifierNameCell({ identifier }: { identifier: IdentifierDTO }) {
  const { onOpen } = useIdentifierTableActions()
  return (
    <button
      type="button"
      aria-label={`Abrir detalhes da mesa ${identifier.tableNumber}`}
      onClick={(event) => {
        event.stopPropagation()
        onOpen(identifier)
      }}
      className="group inline-flex min-h-10 items-center gap-2 rounded-lg text-left font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
    >
      <span className="grid size-8 place-items-center rounded-lg bg-primary/[0.08] text-xs font-semibold text-primary">
        {String(identifier.tableNumber).padStart(2, "0")}
      </span>
      <span>Mesa {identifier.tableNumber}</span>
    </button>
  )
}

function IdentifierAvailabilityCell({
  identifier,
}: {
  identifier: IdentifierDTO
}) {
  const { busyIdentifierId, onToggleActive } = useIdentifierTableActions()
  const busy = busyIdentifierId === identifier.id
  return (
    <div className="flex items-center gap-2.5">
      <Switch
        checked={identifier.isActive}
        disabled={busy}
        aria-label={`${identifier.isActive ? "Desativar" : "Ativar"} identificador da mesa ${identifier.tableNumber}`}
        onCheckedChange={(checked) => {
          if (checked !== identifier.isActive) onToggleActive(identifier)
        }}
        onClick={(event) => event.stopPropagation()}
      />
      <span
        className={`text-xs font-medium ${identifier.isActive ? "text-foreground" : "text-muted-foreground"}`}
      >
        {identifier.isActive ? "Ativa" : "Desativada"}
      </span>
    </div>
  )
}

function IdentifierActionsCell({ identifier }: { identifier: IdentifierDTO }) {
  const { busyIdentifierId, copiedIdentifierId, onCopyLink, onEdit } =
    useIdentifierTableActions()
  const busy = busyIdentifierId === identifier.id
  const copied = copiedIdentifierId === identifier.id

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Mais ações para a mesa ${identifier.tableNumber}`}
              onClick={(event) => event.stopPropagation()}
              className="size-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            />
          }
        >
          <LuEllipsis aria-hidden="true" className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-48"
          onClick={(event) => event.stopPropagation()}
        >
          <DropdownMenuItem
            onClick={(event) => {
              event.stopPropagation()
              void onCopyLink(identifier)
            }}
          >
            {copied ? (
              <LuCheck aria-hidden="true" />
            ) : (
              <LuCopy aria-hidden="true" />
            )}
            {copied ? "Link copiado" : "Copiar link"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation()
              onEdit(identifier)
            }}
          >
            <LuPencil aria-hidden="true" />
            Editar mesa
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

const identifierColumns = columnHelper.columns([
  columnHelper.accessor("tableNumber", {
    id: "tableNumber",
    sortFn: "basic",
    header: ({ column }) => <TableNumberHeader column={column} />,
    cell: ({ row }) => <IdentifierNameCell identifier={row.original} />,
  }),
  columnHelper.display({
    id: "nfcStatus",
    header: "Estado da etiqueta",
    cell: ({ row }) => <IdentifierNfcStatus identifier={row.original} />,
  }),
  columnHelper.display({
    id: "availability",
    header: "Disponibilidade",
    cell: ({ row }) => <IdentifierAvailabilityCell identifier={row.original} />,
  }),
  columnHelper.display({
    id: "actions",
    header: () => <span className="block text-right">Ações</span>,
    cell: ({ row }) => <IdentifierActionsCell identifier={row.original} />,
  }),
])

const getIdentifierRowId = (identifier: IdentifierDTO) => identifier.id

export function IdentifiersDataTable({
  rows,
  busyIdentifierId,
  copiedIdentifierId,
  onOpen,
  onToggleActive,
  onEdit,
  onCopyLink,
}: IdentifiersDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "tableNumber", desc: false },
  ])
  const actions = useMemo(
    () => ({
      busyIdentifierId,
      copiedIdentifierId,
      onOpen,
      onToggleActive,
      onEdit,
      onCopyLink,
    }),
    [
      busyIdentifierId,
      copiedIdentifierId,
      onOpen,
      onToggleActive,
      onEdit,
      onCopyLink,
    ]
  )

  const table = useTable({
    features: identifierTableFeatures,
    data: rows,
    columns: identifierColumns,
    getRowId: getIdentifierRowId,
    state: { sorting },
    onSortingChange: setSorting,
  })

  return (
    <IdentifierTableActionsContext.Provider value={actions}>
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <Table className="min-w-[720px]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="bg-muted/30 hover:bg-muted/30"
              >
                {headerGroup.headers.map((header) => {
                  const direction = header.column.getIsSorted()
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={
                        direction === "asc"
                          ? "ascending"
                          : direction === "desc"
                            ? "descending"
                            : undefined
                      }
                      className={`h-11 px-5 text-[0.65rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase ${header.column.id === "actions" ? "text-right" : ""}`}
                    >
                      {header.isPlaceholder ? null : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <ContextMenu key={row.id}>
                <ContextMenuTrigger
                  render={
                    <TableRow
                      onClick={(event) => {
                        const target = event.target
                        if (
                          target instanceof Element &&
                          target.closest(
                            'button,[role="switch"],[data-slot="switch"],[data-slot^="dropdown-menu-"],[data-slot^="context-menu-"]'
                          )
                        ) {
                          return
                        }
                        onOpen(row.original)
                      }}
                      className="cursor-pointer border-border/60 transition-colors last:border-0 focus-within:bg-muted/25 hover:bg-muted/35 motion-reduce:transition-none"
                    />
                  }
                >
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id} className="px-5 py-3.5">
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </ContextMenuTrigger>
                <ContextMenuContent
                  className="min-w-48"
                  onClick={(event) => event.stopPropagation()}
                >
                  <ContextMenuItem
                    onClick={(event) => {
                      event.stopPropagation()
                      void onCopyLink(row.original)
                    }}
                  >
                    {copiedIdentifierId === row.original.id ? (
                      <LuCheck aria-hidden="true" />
                    ) : (
                      <LuCopy aria-hidden="true" />
                    )}
                    {copiedIdentifierId === row.original.id
                      ? "Link copiado"
                      : "Copiar link"}
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    disabled={busyIdentifierId === row.original.id}
                    onClick={(event) => {
                      event.stopPropagation()
                      onEdit(row.original)
                    }}
                  >
                    <LuPencil aria-hidden="true" />
                    Editar mesa
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </TableBody>
        </Table>
      </div>
    </IdentifierTableActionsContext.Provider>
  )
}
