"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import { MotionConfig, motion, useReducedMotion, type Variants } from "motion/react"
import {
  LuAtSign,
  LuCircleAlert,
  LuClock3,
  LuMailPlus,
  LuSearch,
  LuShieldCheck,
  LuUsers,
} from "react-icons/lu"

import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { removePanelTeamMemberAction, revokePanelTeamInviteAction } from "@/features/panel/team/actions"
import { TeamDataTable } from "@/features/panel/team/components/team-data-table"
import { TeamInviteDialog } from "@/features/panel/team/components/team-invite-dialog"
import { TeamMemberSheet } from "@/features/panel/team/components/team-member-sheet"
import type { TeamFilter, TeamListResult, TeamRole, TeamRow } from "@/features/panel/team/model"

const sequence: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1, transition: { delayChildren: 0.035, staggerChildren: 0.075 } },
}

const item: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.23, 1, 0.32, 1] } },
}

type TeamPageProps = { initialData: TeamListResult }

export function TeamPage({ initialData }: TeamPageProps) {
  const router = useRouter()
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(initialData.search)
  const [selectedFilter, setSelectedFilter] = useState<TeamFilter>(initialData.status)
  const [selectedRow, setSelectedRow] = useState<TeamRow | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteDraft, setInviteDraft] = useState<{ email: string; role: TeamRole }>({ email: "", role: "attendant" })
  const [revokeCandidate, setRevokeCandidate] = useState<TeamRow | null>(null)
  const [revokePending, startRevokeTransition] = useTransition()
  const [removeCandidate, setRemoveCandidate] = useState<TeamRow | null>(null)
  const [removePending, startRemoveTransition] = useTransition()
  const [pageMessage, setPageMessage] = useState("")

  const canEditRoles = initialData.actorRole === "admin"

  useEffect(() => {
    setSearch(initialData.search)
    setSelectedFilter(initialData.status)
  }, [initialData.search, initialData.status])

  const navigateToQuery = useCallback((next: Partial<{ search: string; status: TeamFilter; page: number }>) => {
    const nextQuery = {
      search: search.trim(),
      status: selectedFilter,
      page: 1,
      pageSize: initialData.pageSize,
      ...next,
    }
    const params = new URLSearchParams()
    if (nextQuery.search) params.set("search", nextQuery.search)
    if (nextQuery.status !== "all") params.set("status", nextQuery.status)
    if (nextQuery.page > 1) params.set("page", String(nextQuery.page))
    if (nextQuery.pageSize !== 25) params.set("pageSize", String(nextQuery.pageSize))
    const suffix = params.toString()
    startTransition(() => router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false }))
  }, [initialData.pageSize, pathname, router, search, selectedFilter])

  useEffect(() => {
    const normalized = search.trim()
    if (normalized === initialData.search) return
    const timeout = window.setTimeout(() => navigateToQuery({ search: normalized, page: 1 }), 360)
    return () => window.clearTimeout(timeout)
  }, [initialData.search, navigateToQuery, search])

  useEffect(() => {
    const pageCount = Math.max(1, Math.ceil(initialData.totalRows / initialData.pageSize))
    if (initialData.page > pageCount) navigateToQuery({ page: pageCount })
  }, [initialData.page, initialData.pageSize, initialData.totalRows, navigateToQuery])

  const selectFilter = useCallback((filter: TeamFilter) => {
    setSelectedFilter(filter)
    navigateToQuery({ search: search.trim(), status: filter, page: 1 })
  }, [navigateToQuery, search])

  const clearFilters = useCallback(() => {
    setSearch("")
    setSelectedFilter("all")
    navigateToQuery({ search: "", status: "all", page: 1 })
  }, [navigateToQuery])

  function openInvite(email = "", role: TeamRole = "attendant") {
    setInviteDraft({ email, role })
    setInviteOpen(true)
  }

  async function copyEmail(row: TeamRow) {
    if (!row.email) {
      setPageMessage("Este acesso ainda não tem um e-mail associado.")
      window.setTimeout(() => setPageMessage(""), 2400)
      return
    }
    try {
      await navigator.clipboard.writeText(row.email)
      setPageMessage(`E-mail de ${row.name} copiado.`)
    } catch {
      setPageMessage("Não foi possível copiar automaticamente o e-mail. Abra os detalhes para copiá-lo manualmente.")
    }
    window.setTimeout(() => setPageMessage(""), 2400)
  }

  function confirmRevoke() {
    if (!revokeCandidate) return
    startRevokeTransition(async () => {
      try {
        const result = await revokePanelTeamInviteAction({ inviteId: revokeCandidate.id })
        if (!result.ok) {
          const messages: Record<string, string> = {
            invalid_input: "Este convite não é válido.",
            unauthorized: "Sua sessão expirou. Entre novamente para continuar.",
            forbidden: "Seu acesso à equipe mudou. Atualize a página e tente novamente.",
            unavailable: "Este convite já foi usado ou não está mais disponível.",
            service_unavailable: "Não foi possível revogar o convite agora.",
            already_member: "Esta pessoa já pertence à equipe.",
            member_unavailable: "A equipe foi atualizada. Recarregue a lista.",
            self_role_change_blocked: "Outro administrador precisa alterar este cargo.",
            last_admin: "O restaurante precisa manter pelo menos um administrador.",
          }
          setPageMessage(messages[result.code] ?? "Não foi possível revogar o convite.")
          return
        }
        setRevokeCandidate(null)
        router.refresh()
      } catch {
        setPageMessage("Não foi possível conectar ao servidor. Tente novamente.")
      }
    })
  }

  function confirmRemove() {
    if (!removeCandidate) return
    startRemoveTransition(async () => {
      try {
        const result = await removePanelTeamMemberAction({ membershipId: removeCandidate.id })
        if (!result.ok) {
          const messages: Record<string, string> = {
            invalid_input: "Esta membership não é válida.",
            unauthorized: "Sua sessão expirou. Entre novamente para continuar.",
            forbidden: "Seu acesso à equipe mudou. Atualize a página e tente novamente.",
            member_unavailable: "Esta pessoa já não tem acesso ativo.",
            self_removal_blocked: "Não é possível remover o próprio acesso por esta ação.",
            last_admin: "O restaurante precisa manter pelo menos um administrador ativo.",
            unavailable: "A equipe foi atualizada. Recarregue a lista e tente novamente.",
            service_unavailable: "Não foi possível remover esta pessoa agora.",
            already_member: "Esta pessoa já pertence à equipe.",
            self_role_change_blocked: "Outro administrador precisa alterar este cargo.",
          }
          setPageMessage(messages[result.code] ?? "Não foi possível remover esta pessoa.")
          return
        }
        setRemoveCandidate(null)
        router.refresh()
      } catch {
        setPageMessage("Não foi possível conectar ao servidor. Tente novamente.")
      }
    })
  }

  const pageCount = Math.max(1, Math.ceil(initialData.totalRows / initialData.pageSize))
  const metrics = [
    { filter: "active" as const, label: "Pessoas ativas", value: initialData.activeCount, description: "Com acesso ao restaurante", icon: LuShieldCheck, tone: "text-emerald-700 dark:text-emerald-300", iconSurface: "bg-emerald-600/10" },
    { filter: "pending" as const, label: "Convites pendentes", value: initialData.pendingCount, description: "Aguardando primeiro acesso", icon: LuClock3, tone: "text-amber-800 dark:text-amber-300", iconSurface: "bg-amber-500/10" },
  ]

  return (
    <MotionConfig reducedMotion="user">
      <main className="mx-auto flex min-h-full w-full max-w-[1320px] flex-1 flex-col px-4 py-5 sm:px-6 md:py-6 lg:px-8">
        <motion.div initial={reduceMotion ? false : "hidden"} animate="visible" variants={sequence} className="mx-auto flex w-full max-w-[1220px] flex-col gap-5 sm:gap-6">
          <motion.header variants={item} className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="min-w-0">
              <div className="flex items-start gap-3">
                <SidebarTrigger aria-label="Alternar navegação lateral" title="Alternar navegação lateral" className="mt-0.5 hidden shrink-0 rounded-lg border border-border/70 bg-background shadow-sm md:inline-flex" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[0.625rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary"><LuUsers aria-hidden="true" className="size-3.5" /></span>
                    Equipe
                  </div>
                </div>
              </div>
            </div>
            <motion.div whileHover={reduceMotion ? undefined : { y: -1 }} whileTap={reduceMotion ? undefined : { scale: 0.985 }} transition={{ duration: 0.16, ease: "easeOut" }} className="shrink-0">
              <Button type="button" onClick={() => openInvite()} className="h-11 w-full rounded-xl px-4 shadow-sm shadow-primary/10 sm:w-auto">
                <LuMailPlus aria-hidden="true" />Convidar pessoa
              </Button>
            </motion.div>
          </motion.header>

          <motion.section variants={sequence} className="grid gap-3 sm:grid-cols-2" aria-label="Resumo da equipe">
            {metrics.map((metric) => {
              const Icon = metric.icon
              const selected = selectedFilter === metric.filter
              return (
                <motion.button key={metric.filter} variants={item} type="button" aria-pressed={selected} onClick={() => selectFilter(selected ? "all" : metric.filter)} whileHover={reduceMotion ? undefined : { y: -2 }} whileTap={reduceMotion ? undefined : { scale: 0.995 }} transition={{ duration: 0.16, ease: "easeOut" }} className={`rounded-2xl border p-4 text-left shadow-sm transition-[border-color,background-color,box-shadow] ${selected ? "border-primary/20 bg-gradient-to-br from-primary/[0.075] via-card to-card ring-1 ring-primary/10" : "border-border/70 bg-card hover:border-border hover:shadow-md"}`}>
                  <span className="flex items-center gap-3">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${metric.iconSurface} ${metric.tone}`}><Icon aria-hidden="true" className="size-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2"><span className="text-2xl font-semibold tracking-tight tabular-nums">{metric.value}</span><span className="text-sm font-semibold">{metric.label}</span></span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{metric.description}</span>
                    </span>
                    {selected ? <Badge variant="secondary" className="bg-primary/10 text-primary">Filtrado</Badge> : null}
                  </span>
                </motion.button>
              )
            })}
          </motion.section>

          <motion.section variants={item}>
            <Card className="gap-0 overflow-hidden rounded-2xl border-border/70 bg-card shadow-sm">
              <CardHeader className="gap-3 border-b border-border/60 px-4 py-4 sm:px-5">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <p className="flex min-h-5 items-center gap-2 text-[0.6875rem] text-muted-foreground" aria-live="polite">
                    {isPending ? <span aria-hidden="true" className="size-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary motion-reduce:animate-none" /> : null}
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative w-full sm:max-w-md">
                    <LuSearch aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={search} onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Buscar por nome ou e-mail" aria-label="Buscar na equipe por nome ou e-mail" className="h-10 rounded-xl pl-9 pr-9" />
                    {isPending ? <span aria-hidden="true" className="absolute top-1/2 right-3 size-3 -translate-y-1/2 animate-spin rounded-full border-2 border-muted-foreground/25 border-t-primary motion-reduce:animate-none" /> : null}
                  </div>
                  <div className="flex gap-1 overflow-x-auto rounded-xl border border-border/60 bg-muted/30 p-1" role="group" aria-label="Filtrar equipe">
                    {(["all", "active", "pending"] as const).map((filter) => {
                      const label = filter === "all" ? "Todos" : filter === "active" ? "Ativos" : "Pendentes"
                      const count = filter === "all" ? initialData.activeCount + initialData.pendingCount : filter === "active" ? initialData.activeCount : initialData.pendingCount
                      return <Button key={filter} type="button" size="sm" variant={selectedFilter === filter ? "secondary" : "ghost"} aria-pressed={selectedFilter === filter} onClick={() => selectFilter(filter)} className={`h-8 shrink-0 rounded-lg px-3 text-xs ${selectedFilter === filter ? "bg-background shadow-sm" : "text-muted-foreground"}`}>{label}<span className="ml-0.5 tabular-nums text-muted-foreground">{count}</span></Button>
                    })}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 px-4 py-3 sm:px-5">
                <div className="flex min-h-5 items-center gap-2" aria-live="polite">
                  {pageMessage ? <><LuCircleAlert aria-hidden="true" className="size-3.5 text-muted-foreground" /><p className="text-xs text-muted-foreground">{pageMessage}</p></> : <p className="text-[0.6875rem] text-muted-foreground"><LuAtSign aria-hidden="true" className="mr-1 inline size-3.5" />Convites vinculam o acesso ao e-mail informado. Apenas administradores podem alterar cargos existentes.</p>}
                </div>
                <TeamDataTable
                  rows={initialData.rows}
                  filter={selectedFilter}
                  query={search.trim()}
                  page={initialData.page}
                  pageCount={pageCount}
                  pageSize={initialData.pageSize}
                  totalRows={initialData.totalRows}
                  actorId={initialData.actorId}
                  onPageChange={(page) => navigateToQuery({ search: search.trim(), status: selectedFilter, page })}
                  onOpen={setSelectedRow}
                  onCopyEmail={(row) => { void copyEmail(row) }}
                  onRegenerateInvite={(row) => openInvite(row.email, row.role)}
                  onRevokeInvite={setRevokeCandidate}
                  onRemoveMember={setRemoveCandidate}
                  onClearFilters={clearFilters}
                />
              </CardContent>
            </Card>
          </motion.section>
        </motion.div>
      </main>

      <TeamInviteDialog open={inviteOpen} onOpenChange={setInviteOpen} initialEmail={inviteDraft.email} initialRole={inviteDraft.role} />
      <TeamMemberSheet row={selectedRow} canEditRoles={canEditRoles} actorId={initialData.actorId} onOpenChange={(open) => { if (!open) setSelectedRow(null) }} />

      <AlertDialog open={Boolean(revokeCandidate)} onOpenChange={(open) => { if (!open && !revokePending) setRevokeCandidate(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar este convite?</AlertDialogTitle>
            <AlertDialogDescription>{revokeCandidate ? `O link enviado para ${revokeCandidate.email} deixará de funcionar imediatamente.` : "O link deixará de funcionar imediatamente."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokePending}>Manter convite</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={revokePending} onClick={confirmRevoke}>{revokePending ? "Revogando…" : "Revogar convite"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(removeCandidate)} onOpenChange={(open) => { if (!open && !removePending) setRemoveCandidate(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover acesso à equipe?</AlertDialogTitle>
            <AlertDialogDescription>{removeCandidate ? `${removeCandidate.name} perderá o acesso a este restaurante. O histórico de membership será preservado.` : "A pessoa perderá o acesso a este restaurante."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removePending}>Manter acesso</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={removePending} onClick={confirmRemove}>{removePending ? "Removendo…" : "Remover acesso"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MotionConfig>
  )
}
