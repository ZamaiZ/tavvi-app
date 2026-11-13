import { LuArrowUpRight, LuCircleAlert, LuCircleDashed, LuShieldCheck, LuToggleLeft, LuToggleRight } from "react-icons/lu"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { IdentifierDTO } from "../model"

function NfcStatus({ identifier }: { identifier: IdentifierDTO }) {
  if (identifier.nfcStatus === "protected") {
    return <Badge variant="outline" className="h-7 border-emerald-600/20 bg-emerald-600/[0.07] px-2.5 text-emerald-700 dark:text-emerald-400"><LuShieldCheck aria-hidden="true" className="size-3.5" />Protegida</Badge>
  }
  if (identifier.nfcStatus === "uncertain") {
    return <Badge variant="outline" className="h-7 border-amber-600/25 bg-amber-500/[0.08] px-2.5 text-amber-800 dark:text-amber-300"><LuCircleAlert aria-hidden="true" className="size-3.5" />Proteção incerta</Badge>
  }
  return <Badge variant="outline" className="h-7 border-border/80 bg-muted/50 px-2.5 text-muted-foreground"><LuCircleDashed aria-hidden="true" className="size-3.5" />NFC pendente</Badge>
}

export function IdentifierListItem({
  identifier,
  busy = false,
  onOpen,
  onToggleActive,
  layout,
}: {
  identifier: IdentifierDTO
  busy?: boolean
  onOpen: () => void
  onToggleActive: () => void
  layout: "desktop" | "mobile"
}) {
  if (layout === "desktop") {
    return (
      <div role="row" className="hidden grid-cols-[1fr_1.2fr_0.8fr_0.7fr] items-center border-b border-border/60 transition-colors last:border-b-0 hover:bg-muted/30 md:grid">
        <div role="cell" className="px-5 py-3">
          <button type="button" onClick={onOpen} className="group inline-flex min-h-10 items-center gap-2 rounded-lg text-left font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/[0.08] text-xs font-semibold text-primary">{String(identifier.tableNumber).padStart(2, "0")}</span>
            <span>Mesa {identifier.tableNumber}</span>
            <LuArrowUpRight aria-hidden="true" className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
          </button>
        </div>
        <div role="cell" className="px-5 py-3"><NfcStatus identifier={identifier} /></div>
        <div role="cell" className="px-5 py-3">
          <Badge variant="outline" className={identifier.isActive ? "border-primary/20 bg-primary/[0.06] text-primary" : "border-border text-muted-foreground"}>
            {identifier.isActive ? "Ativa" : "Desativada"}
          </Badge>
        </div>
        <div role="cell" className="px-5 py-3 text-right">
          <div className="inline-flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onOpen} className="h-9 rounded-lg px-3">Detalhes</Button>
            <Button type="button" variant="ghost" size="icon" disabled={busy} onClick={onToggleActive} aria-label={`${identifier.isActive ? "Desativar" : "Ativar"} identificador da mesa ${identifier.tableNumber}`} title={identifier.isActive ? "Desativar identificador" : "Ativar identificador"} className="size-9 rounded-lg text-muted-foreground hover:text-foreground">
              {identifier.isActive ? <LuToggleRight aria-hidden="true" className="size-4" /> : <LuToggleLeft aria-hidden="true" className="size-4" />}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
      <article className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none md:hidden">
        <div className="flex items-start justify-between gap-3">
          <button type="button" onClick={onOpen} className="group -ml-1 flex min-h-10 min-w-0 items-center gap-2.5 rounded-lg px-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/[0.08] text-xs font-semibold text-primary">{String(identifier.tableNumber).padStart(2, "0")}</span>
            <span className="min-w-0"><span className="block truncate text-sm font-semibold">Mesa {identifier.tableNumber}</span><span className="mt-0.5 block text-xs text-muted-foreground">Identificador {identifier.isActive ? "ativo" : "desativado"}</span></span>
          </button>
          <NfcStatus identifier={identifier} />
        </div>
        <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-3">
          <Button type="button" variant="outline" disabled={busy} onClick={onOpen} className="min-h-11 flex-1 rounded-xl">Abrir detalhes</Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={onToggleActive} aria-label={`${identifier.isActive ? "Desativar" : "Ativar"} identificador da mesa ${identifier.tableNumber}`} className="min-h-11 rounded-xl px-3 text-muted-foreground">
            {identifier.isActive ? <><LuToggleRight aria-hidden="true" className="size-4" />Desativar</> : <><LuToggleLeft aria-hidden="true" className="size-4" />Ativar</>}
          </Button>
        </div>
      </article>
  )
}

