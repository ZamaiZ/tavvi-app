"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { motion, useReducedMotion } from "motion/react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { LuCheck, LuCopy, LuLink, LuMailPlus, LuShieldCheck, LuShare2 } from "react-icons/lu"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Combobox as ComboboxRoot, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { createPanelTeamInviteAction } from "@/features/panel/team/actions"
import { TEAM_ROLES, teamRoleDescriptions, teamRoleLabels, type TeamRole } from "@/features/panel/team/model"

const teamRoleOptions = TEAM_ROLES.map((value) => ({ value, label: teamRoleLabels[value] }))
const teamRoleItems = ComboboxPrimitive.createItems(teamRoleOptions, {
  getValue: (option) => option.value,
  getLabel: (option) => option.label,
})

type TeamInviteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialEmail?: string
  initialRole?: TeamRole
}

export function TeamInviteDialog({ open, onOpenChange, initialEmail = "", initialRole = "attendant" }: TeamInviteDialogProps) {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const [isPending, startTransition] = useTransition()
  const linkInputRef = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState(initialEmail)
  const [role, setRole] = useState<TeamRole>(initialRole)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle")
  const [message, setMessage] = useState("")
  const [discardOpen, setDiscardOpen] = useState(false)
  const [shareAvailable, setShareAvailable] = useState(false)
  const [shared, setShared] = useState(false)

  useEffect(() => {
    if (!open) return
    setEmail(initialEmail)
    setRole(initialRole)
    setGeneratedLink(null)
    setCopyState("idle")
    setMessage("")
    setShareAvailable(typeof navigator !== "undefined" && typeof navigator.share === "function")
    setShared(false)
  }, [initialEmail, initialRole, open])

  function requestClose(nextOpen: boolean) {
    if (!nextOpen && isPending) return
    if (!nextOpen && generatedLink && copyState !== "copied" && !shared) {
      setDiscardOpen(true)
      return
    }
    onOpenChange(nextOpen)
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage("")
    startTransition(async () => {
      try {
        const result = await createPanelTeamInviteAction({ email, role })
        if (!result.ok) {
          const messages: Record<string, string> = {
            invalid_input: "Confira o e-mail informado.",
            unauthorized: "Sua sessão expirou. Entre novamente para continuar.",
            forbidden: "Seu acesso à equipe mudou. Atualize a página e tente novamente.",
            already_member: "Este e-mail já pertence a uma pessoa ativa da equipe.",
            unavailable: "O convite não está disponível agora. Atualize a lista e tente novamente.",
            service_unavailable: "Não foi possível emitir o convite. Tente novamente em instantes.",
          }
          setMessage(messages[result.code] ?? "Não foi possível emitir o convite.")
          return
        }
        setGeneratedLink(result.link)
        setCopyState("idle")
        router.refresh()
      } catch {
        setMessage("Não foi possível conectar ao servidor. Tente novamente.")
      }
    })
  }

  async function copyLink() {
    if (!generatedLink) return
    try {
      await navigator.clipboard.writeText(generatedLink)
      setCopyState("copied")
    } catch {
      setCopyState("error")
      linkInputRef.current?.focus()
      linkInputRef.current?.select()
    }
  }

  async function shareLink() {
    if (!generatedLink || !navigator.share) return
    try {
      await navigator.share({
        title: "Convite para a equipe Tavvi",
        text: `Entre para a equipe usando ${email}.`,
        url: generatedLink,
      })
      setShared(true)
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return
      setMessage("Não foi possível abrir o compartilhamento. Copie o link para enviar manualmente.")
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={requestClose}>
        <DialogContent className="max-h-[min(92dvh,44rem)] overflow-y-auto rounded-[1.5rem] border-border/70 bg-background/95 p-5 shadow-2xl backdrop-blur-2xl sm:max-w-lg sm:p-6">
          <DialogHeader className="pr-7">
            <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><LuMailPlus aria-hidden="true" className="size-4" /></div>
            <DialogTitle className="text-lg tracking-tight">{generatedLink ? "Convite pronto para compartilhar" : initialEmail ? "Gerar um novo link" : "Convidar para a equipe"}</DialogTitle>
            <DialogDescription>
              {generatedLink
                ? `O link foi criado para ${email}. Ele pode ser usado por uma conta com esse mesmo e-mail.`
                : "Informe o e-mail de login e escolha o cargo que será atribuído quando a pessoa aceitar."}
            </DialogDescription>
          </DialogHeader>

          {generatedLink ? (
            <motion.section initial={reduceMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }} className="grid gap-4">
              <div className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-primary/[0.045] p-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-background text-primary shadow-sm"><LuShieldCheck aria-hidden="true" className="size-4" /></span>
                <div className="min-w-0"><p className="text-sm font-semibold">{teamRoleLabels[role]}</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{teamRoleDescriptions[role]} O convite vence em 7 dias.</p></div>
              </div>
              <div className="grid gap-2">
                <label htmlFor="team-invite-link" className="text-xs font-medium text-muted-foreground">Link de convite</label>
                <div className="flex gap-2">
                  <Input ref={linkInputRef} id="team-invite-link" value={generatedLink} readOnly onFocus={(event) => event.currentTarget.select()} onCopy={() => setCopyState("copied")} className="h-10 min-w-0 rounded-xl font-mono text-[0.65rem]" />
                  {shareAvailable ? <Button type="button" variant="outline" onClick={shareLink} aria-label="Compartilhar convite" className="h-10 shrink-0 rounded-xl px-3"><LuShare2 aria-hidden="true" /><span className="hidden sm:inline">Enviar</span></Button> : null}
                  <Button type="button" variant={copyState === "copied" ? "secondary" : "default"} onClick={copyLink} className="h-10 shrink-0 rounded-xl px-3">
                    {copyState === "copied" ? <LuCheck aria-hidden="true" /> : <LuCopy aria-hidden="true" />}
                    <span className="hidden sm:inline">{copyState === "copied" ? "Copiado" : "Copiar"}</span>
                  </Button>
                </div>
                {copyState === "error" ? <p role="status" className="text-xs text-destructive">Não foi possível copiar automaticamente. O link está selecionado para cópia manual.</p> : <p className="text-xs text-muted-foreground">Envie este link diretamente para a pessoa convidada.</p>}
                {shared ? <p role="status" className="text-xs text-primary">Link compartilhado.</p> : null}
                {message ? <p role="alert" className="text-xs text-destructive">{message}</p> : null}
              </div>
              <DialogFooter className="gap-2 sm:justify-end">
                <Button type="button" variant="outline" disabled={copyState !== "copied" && !shared} onClick={() => requestClose(false)} className="min-h-10 rounded-xl">Concluir</Button>
              </DialogFooter>
            </motion.section>
          ) : (
            <form onSubmit={submit} className="grid gap-4">
              <div className="grid gap-2">
                <label htmlFor="team-invite-email" className="text-xs font-medium">E-mail de login</label>
                <Input id="team-invite-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} value={email} onChange={(event) => setEmail(event.currentTarget.value)} placeholder="pessoa@restaurante.com.br" className="h-11 rounded-xl" />
                <p className="text-xs leading-5 text-muted-foreground">A pessoa deverá criar ou acessar a conta usando exatamente este e-mail.</p>
              </div>
              <div className="grid gap-2">
                <label htmlFor="team-invite-role" className="text-xs font-medium">Cargo</label>
                <ComboboxRoot items={teamRoleItems} value={role} onValueChange={(value) => { if (typeof value === "string") setRole(value as TeamRole) }}>
                  <ComboboxInput id="team-invite-role" placeholder="Selecione um cargo" className="h-11 w-full rounded-xl text-sm" autoComplete="off" />
                  <ComboboxContent className="border border-border/70 bg-popover/95 shadow-xl">
                    <ComboboxEmpty>Nenhum cargo encontrado.</ComboboxEmpty>
                    <ComboboxList>
                      {teamRoleOptions.map((option) => <ComboboxItem key={option.value} value={option.value} className="justify-between">{option.label}</ComboboxItem>)}
                    </ComboboxList>
                  </ComboboxContent>
                </ComboboxRoot>
                <p className="text-xs leading-5 text-muted-foreground">{teamRoleDescriptions[role]}</p>
              </div>
              {message ? <Alert variant="destructive" className="rounded-xl"><AlertTitle>Convite não emitido</AlertTitle><AlertDescription>{message}</AlertDescription></Alert> : null}
              <DialogFooter className="gap-2 sm:pt-1">
                <Button type="button" variant="outline" disabled={isPending} onClick={() => requestClose(false)} className="min-h-11 rounded-xl">Cancelar</Button>
                <motion.div whileHover={reduceMotion ? undefined : { y: -1 }} whileTap={reduceMotion ? undefined : { scale: 0.985 }} transition={{ duration: 0.16, ease: "easeOut" }} className="sm:flex-1">
                  <Button type="submit" disabled={isPending || !email.trim()} className="min-h-11 w-full rounded-xl shadow-sm shadow-primary/10">
                    {isPending ? <span className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current motion-reduce:animate-none" /> : <LuLink aria-hidden="true" />}
                    {isPending ? "Emitindo link…" : "Emitir convite"}
                  </Button>
                </motion.div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar o link?</AlertDialogTitle>
            <AlertDialogDescription>Este link é exibido uma única vez. Ao fechar agora, gere outro link para compartilhar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar aqui</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { setDiscardOpen(false); onOpenChange(false) }}>Descartar link</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
