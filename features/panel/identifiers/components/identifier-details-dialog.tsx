"use client"

import { useState } from "react"
import { LuCheck, LuCopy, LuExternalLink, LuLink, LuPencil, LuShieldCheck, LuToggleLeft, LuToggleRight } from "react-icons/lu"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { IdentifierDTO } from "../model"
import { setIdentifierActiveAction } from "../actions"
import { IdentifierNfcRegistration } from "./identifier-nfc-registration"

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  } catch {
    return "Data indisponível"
  }
}

function nfcLabel(identifier: IdentifierDTO) {
  if (identifier.nfcStatus === "protected") return { title: "Etiqueta protegida", description: "O conteúdo foi gravado e o bloqueio permanente foi confirmado.", tone: "border-emerald-600/20 bg-emerald-600/[0.055]" }
  if (identifier.nfcOperationStatus === "authorizing") return { title: "Confirmação NFC em andamento", description: "Uma tela está preparando a tentativa. A etiqueta ainda não recebeu nenhuma ação física.", tone: "border-primary/20 bg-primary/[0.045]" }
  if (identifier.nfcStatus === "uncertain") return { title: "Proteção incerta", description: "A gravação pode ter sido concluída. Retome a leitura para finalizar o bloqueio sem regravar.", tone: "border-amber-600/25 bg-amber-500/[0.055]" }
  return { title: "Etiqueta ainda não vinculada", description: "A mesa já tem um link. Vincule uma etiqueta NFC para abri-lo com aproximação.", tone: "border-border/70 bg-muted/30" }
}

export function IdentifierDetailsDialog({
  open,
  identifier,
  restaurantId,
  onOpenChange,
  onEdit,
  onSaved,
}: {
  open: boolean
  identifier: IdentifierDTO | null
  restaurantId: string
  onOpenChange: (open: boolean) => void
  onEdit: (identifier: IdentifierDTO) => void
  onSaved: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [nfcOpen, setNfcOpen] = useState(false)
  if (!identifier) return null
  const selectedIdentifier = identifier
  const nfc = nfcLabel(selectedIdentifier)

  async function copyLink() {
    setCopyError(false)
    try {
      await navigator.clipboard.writeText(selectedIdentifier.publicUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopyError(true)
    }
  }

  async function toggleActive() {
    setBusy(true)
    setMessage(null)
    try {
      const result = await setIdentifierActiveAction({
        expectedRestaurantId: restaurantId,
        id: selectedIdentifier.id,
        isActive: !selectedIdentifier.isActive,
      })
      if (!result.ok) {
        setMessage(result.code === "table_conflict" ? "Outra mesa já usa esse número." : "Não foi possível atualizar o identificador. Tente novamente.")
        return
      }
      onSaved()
    } catch {
      setMessage("Não foi possível conectar ao servidor. Tente novamente.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92dvh,48rem)] overflow-y-auto rounded-[1.5rem] border-border/70 bg-background/95 p-5 shadow-2xl backdrop-blur-2xl sm:max-w-xl sm:p-6">
        <DialogHeader className="pr-7">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-lg tracking-tight">Mesa {identifier.tableNumber}</DialogTitle>
            <Badge variant="outline" className={identifier.isActive ? "border-primary/20 bg-primary/[0.06] text-primary" : "border-border text-muted-foreground"}>{identifier.isActive ? "Ativa" : "Desativada"}</Badge>
          </div>
          <DialogDescription>Gerencie o link e o estado da etiqueta NFC desta mesa.</DialogDescription>
        </DialogHeader>

        <section className="grid gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><LuLink aria-hidden="true" className="size-4 text-primary" />LINK PÚBLICO</div>
          <p className="break-all rounded-xl bg-muted/45 px-3 py-3 font-mono text-xs leading-5 text-foreground">{identifier.publicUrl}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={copyLink} className="min-h-10 flex-1 rounded-xl">{copied ? <><LuCheck aria-hidden="true" />Copiado</> : <><LuCopy aria-hidden="true" />Copiar link</>}</Button>
            {identifier.isActive ? <Button type="button" variant="ghost" render={<a href={identifier.publicUrl} target="_blank" rel="noreferrer" />} className="min-h-10 rounded-xl"><LuExternalLink aria-hidden="true" />Abrir</Button> : <Button type="button" variant="ghost" disabled className="min-h-10 rounded-xl"><LuExternalLink aria-hidden="true" />Link suspenso</Button>}
          </div>
          {copyError ? <p role="status" className="text-xs text-destructive">Não foi possível copiar. Selecione e copie o link manualmente.</p> : null}
        </section>

        <section className={`grid gap-3 rounded-2xl border p-4 ${nfc.tone}`}>
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-background/80 text-primary"><LuShieldCheck aria-hidden="true" className="size-4" /></span>
            <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{nfc.title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{nfc.description}</p></div>
          </div>
          {identifier.nfcStatus === "protected" ? (
            <div className="grid gap-1 rounded-xl bg-background/65 px-3 py-2.5 text-xs sm:grid-cols-2">
              <p><span className="text-muted-foreground">Serial:</span> <span className="font-mono">{identifier.nfcSerial}</span></p>
              <p className="sm:text-right"><span className="text-muted-foreground">Protegida em:</span> {identifier.nfcProtectedAt ? formatDate(identifier.nfcProtectedAt) : "—"}</p>
            </div>
          ) : identifier.isActive ? (
            <Button type="button" variant={identifier.nfcStatus === "uncertain" ? "outline" : "default"} onClick={() => setNfcOpen((current) => !current)} className="min-h-11 w-full rounded-xl">
              {identifier.nfcStatus === "uncertain" ? "Retomar proteção NFC" : identifier.nfcOperationId ? "Consultar tentativa NFC" : "Vincular etiqueta NFC"}
            </Button>
          ) : <p className="rounded-xl bg-background/60 px-3 py-2.5 text-xs text-muted-foreground">Ative o identificador para vincular uma nova etiqueta NFC.</p>}
        </section>

        {nfcOpen && identifier.isActive && identifier.nfcStatus !== "protected" ? <IdentifierNfcRegistration identifier={identifier} restaurantId={restaurantId} onChanged={onSaved} /> : null}

        {message ? <p role="alert" className="text-xs leading-5 text-destructive">{message}</p> : null}
        <DialogFooter className="gap-2 sm:flex-row">
          <Button type="button" variant="ghost" disabled={busy} onClick={() => onEdit(identifier)} className="min-h-11 rounded-xl"><LuPencil aria-hidden="true" />Editar mesa</Button>
          <Button type="button" variant={identifier.isActive ? "outline" : "default"} disabled={busy} onClick={toggleActive} className="min-h-11 rounded-xl">
            {identifier.isActive ? <><LuToggleRight aria-hidden="true" />Desativar link</> : <><LuToggleLeft aria-hidden="true" />Ativar link</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

