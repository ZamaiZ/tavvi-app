"use client"

import { useCallback, useMemo, useState, type ReactNode } from "react"
import type { IconType } from "react-icons"
import {
  LuArrowUpRight,
  LuBan,
  LuCalendarClock,
  LuCircleCheck,
  LuClock3,
  LuMailPlus,
  LuSend,
  LuSparkles,
} from "react-icons/lu"
import {
  MotionConfig,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import { InviteCreateSheet } from "@/features/admin/invites/components/invite-create-sheet"
import { InviteDetailsSheet } from "@/features/admin/invites/components/invite-details-sheet"
import { InvitesDataTable } from "@/features/admin/invites/components/invites-data-table"
import { InvitesTableToolbar } from "@/features/admin/invites/components/invites-table-toolbar"
import {
  demoInvites,
  inviteSummaryCounts,
  type InviteFilter,
  type PlatformInvite,
} from "@/features/admin/invites/data"

const dashboardSequence: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.05,
      staggerChildren: 0.11,
    },
  },
}

const dashboardItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.38,
      ease: [0.22, 1, 0.36, 1],
    },
  },
}

const metricStagger: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.03,
      staggerChildren: 0.065,
    },
  },
}

type SummaryCard = {
  status: Exclude<InviteFilter, "all">
  label: string
  description: string
  icon: IconType
  iconClassName: string
  iconSurface: string
}

const summaryCards: SummaryCard[] = [
  {
    status: "pending",
    label: "Pendentes",
    description: "Aguardando primeiro acesso",
    icon: LuClock3,
    iconClassName: "text-primary",
    iconSurface: "bg-primary/10",
  },
  {
    status: "redeemed",
    label: "Resgatados",
    description: "Acesso concluído",
    icon: LuCircleCheck,
    iconClassName: "text-emerald-700 dark:text-emerald-300",
    iconSurface: "bg-emerald-600/10",
  },
  {
    status: "expired",
    label: "Vencidos",
    description: "Prazo encerrado",
    icon: LuCalendarClock,
    iconClassName: "text-amber-700 dark:text-amber-300",
    iconSurface: "bg-amber-500/10",
  },
  {
    status: "revoked",
    label: "Revogados",
    description: "Acesso desativado",
    icon: LuBan,
    iconClassName: "text-muted-foreground",
    iconSurface: "bg-muted",
  },
]

type AdminInvitesPageProps = {
  header: ReactNode
  footer: string
}

export function AdminInvitesPage({ header, footer }: AdminInvitesPageProps) {
  const shouldReduceMotion = useReducedMotion()
  const [query, setQuery] = useState("")
  const [selectedFilter, setSelectedFilter] = useState<InviteFilter>("all")
  const [selectedInvite, setSelectedInvite] = useState<PlatformInvite | null>(
    null
  )
  const [createOpen, setCreateOpen] = useState(false)
  const [initialEmail, setInitialEmail] = useState<string | undefined>()

  const filteredInvites = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR")

    return demoInvites.filter((invite) => {
      const matchesStatus =
        selectedFilter === "all" || invite.status === selectedFilter
      const matchesQuery =
        !normalizedQuery ||
        (invite.email ?? "qualquer e-mail")
          .toLocaleLowerCase("pt-BR")
          .includes(normalizedQuery)

      return matchesStatus && matchesQuery
    })
  }, [query, selectedFilter])

  const handleOpenInvite = useCallback((invite: PlatformInvite) => {
    setSelectedInvite(invite)
  }, [])

  const handleCreateFromInvite = useCallback((invite: PlatformInvite) => {
    setSelectedInvite(null)
    setInitialEmail(invite.email ?? undefined)
    setCreateOpen(true)
  }, [])

  const handleCreateNewInvite = useCallback(() => {
    setInitialEmail(undefined)
    setCreateOpen(true)
  }, [])

  const handleClearFilters = useCallback(() => {
    setQuery("")
    setSelectedFilter("all")
  }, [])

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={shouldReduceMotion ? false : "hidden"}
        animate="visible"
        variants={dashboardSequence}
        className="mx-auto flex min-h-[calc(100svh-2rem)] max-w-[1440px] flex-col"
      >
        <motion.div variants={dashboardItem}>{header}</motion.div>

        <motion.main
          variants={dashboardItem}
          className="min-w-0 flex-1 py-8 sm:py-10 lg:py-12"
        >
          <motion.div
            variants={dashboardSequence}
            className="mx-auto flex w-full max-w-[1240px] flex-col gap-8 sm:gap-10"
          >
            <motion.section
              variants={dashboardSequence}
              className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"
            >
              <motion.div variants={dashboardSequence} className="max-w-2xl">
                <motion.div
                  variants={dashboardItem}
                  className="mb-4 flex items-center gap-2"
                >
                  <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <LuSend aria-hidden="true" className="size-4" />
                  </span>
                  <p className="text-[0.625rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                    Administração · Acessos
                  </p>
                </motion.div>
                <motion.h1
                  variants={dashboardItem}
                  className="text-3xl font-semibold tracking-tight sm:text-4xl"
                >
                  Convites
                </motion.h1>
                <motion.p
                  variants={dashboardItem}
                  className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base"
                >
                  Acompanhe os acessos à plataforma e mantenha os convites
                  organizados em um só lugar.
                </motion.p>
              </motion.div>

              <motion.div
                variants={dashboardItem}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.985 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="shrink-0"
              >
                <Button
                  size="lg"
                  onClick={handleCreateNewInvite}
                  className="h-11 w-full rounded-xl px-4 shadow-sm shadow-primary/10 sm:w-auto"
                >
                  <LuMailPlus aria-hidden="true" />
                  Novo convite
                  <motion.span
                    aria-hidden="true"
                    whileHover={{ x: 2, y: -2 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="flex"
                  >
                    <LuArrowUpRight className="size-4" />
                  </motion.span>
                </Button>
              </motion.div>
            </motion.section>

            <motion.section
              variants={metricStagger}
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
              aria-label="Resumo dos convites por situação"
            >
              {summaryCards.map((card) => {
                const Icon = card.icon
                const isSelected = selectedFilter === card.status

                return (
                  <motion.button
                    key={card.status}
                    variants={dashboardItem}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedFilter(card.status)}
                    whileHover={{ y: -3, scale: 1.008 }}
                    whileTap={{ scale: 0.99 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className={`group rounded-2xl border p-4 text-left shadow-sm transition-colors sm:p-5 ${
                      isSelected || card.status === "pending"
                        ? "border-primary/20 bg-gradient-to-br from-primary/[0.08] via-card to-card ring-1 ring-primary/10"
                        : "border-border/70 bg-card hover:border-border hover:bg-card/90"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-4">
                      <span
                        className={`flex size-10 items-center justify-center rounded-xl ${card.iconSurface} ${card.iconClassName}`}
                      >
                        <Icon aria-hidden="true" className="size-[1.125rem]" />
                      </span>
                      <LuArrowUpRight
                        aria-hidden="true"
                        className="size-4 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-muted-foreground"
                      />
                    </span>
                    <span className="mt-5 flex items-baseline gap-2">
                      <span className="text-3xl font-semibold tracking-tight tabular-nums">
                        {inviteSummaryCounts[card.status]}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {card.label.toLowerCase()}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {card.description}
                    </span>
                  </motion.button>
                )
              })}
            </motion.section>

            <motion.section variants={dashboardItem}>
              <Card className="gap-0 overflow-hidden rounded-2xl border-border/70 bg-card shadow-sm">
                <CardHeader className="gap-4 border-b border-border/60 px-5 py-5 sm:px-6 sm:py-6">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold">
                          Convites enviados
                        </h2>
                        <Badge
                          variant="secondary"
                          className="h-5 gap-1.5 rounded-full px-2 text-[0.625rem] font-medium"
                        >
                          <LuSparkles aria-hidden="true" />
                          Prévia visual
                        </Badge>
                      </div>
                      <CardDescription className="max-w-2xl text-xs leading-5 sm:text-sm">
                        Pesquise por e-mail e filtre a lista pela situação do
                        convite.
                      </CardDescription>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {filteredInvites.length} de {demoInvites.length} registros
                      de demonstração
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 px-5 py-4 sm:px-6">
                  <InvitesTableToolbar
                    counts={inviteSummaryCounts}
                    query={query}
                    onQueryChange={setQuery}
                    selectedFilter={selectedFilter}
                    onFilterChange={setSelectedFilter}
                  >
                    <InvitesDataTable
                      invites={filteredInvites}
                      filter={selectedFilter}
                      query={query}
                      onOpen={handleOpenInvite}
                      onCreateFromInvite={handleCreateFromInvite}
                      onClearFilters={handleClearFilters}
                    />
                  </InvitesTableToolbar>
                  <p className="text-[0.625rem] leading-5 text-muted-foreground">
                    Os registros são ilustrativos; convites reais serão
                    conectados em uma próxima etapa.
                  </p>
                </CardContent>
              </Card>
            </motion.section>
          </motion.div>
        </motion.main>

        <motion.footer
          variants={dashboardItem}
          className="border-t border-border/60 py-4 text-center text-[0.625rem] text-muted-foreground"
        >
          {footer}
        </motion.footer>

        <InviteDetailsSheet
          invite={selectedInvite}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedInvite(null)
            }
          }}
          onCreateFromInvite={handleCreateFromInvite}
        />
        <InviteCreateSheet
          open={createOpen}
          onOpenChange={setCreateOpen}
          initialEmail={initialEmail}
        />
      </motion.div>
    </MotionConfig>
  )
}
