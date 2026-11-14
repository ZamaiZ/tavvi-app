"use client"

import { useEffect, useState, type FormEvent } from "react"
import { LuPlus, LuSave } from "react-icons/lu"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { IdentifierDTO } from "../model"
import { createIdentifierAction, updateIdentifierAction } from "../actions"

function failureMessage(code: string) {
  if (code === "table_conflict") return "Já existe uma mesa ativa com esse número. Escolha outro número."
  if (code === "active_call") return "Conclua o chamado ativo antes de alterar ou desativar este identificador."
  if (code === "session_expired") return "Sua sessão expirou. Entre novamente para salvar."
  if (code === "context_changed") return "O restaurante ativo mudou. Atualize a página antes de salvar."
  if (code === "invalid_input") return "Informe um número de mesa válido."
  return "Não foi possível salvar a mesa. Tente novamente."
}

export function IdentifierEditorDialog({
  open,
  identifier,
  restaurantId,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  identifier: IdentifierDTO | null
  restaurantId: string
  onOpenChange: (open: boolean) => void
  onSaved: (identifierId: string) => void
}) {
  const [tableNumber, setTableNumber] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTableNumber(identifier ? String(identifier.tableNumber) : "")
    setError(null)
    setBusy(false)
  }, [identifier?.id, identifier?.tableNumber, open])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const value = Number(tableNumber)
    try {
      const result = identifier
        ? await updateIdentifierAction({ expectedRestaurantId: restaurantId, id: identifier.id, tableNumber: value })
        : await createIdentifierAction({ expectedRestaurantId: restaurantId, tableNumber: value })
      if (!result.ok) {
        setError(failureMessage(result.code))
        return
      }
      onSaved(result.data.id)
      onOpenChange(false)
    } catch {
      setError("Não foi possível conectar ao servidor. Tente novamente.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,40rem)] overflow-y-auto rounded-[1.5rem] border-border/70 bg-background/95 p-5 shadow-2xl backdrop-blur-2xl sm:max-w-md sm:p-6">
        <DialogHeader className="pr-7">
          <DialogTitle className="text-lg tracking-tight">{identifier ? "Editar mesa" : "Nova mesa"}</DialogTitle>
          <DialogDescription>{identifier ? "O link e o conteúdo da etiqueta continuam iguais." : "Crie um link permanente para abrir o cardápio do restaurante."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="identifier-table-number">Número da mesa</Label>
              <Input id="identifier-table-number" type="number" min={1} max={2_147_483_647} step={1} inputMode="numeric" autoFocus value={tableNumber} onChange={(event) => setTableNumber(event.target.value)} placeholder="Ex.: 12" disabled={busy} className="h-12 rounded-xl text-base" aria-describedby={error ? "identifier-table-error" : undefined} />
            {error ? <p id="identifier-table-error" role="alert" className="text-xs leading-5 text-destructive">{error}</p> : <p className="text-xs leading-5 text-muted-foreground">Use um número inteiro maior que zero.</p>}
          </div>
          {identifier ? (
            <div className="rounded-xl border border-border/70 bg-muted/35 p-3 text-xs leading-5 text-muted-foreground">
              Alterar o número mantém o identificador e o link já gravado na etiqueta. A mesa de origem ficará disponível quando ela não tiver outro identificador ativo.
            </div>
          ) : (
            <div className="rounded-xl border border-primary/15 bg-primary/[0.045] p-3 text-xs leading-5 text-muted-foreground">
              Uma mesa pode ter apenas um identificador ativo. Você poderá vincular uma etiqueta NFC depois de criar a mesa.
            </div>
          )}
          <DialogFooter className="gap-2 sm:flex-row">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => onOpenChange(false)} className="min-h-11 rounded-xl">Cancelar</Button>
            <Button type="submit" disabled={busy || !tableNumber || Number(tableNumber) <= 0 || Number(tableNumber) > 2_147_483_647 || !Number.isSafeInteger(Number(tableNumber))} className="min-h-11 rounded-xl">
              {busy ? "Salvando…" : identifier ? <><LuSave aria-hidden="true" />Salvar alterações</> : <><LuPlus aria-hidden="true" />Criar mesa</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

