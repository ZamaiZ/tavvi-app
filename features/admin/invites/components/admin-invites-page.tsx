"use client"

import {
  useCallback,
  useEffect,
  useState,
  useTransition,
} from "react"
import { usePathname, useRouter } from "next/navigation"
import type { IconType } from "react-icons"
import {
  LuArrowUpRight,
  LuBan,
  LuCalendarClock,
  LuCircleCheck,
  LuCircleX,
  LuClock3,
  LuMailPlus,
  LuSend,
} from "react-icons/lu"
import {
  MotionConfig,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { InviteCreateSheet } from "@/features/admin/invites/components/invite-create-sheet"
import { InviteDetailsSheet } from "@/features/admin/invites/components/invite-details-sheet"
import { InvitesDataTable } from "@/features/admin/invites/components/invites-data-table"
import { InvitesTableToolbar } from "@/features/admin/invites/components/invites-table-toolbar"
import type {
  InviteFilter,
  InviteListQuery,
  InviteListResult,
  PlatformInvite,
} from "@/features/admin/invites/model"

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
  initialQuery: InviteListQuery
  initialData: InviteListResult | null
  initialError: boolean
}

export function AdminInvitesPage({
  initialQuery,
  initialData,
  initialError,
}: AdminInvitesPageProps) {
  const shouldReduceMotion = useReducedMotion()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState(initialQuery.search)
  const [selectedFilter, setSelectedFilter] = useState<InviteFilter>(
    initialQuery.status
  )
  const [selectedInvite, setSelectedInvite] = useState<PlatformInvite | null>(
    null
  )
  const [createOpen, setCreateOpen] = useState(false)
  const [initialEmail, setInitialEmail] = useState<string | undefined>()

  useEffect(() => {
    setQuery(initialQuery.search)
    setSelectedFilter(initialQuery.status)
  }, [initialQuery.search, initialQuery.status])

  useEffect(() => {
    if (!initialData || initialData.page === initialQuery.page) return

    const params = new URLSearchParams(window.location.search)
    if (initialData.page > 1) {
      params.set("page", String(initialData.page))
    } else {
      params.delete("page")
    }
    const suffix = params.toString()
    const href = suffix ? `${pathname}?${suffix}` : pathname
    startTransition(() => router.replace(href, { scroll: false }))
  }, [initialData, initialQuery.page, pathname, router])

  const navigateToQuery = useCallback(
    (next: Partial<InviteListQuery>) => {
      const nextQuery: InviteListQuery = {
        search: query,
        status: selectedFilter,
        page: 1,
        pageSize: initialQuery.pageSize,
        ...next,
      }
      const params = new URLSearchParams()

      if (nextQuery.search) params.set("search", nextQuery.search)
      if (nextQuery.status !== "all") params.set("status", nextQuery.status)
      if (nextQuery.page > 1) params.set("page", String(nextQuery.page))
      if (nextQuery.pageSize !== 25) {
        params.set("pageSize", String(nextQuery.pageSize))
      }

      const suffix = params.toString()
      const href = suffix ? `${pathname}?${suffix}` : pathname
      startTransition(() => router.replace(href, { scroll: false }))
    },
    [initialQuery.pageSize, pathname, query, router, selectedFilter]
  )

  const handleQueryChange = useCallback(
    (nextQuery: string) => {
      setQuery(nextQuery)
    },
    []
  )

  const handleQuerySubmit = useCallback(
    (nextQuery = query) => {
      navigateToQuery({ search: nextQuery.trim(), page: 1 })
    },
    [navigateToQuery, query]
  )

  const handleFilterChange = useCallback(
    (nextFilter: InviteFilter) => {
      setSelectedFilter(nextFilter)
      navigateToQuery({ search: query, status: nextFilter, page: 1 })
    },
    [navigateToQuery, query]
  )

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
    navigateToQuery({ search: "", status: "all", page: 1 })
  }, [navigateToQuery])

  const counts = initialData?.counts
  const totalRows = initialData?.totalRows ?? 0
  const pageCount = initialData
    ? Math.max(1, Math.ceil(initialData.totalRows / initialData.pageSize))
    : 1

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={shouldReduceMotion ? false : "hidden"}
        animate="visible"
        variants={dashboardSequence}
        className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-3 sm:px-6 sm:py-4 lg:px-8"
      >
        <motion.div
          variants={dashboardItem}
          className="flex min-w-0 flex-1 flex-col py-1 sm:py-2"
        >
          <motion.div
            variants={dashboardSequence}
            className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 sm:gap-6"
          >
            <motion.section
              variants={dashboardSequence}
              className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"
            >
              <motion.div
                variants={dashboardSequence}
                className="flex min-w-0 items-start gap-3"
              >
                <SidebarTrigger
                  aria-label="Alternar navegação lateral"
                  title="Alternar navegação lateral"
                  className="mt-0.5 hidden shrink-0 rounded-lg border border-border/70 bg-background shadow-sm transition-colors duration-150 md:inline-flex"
                />
                <motion.div variants={dashboardItem} className="min-w-0">
                  <Breadcrumb>
                    <BreadcrumbList className="gap-2">
                      <BreadcrumbItem>
                        <BreadcrumbPage className="inline-flex items-center gap-2 text-[0.5625rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <LuSend aria-hidden="true" className="size-3.5" />
                          </span>
                          Convites
                        </BreadcrumbPage>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </Breadcrumb>
                </motion.div>
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
                  className="h-10 w-full rounded-xl px-4 shadow-sm shadow-primary/10 sm:w-auto"
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
                    onClick={() => handleFilterChange(card.status)}
                    whileHover={{ y: -2, scale: 1.004 }}
                    whileTap={{ scale: 0.99 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className={`group rounded-2xl border p-3 text-left shadow-sm transition-colors sm:p-4 ${
                      isSelected
                        ? "border-primary/20 bg-gradient-to-br from-primary/[0.08] via-card to-card ring-1 ring-primary/10"
                        : "border-border/70 bg-card hover:border-border hover:bg-card/90"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${card.iconSurface} ${card.iconClassName}`}
                      >
                        <Icon aria-hidden="true" className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-semibold tracking-tight tabular-nums">
                            {counts?.[card.status] ?? "—"}
                          </span>
                          <span className="truncate text-xs font-medium text-muted-foreground">
                            {card.label.toLowerCase()}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-[0.625rem] text-muted-foreground">
                          {card.description}
                        </span>
                      </span>
                      <LuArrowUpRight
                        aria-hidden="true"
                        className="size-3.5 shrink-0 self-start text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-muted-foreground"
                      />
                    </span>
                  </motion.button>
                )
              })}
            </motion.section>

            <motion.section variants={dashboardItem}>
              <Card className="gap-0 overflow-hidden rounded-2xl border-border/70 bg-card shadow-sm">
                <CardHeader className="gap-2 border-b border-border/60 px-4 py-3 sm:px-5">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold sm:text-base">
                          Convites enviados
                        </h2>
                      </div>
                      <CardDescription className="max-w-2xl text-[0.6875rem] leading-5 sm:text-xs">
                        Pesquise por e-mail e filtre a lista pela situação do
                        convite.
                      </CardDescription>
                    </div>
                    <p
                      className="flex min-h-5 items-center gap-2 text-[0.6875rem] text-muted-foreground"
                      aria-live="polite"
                    >
                      {isPending && (
                        <span
                          aria-hidden="true"
                          className="size-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
                        />
                      )}
                      {initialError
                        ? "Não foi possível carregar os convites"
                        : `${totalRows} ${totalRows === 1 ? "convite" : "convites"}`}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 px-4 py-2.5 sm:px-5 sm:py-3">
                  {initialError || !initialData ? (
                    <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/15 px-6 text-center">
                      <span className="flex size-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                        <LuCircleX aria-hidden="true" className="size-5" />
                      </span>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          Não foi possível carregar os convites
                        </p>
                        <p className="max-w-sm text-xs leading-5 text-muted-foreground">
                          Não conseguimos consultar a lista agora. Tente
                          novamente em instantes.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.refresh()}
                      >
                        Tentar novamente
                      </Button>
                    </div>
                  ) : (
                    <InvitesTableToolbar
                      counts={initialData.counts}
                      query={query}
                      onQueryChange={handleQueryChange}
                      onQuerySubmit={handleQuerySubmit}
                      selectedFilter={selectedFilter}
                      onFilterChange={handleFilterChange}
                      isPending={isPending}
                    >
                      <InvitesDataTable
                        invites={initialData.rows}
                        filter={selectedFilter}
                        query={query}
                        page={initialData.page}
                        pageCount={pageCount}
                        pageSize={initialData.pageSize}
                        totalRows={initialData.totalRows}
                        onPageChange={(page) => navigateToQuery({ page })}
                        onOpen={handleOpenInvite}
                        onCreateFromInvite={handleCreateFromInvite}
                        onClearFilters={handleClearFilters}
                      />
                    </InvitesTableToolbar>
                  )}
                </CardContent>
              </Card>
            </motion.section>
          </motion.div>
        </motion.div>

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
