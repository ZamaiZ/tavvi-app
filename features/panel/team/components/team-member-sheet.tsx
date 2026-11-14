"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { LuAtSign, LuCalendarDays, LuCheck, LuCopy, LuShieldCheck, LuUserRound } from "react-icons/lu"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Combobox as ComboboxRoot, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { updatePanelTeamMemberRoleAction } from "@/features/panel/team/actions"
import { formatTeamDate, TEAM_ROLES, teamRoleDescriptions, teamRoleLabels, type TeamRole, type TeamRow } from "@/features/panel/team/model"

const teamRoleOptions = TEAM_ROLES.map((value) => ({ value, label: teamRoleLabels[value] }))
const teamRoleItems = ComboboxPrimitive.createItems(teamRoleOptions, {
  getValue: (option) => option.value,
  getLabel: (option) => option.label,
})

type TeamMemberSheetProps = {
  row: TeamRow | null
  canEditRoles: boolean
  actorId: string
  onOpenChange: (open: boolean) => void
}

export function TeamMemberSheet({ row, canEditRoles, actorId, onOpenChange }: TeamMemberSheetProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [role, setRole] = useState<TeamRole>(row?.role ?? "attendant")
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle")
  const [message, setMessage] = useState("")

  useEffect(() => {
    setRole(row?.role ?? "attendant")
    setCopyState("idle")
    setMessage("")
  }, [row?.id, row?.role])

  async function copyEmail() {
    if (!row || !row.email) {
      setCopyState("error")
      return
    }
    try {
      await navigator.clipboard.writeText(row.email)
      setCopyState("copied")
      window.setTimeout(() => setCopyState("idle"), 1600)
    } catch {
      setCopyState("error")
    }
  }

  function saveRole() {
    if (!row || row.kind !== "member" || role === row.role) return
    setMessage("")
    startTransition(async () => {
      try {
        const result = await updatePanelTeamMemberRoleAction({ membershipId: row.id, role })
        if (!result.ok) {
          const messages: Record<string, string> = {
            invalid_input: "O cargo informado não é válido.",
            unauthorized: "Sua sessão expirou. Entre novamente para continuar.",
            forbidden: "Somente um administrador pode alterar cargos.",
            self_role_change_blocked: "Outro administrador precisa alterar o seu cargo.",
            last_admin: "O restaurante precisa manter pelo menos um administrador ativo.",
            member_unavailable: "Esta membership não está mais ativa. Atualize a lista.",
            unavailable: "A equipe mudou. Atualize a lista e tente novamente.",
            already_member: "Esta pessoa já faz parte da equipe.",
            service_unavailable: "Não foi possível atualizar o cargo agora.",
          }
          setMessage(messages[result.code] ?? "Não foi possível atualizar o cargo.")
          return
        }
        router.refresh()
        onOpenChange(false)
      } catch {
        setMessage("Não foi possível conectar ao servidor. Tente novamente.")
      }
    })
  }

  const isSelf = row?.userId === actorId

  return (
    <Sheet open={Boolean(row)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[min(100vw,30rem)] gap-0 overflow-y-auto border-border/70 bg-background/95 p-0 backdrop-blur-2xl sm:max-w-lg">
        {row ? (
          <>
            <SheetHeader className="border-b border-border/60 px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3 pr-8">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-border/70 bg-primary/[0.07] text-primary"><LuUserRound aria-hidden="true" className="size-5" /></span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <SheetTitle className="truncate text-lg font-semibold tracking-tight">{row.name}</SheetTitle>
                    {row.kind === "member" ? <Badge variant="outline" className="border-emerald-600/20 bg-emerald-600/[0.06] text-emerald-700 dark:text-emerald-300"><LuShieldCheck aria-hidden="true" />Ativo</Badge> : <Badge variant="outline" className="border-amber-600/25 bg-amber-500/[0.08] text-amber-800 dark:text-amber-300">Convite pendente</Badge>}
                  </div>
                  <SheetDescription className="mt-1">{row.kind === "member" ? "Pessoa vinculada ao restaurante." : "Aguardando o primeiro acesso."}</SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="grid gap-5 px-5 py-5 sm:px-6">
              <section className="grid gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><LuAtSign aria-hidden="true" className="size-4" /></span>
                  <div className="min-w-0 flex-1"><p className="text-[0.625rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">E-mail de acesso</p><p className="mt-1 break-all text-sm font-medium">{row.email || "Não informado"}</p></div>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label="Copiar e-mail" onClick={copyEmail} disabled={!row.email} className="shrink-0 rounded-lg">{copyState === "copied" ? <LuCheck aria-hidden="true" /> : <LuCopy aria-hidden="true" />}</Button>
                </div>
                {copyState === "error" ? <p role="status" className="text-xs text-destructive">Não foi possível copiar o e-mail.</p> : null}
              </section>

              <section className="grid gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><LuShieldCheck aria-hidden="true" className="size-4 text-primary" />CARGO</div>
                <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary" className="bg-muted/75 text-foreground/80">{teamRoleLabels[row.role]}</Badge><p className="min-w-0 flex-1 text-xs leading-5 text-muted-foreground">{teamRoleDescriptions[row.role]}</p></div>
                {row.kind === "member" && !canEditRoles ? <p className="rounded-xl bg-muted/40 px-3 py-2.5 text-xs leading-5 text-muted-foreground">Somente um administrador pode alterar cargos. As demais áreas do painel continuam disponíveis para toda a equipe.</p> : null}
                {canEditRoles && row.kind === "member" ? (
                  isSelf ? <p className="rounded-xl bg-muted/40 px-3 py-2.5 text-xs leading-5 text-muted-foreground">Para alterar o seu próprio cargo, outro administrador precisa fazer isso.</p> : (
                    <div className="grid gap-2 border-t border-border/60 pt-3">
                      <label htmlFor="team-member-role" className="text-xs font-medium">Alterar cargo</label>
                      <ComboboxRoot items={teamRoleItems} value={role} onValueChange={(value) => { if (typeof value === "string") setRole(value as TeamRole) }}>
                        <ComboboxInput id="team-member-role" placeholder="Selecione um cargo" className="h-10 w-full rounded-xl text-sm" autoComplete="off" />
                        <ComboboxContent className="border border-border/70 bg-popover/95 shadow-xl">
                          <ComboboxEmpty>Nenhum cargo encontrado.</ComboboxEmpty>
                          <ComboboxList>
                            {teamRoleOptions.map((option) => <ComboboxItem key={option.value} value={option.value} className="justify-between">{option.label}</ComboboxItem>)}
                          </ComboboxList>
                        </ComboboxContent>
                      </ComboboxRoot>
                      <p className="text-xs leading-5 text-muted-foreground">O cargo organiza a equipe. Ele não altera o acesso desta pessoa às demais áreas do painel.</p>
                      {message ? <p role="alert" className="text-xs leading-5 text-destructive">{message}</p> : null}
                    </div>
                  )
                ) : null}
              </section>

              <section className="grid gap-2 rounded-2xl border border-border/70 bg-muted/20 p-4">
                <p className="flex items-center gap-2 text-[0.625rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase"><LuCalendarDays aria-hidden="true" className="size-3.5" />{row.kind === "member" ? "Entrou em" : "Convite enviado em"}</p>
                <p className="text-sm font-medium tabular-nums">{formatTeamDate(row.createdAt)}</p>
                {row.kind === "invite" ? <p className="text-xs leading-5 text-muted-foreground">Válido até {formatTeamDate(row.expiresAt)}. O cadastro precisa usar este mesmo e-mail.</p> : null}
              </section>
            </div>

            {canEditRoles && row.kind === "member" && !isSelf ? (
              <SheetFooter className="mt-auto border-t border-border/60 px-5 py-4 sm:px-6">
                <Button type="button" disabled={isPending || role === row.role} onClick={saveRole} className="min-h-11 w-full rounded-xl">
                  {isPending ? <span className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current motion-reduce:animate-none" /> : <LuCheck aria-hidden="true" />}
                  {isPending ? "Salvando cargo…" : "Salvar cargo"}
                </Button>
              </SheetFooter>
            ) : null}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
