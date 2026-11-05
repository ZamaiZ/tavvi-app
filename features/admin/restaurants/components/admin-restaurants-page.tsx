"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { IconType } from "react-icons"
import {
  LuArrowUpRight,
  LuCircleCheck,
  LuCircleX,
  LuClock3,
  LuPause,
  LuStore,
  LuUtensils,
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
import { RestaurantsTableToolbar } from "@/features/admin/restaurants/components/restaurants-table-toolbar"
import { RestaurantsDataTable } from "@/features/admin/restaurants/components/restaurants-data-table"
import { RestaurantDetailsSheet } from "@/features/admin/restaurants/components/restaurant-details-sheet"
import type {
  RestaurantFilter,
  RestaurantListQuery,
  RestaurantListResult,
} from "@/features/admin/restaurants/model"
import { restaurantListQuerySchema } from "@/features/admin/restaurants/schema"

const pageSequence: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { delayChildren: 0.05, staggerChildren: 0.1 },
  },
}

const pageItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] },
  },
}

const summarySequence: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { delayChildren: 0.03, staggerChildren: 0.065 },
  },
}

type SummaryCard = {
  status: Exclude<RestaurantFilter, "all">
  label: string
  description: string
  icon: IconType
  iconClassName: string
  iconSurface: string
}

const summaryCards: SummaryCard[] = [
  {
    status: "active",
    label: "Ativos",
    description: "Disponíveis para publicação",
    icon: LuCircleCheck,
    iconClassName: "text-emerald-700 dark:text-emerald-300",
    iconSurface: "bg-emerald-600/10",
  },
  {
    status: "draft",
    label: "Rascunhos",
    description: "Aguardando configuração no Painel",
    icon: LuClock3,
    iconClassName: "text-primary",
    iconSurface: "bg-primary/10",
  },
  {
    status: "suspended",
    label: "Suspensos",
    description: "Publicação desativada",
    icon: LuPause,
    iconClassName: "text-amber-700 dark:text-amber-300",
    iconSurface: "bg-amber-500/10",
  },
]

const QUERY_NAVIGATION_TTL_MS = 30_000
const MAX_PENDING_QUERY_NAVIGATIONS = 16

type AdminRestaurantsPageProps = {
  initialQuery: RestaurantListQuery
  initialData: RestaurantListResult | null
  initialError: boolean
}

type RestaurantQueryIntent = Pick<RestaurantListQuery, "search" | "status">
type PendingQueryNavigation = { key: string; createdAt: number }

function restaurantQueryIntentKey(intent: RestaurantQueryIntent) {
  return JSON.stringify([intent.search.trim(), intent.status])
}

export function AdminRestaurantsPage({
  initialQuery,
  initialData,
  initialError,
}: AdminRestaurantsPageProps) {
  const shouldReduceMotion = useReducedMotion()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState(initialQuery.search)
  const [selectedFilter, setSelectedFilter] = useState<RestaurantFilter>(
    initialQuery.status
  )
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(
    null
  )
  const queryIntent = useRef<RestaurantQueryIntent>({
    search: initialQuery.search,
    status: initialQuery.status,
  })
  const queryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Preserve newer local input when an earlier App Router navigation resolves.
  const pendingQueryNavigations = useRef<PendingQueryNavigation[]>([])
  const searchParamsValue = searchParams?.toString() ?? ""
  const currentParams = new URLSearchParams(searchParamsValue)
  const rawSearchParam = currentParams.get("search")
  const rawStatusParam = currentParams.get("status")
  const parsedUrlQuery = restaurantListQuerySchema.safeParse({
    search: rawSearchParam ?? "",
    status: rawStatusParam ?? "all",
    page: currentParams.get("page") ?? "1",
    pageSize: currentParams.get("pageSize") ?? "25",
  })
  const urlQuery = parsedUrlQuery.success
    ? parsedUrlQuery.data
    : restaurantListQuerySchema.parse({})

  useEffect(() => {
    const incomingIntent = {
      search: urlQuery.search,
      status: urlQuery.status,
    }
    const incomingKey = restaurantQueryIntentKey(incomingIntent)
    const oldestAllowedTime = Date.now() - QUERY_NAVIGATION_TTL_MS
    pendingQueryNavigations.current = pendingQueryNavigations.current.filter(
      (navigation) => navigation.createdAt >= oldestAllowedTime
    )
    const matchingNavigationIndex = pendingQueryNavigations.current.findIndex(
      (navigation) => navigation.key === incomingKey
    )

    if (matchingNavigationIndex >= 0) {
      pendingQueryNavigations.current.splice(0, matchingNavigationIndex + 1)
      if (restaurantQueryIntentKey(queryIntent.current) !== incomingKey) return
    } else {
      queryIntent.current = incomingIntent
    }

    if (queryTimer.current) {
      clearTimeout(queryTimer.current)
      queryTimer.current = null
    }
    setQuery(urlQuery.search)
    setSelectedFilter(urlQuery.status)
  }, [rawSearchParam, rawStatusParam, urlQuery.search, urlQuery.status])

  useEffect(() => {
    if (!initialData || initialData.page === initialQuery.page) return

    const params = new URLSearchParams(window.location.search)
    if (initialData.page > 1) {
      params.set("page", String(initialData.page))
    } else {
      params.delete("page")
    }
    const suffix = params.toString()
    const href = suffix ? `${window.location.pathname}?${suffix}` : window.location.pathname
    startTransition(() => router.replace(href, { scroll: false }))
  }, [initialData, initialQuery.page, router])

  useEffect(
    () => () => {
      if (queryTimer.current) clearTimeout(queryTimer.current)
    },
    []
  )

  const navigateToQuery = useCallback(
    (next: Partial<RestaurantListQuery>) => {
      const nextQuery: RestaurantListQuery = {
        search: query,
        status: selectedFilter,
        page: 1,
        pageSize: initialQuery.pageSize,
        ...next,
      }
      const intent = {
        search: nextQuery.search,
        status: nextQuery.status,
      }
      queryIntent.current = intent
      const intentKey = restaurantQueryIntentKey(intent)
      if (intentKey !== restaurantQueryIntentKey(urlQuery)) {
        const oldestAllowedTime = Date.now() - QUERY_NAVIGATION_TTL_MS
        pendingQueryNavigations.current = pendingQueryNavigations.current.filter(
          (navigation) => navigation.createdAt >= oldestAllowedTime
        )
        pendingQueryNavigations.current.push({
          key: intentKey,
          createdAt: Date.now(),
        })
        if (
          pendingQueryNavigations.current.length > MAX_PENDING_QUERY_NAVIGATIONS
        ) {
          pendingQueryNavigations.current = pendingQueryNavigations.current.slice(
            -MAX_PENDING_QUERY_NAVIGATIONS
          )
        }
      }
      const params = new URLSearchParams()

      if (nextQuery.search) params.set("search", nextQuery.search)
      if (nextQuery.status !== "all") params.set("status", nextQuery.status)
      if (nextQuery.page > 1) params.set("page", String(nextQuery.page))
      if (nextQuery.pageSize !== 25) {
        params.set("pageSize", String(nextQuery.pageSize))
      }

      const suffix = params.toString()
      const href = suffix
        ? `${window.location.pathname}?${suffix}`
        : window.location.pathname
      startTransition(() => router.replace(href, { scroll: false }))
    },
    [
      initialQuery.pageSize,
      query,
      router,
      selectedFilter,
      urlQuery.search,
      urlQuery.status,
    ]
  )
  const navigateToQueryRef = useRef(navigateToQuery)

  useEffect(() => {
    navigateToQueryRef.current = navigateToQuery
  }, [navigateToQuery])

  const handleQueryChange = useCallback(
    (nextQuery: string) => {
      setQuery(nextQuery)
      queryIntent.current = { search: nextQuery, status: selectedFilter }
      if (queryTimer.current) clearTimeout(queryTimer.current)
      queryTimer.current = setTimeout(() => {
        queryTimer.current = null
        navigateToQueryRef.current({ search: nextQuery, page: 1 })
      }, 280)
    },
    [selectedFilter]
  )

  const handleFilterChange = useCallback(
    (nextFilter: RestaurantFilter) => {
      if (queryTimer.current) {
        clearTimeout(queryTimer.current)
        queryTimer.current = null
      }
      setSelectedFilter(nextFilter)
      queryIntent.current = { search: query, status: nextFilter }
      navigateToQuery({ search: query, status: nextFilter, page: 1 })
    },
    [navigateToQuery, query]
  )

  const handleQuerySubmit = useCallback(
    (nextQuery: string) => {
      if (queryTimer.current) {
        clearTimeout(queryTimer.current)
        queryTimer.current = null
      }
      setQuery(nextQuery)
      queryIntent.current = { search: nextQuery, status: selectedFilter }
      navigateToQuery({ search: nextQuery, page: 1 })
    },
    [navigateToQuery, selectedFilter]
  )

  const handleClearFilters = useCallback(() => {
    if (queryTimer.current) {
      clearTimeout(queryTimer.current)
      queryTimer.current = null
    }
    setQuery("")
    setSelectedFilter("all")
    queryIntent.current = { search: "", status: "all" }
    navigateToQuery({ search: "", status: "all", page: 1 })
  }, [navigateToQuery])

  const selectedRestaurant =
    initialData?.rows.find((row) => row.id === selectedRestaurantId) ?? null

  useEffect(() => {
    if (selectedRestaurantId && !selectedRestaurant) {
      setSelectedRestaurantId(null)
    }
  }, [selectedRestaurant, selectedRestaurantId])

  const counts = initialData?.counts ?? {
    all: 0,
    draft: 0,
    active: 0,
    suspended: 0,
  }
  const totalRows = initialData?.totalRows ?? 0
  const pageCount = initialData
    ? Math.max(1, Math.ceil(initialData.totalRows / initialData.pageSize))
    : 1
  const globalEmpty = Boolean(
    initialData &&
      initialData.counts.all === 0 &&
      query.trim() === "" &&
      selectedFilter === "all"
  )

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={shouldReduceMotion ? false : "hidden"}
        animate="visible"
        variants={pageSequence}
        className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-3 sm:px-6 sm:py-4 lg:px-8"
      >
        <motion.div
          variants={pageItem}
          className="flex min-w-0 flex-1 flex-col py-1 sm:py-2"
        >
          <motion.div
            variants={pageSequence}
            className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 sm:gap-6"
          >
            <motion.section
              variants={pageSequence}
              className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"
            >
              <motion.div
                variants={pageSequence}
                className="flex min-w-0 items-start gap-3"
              >
                <SidebarTrigger
                  aria-label="Alternar navegação lateral"
                  title="Alternar navegação lateral"
                  className="mt-0.5 shrink-0 rounded-lg border border-border/70 bg-background shadow-sm transition-colors duration-150"
                />
                <motion.div variants={pageItem} className="min-w-0">
                  <Breadcrumb>
                    <BreadcrumbList className="gap-2">
                      <BreadcrumbItem>
                        <BreadcrumbPage className="inline-flex items-center gap-2 text-[0.5625rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <LuUtensils aria-hidden="true" className="size-3.5" />
                          </span>
                          Restaurantes
                        </BreadcrumbPage>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </Breadcrumb>
                  <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                    Restaurantes
                  </h1>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground sm:text-sm">
                    Consulte os restaurantes e controle a publicação da plataforma.
                  </p>
                </motion.div>
              </motion.div>
            </motion.section>

            <motion.section
              variants={summarySequence}
              className="grid gap-3 sm:grid-cols-3"
              aria-label="Resumo dos restaurantes por situação"
            >
              {summaryCards.map((card) => {
                const Icon = card.icon
                const isSelected = selectedFilter === card.status

                return (
                  <motion.button
                    key={card.status}
                    variants={pageItem}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleFilterChange(card.status)}
                    whileHover={shouldReduceMotion ? undefined : { y: -2, scale: 1.004 }}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                    transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut" }}
                    className={`group rounded-2xl border p-3 text-left shadow-sm transition-colors sm:p-4 motion-reduce:transition-none ${
                      isSelected
                        ? "border-primary/20 bg-gradient-to-br from-primary/[0.08] via-card to-card ring-1 ring-primary/10"
                        : "border-border/70 bg-card hover:border-border hover:bg-card/90"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${card.iconSurface} ${card.iconClassName}`}>
                        <Icon aria-hidden="true" className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-semibold tracking-tight tabular-nums">
                            {initialError ? "—" : counts[card.status]}
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

            <motion.section variants={pageItem}>
              <Card className="gap-0 overflow-hidden rounded-2xl border-border/70 bg-card shadow-sm">
                <CardHeader className="gap-2 border-b border-border/60 px-4 py-3 sm:px-5">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div className="space-y-1">
                      <h2 className="text-sm font-semibold sm:text-base">
                        Restaurantes da plataforma
                      </h2>
                      <CardDescription className="max-w-2xl text-[0.6875rem] leading-5 sm:text-xs">
                        Pesquise por nome ou endereço e acompanhe a situação de cada restaurante.
                      </CardDescription>
                    </div>
                    <p
                      className="flex min-h-5 items-center gap-2 text-[0.6875rem] text-muted-foreground"
                      aria-live="polite"
                    >
                      {isPending && (
                        <span
                          aria-hidden="true"
                          className="size-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary motion-reduce:animate-none"
                        />
                      )}
                      {initialError
                        ? "Não foi possível carregar os restaurantes"
                        : `${totalRows} ${totalRows === 1 ? "restaurante" : "restaurantes"}`}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 px-4 py-3 sm:px-5 sm:py-4">
                  {initialError || !initialData ? (
                    <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/15 px-6 text-center">
                      <span className="flex size-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                        <LuCircleX aria-hidden="true" className="size-5" />
                      </span>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          Não foi possível carregar os restaurantes
                        </p>
                        <p className="max-w-sm text-xs leading-5 text-muted-foreground">
                          Não conseguimos consultar a lista agora. Tente novamente em instantes.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => router.refresh()}
                      >
                        Tentar novamente
                      </Button>
                    </div>
                  ) : globalEmpty ? (
                    <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/15 px-6 text-center">
                      <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <LuStore aria-hidden="true" className="size-5" />
                      </span>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Nenhum restaurante ainda</p>
                        <p className="max-w-sm text-xs leading-5 text-muted-foreground">
                          Restaurantes aparecem aqui após o resgate de um convite.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <RestaurantsTableToolbar
                      counts={initialData.counts}
                      query={query}
                      onQueryChange={handleQueryChange}
                      onQuerySubmit={handleQuerySubmit}
                      selectedFilter={selectedFilter}
                      onFilterChange={handleFilterChange}
                      isPending={isPending}
                    >
                      {initialData.rows.length === 0 ? (
                        <div className="flex min-h-56 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/70 bg-muted/15 px-6 text-center" aria-live="polite">
                          <p className="text-sm font-medium">Nenhum restaurante encontrado</p>
                          <p className="max-w-sm text-xs leading-5 text-muted-foreground">
                            Ajuste a busca ou os filtros para ver outros restaurantes.
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleClearFilters}
                            className="mt-1"
                          >
                            Limpar filtros
                          </Button>
                        </div>
                      ) : (
                        <RestaurantsDataTable
                          rows={initialData.rows}
                          page={initialData.page}
                          pageCount={pageCount}
                          pageSize={initialData.pageSize}
                          totalRows={initialData.totalRows}
                          onPageChange={(page) => navigateToQuery({ page })}
                          onOpenRestaurant={setSelectedRestaurantId}
                        />
                      )}
                    </RestaurantsTableToolbar>
                  )}
                </CardContent>
              </Card>
            </motion.section>
          </motion.div>
        </motion.div>

        <RestaurantDetailsSheet
          restaurant={selectedRestaurant}
          open={Boolean(selectedRestaurantId && selectedRestaurant)}
          onOpenChange={(open) => {
            if (!open) setSelectedRestaurantId(null)
          }}
        />
      </motion.div>
    </MotionConfig>
  )
}
