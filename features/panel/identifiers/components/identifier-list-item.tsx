import {
  LuCheck,
  LuCopy,
  LuPencil,
  LuToggleLeft,
  LuToggleRight,
} from "react-icons/lu"

import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import type { IdentifierDTO } from "../model"
import { IdentifierNfcStatus } from "./identifier-nfc-status"

export function IdentifierListItem({
  identifier,
  busy = false,
  copied = false,
  onOpen,
  onToggleActive,
  onCopyLink,
  onEdit,
}: {
  identifier: IdentifierDTO
  busy?: boolean
  copied?: boolean
  onOpen: () => void
  onToggleActive: () => void
  onCopyLink: () => Promise<void>
  onEdit: () => void
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <article className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none md:hidden" />
        }
      >
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onOpen}
            className="group -ml-1 flex min-h-10 min-w-0 items-center gap-2.5 rounded-lg px-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/[0.08] text-xs font-semibold text-primary">
              {String(identifier.tableNumber).padStart(2, "0")}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                Mesa {identifier.tableNumber}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Identificador {identifier.isActive ? "ativo" : "desativado"}
              </span>
            </span>
          </button>
          <IdentifierNfcStatus identifier={identifier} />
        </div>
        <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-3">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onOpen}
            className="min-h-11 flex-1 rounded-xl"
          >
            Abrir detalhes
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={onToggleActive}
            aria-label={`${identifier.isActive ? "Desativar" : "Ativar"} identificador da mesa ${identifier.tableNumber}`}
            className="min-h-11 rounded-xl px-3 text-muted-foreground"
          >
            {identifier.isActive ? (
              <>
                <LuToggleRight aria-hidden="true" className="size-4" />
                Desativar
              </>
            ) : (
              <>
                <LuToggleLeft aria-hidden="true" className="size-4" />
                Ativar
              </>
            )}
          </Button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent
        className="min-w-48"
        onClick={(event) => event.stopPropagation()}
      >
        <ContextMenuItem
          onClick={(event) => {
            event.stopPropagation()
            void onCopyLink()
          }}
        >
          {copied ? (
            <LuCheck aria-hidden="true" />
          ) : (
            <LuCopy aria-hidden="true" />
          )}
          {copied ? "Link copiado" : "Copiar link"}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation()
            onEdit()
          }}
        >
          <LuPencil aria-hidden="true" />
          Editar mesa
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
